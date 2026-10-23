#!/usr/bin/env bash
# env-lock.sh — one-agent-at-a-time locks on a POOL of personal C3 envs
# (default: charlieamdpo03 and charlieamdpo04; same permissions and tokens).
#
#   env-lock.sh acquire <TICKET> <WORKTREE>   exit 0 = you hold an env (prints which), 1 = all busy
#   env-lock.sh which   <TICKET>              exit 0 = prints "env=<name> port=<n>" for the env <TICKET> holds, 1 = none
#   env-lock.sh check   <TICKET>              exit 0 = <TICKET> still holds an env, 1 = it doesn't (LOST)
#   env-lock.sh release <TICKET>              exit 0 = released (or nothing held), 1 = error
#   env-lock.sh status                        one line per env: holder, or "free"
#
# Pool: ENV_LOCK_ENVS (space-separated, in preference order). Each env has its own lock file in
# ENV_LOCK_DIR, e.g. ~/.c3amdpo/locks/charlieamdpo03.lock. Dev-server port = 8000 + the env's index
# in the pool (03 -> 8000, 04 -> 8001), so two agents never fight over a port.
#
# acquire tries the envs in order and takes the first free one. A ticket that already holds an env
# gets that same env back (timestamp refreshed). If every env is held, it exits 1 and the caller
# waits and retries; whichever env frees up first goes to whoever retries next.
#
# How it stays safe with many agents (per env):
#   - Taking a FREE lock: the lock is written in full to a temp file, then hard-linked into place
#     with `ln`, which fails if a lock already exists. So "is it free?" and "take it" are one atomic
#     step, and nobody ever reads a half-written lock.
#   - Changing an EXISTING lock (refresh, stale takeover, release) happens only while holding a
#     short-lived mutex (`mkdir $LOCK.mutex`, held for milliseconds). Under the mutex nobody else can
#     replace or delete the lock, so "is it still the lock I read (same nonce)?" followed by
#     "replace it" (atomic rename) or "delete it" cannot be interleaved with another agent.
#   - A lock older than ENV_LOCK_TTL_HOURS (default 6) is stale and gets taken over.

set -u
ENVS="${ENV_LOCK_ENVS:-charlieamdpo03 charlieamdpo04}"
LOCK_DIR="${ENV_LOCK_DIR:-$HOME/.c3amdpo/locks}"
TTL_HOURS="${ENV_LOCK_TTL_HOURS:-6}"

# Point every helper below at one env's lock file.
use_env() {
  ENV_NAME="$1"
  LOCK="$LOCK_DIR/$ENV_NAME.lock"
  MUTEX="$LOCK.mutex"
}

field() { sed -n "s/^$1=//p" "${2:-$LOCK}" 2>/dev/null | head -1; }
mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }

port_for() {
  local i=0 e
  for e in $ENVS; do [ "$e" = "$1" ] && { echo $((8000 + i)); return; }; i=$((i + 1)); done
}

# Write a complete lock for ticket $1 / worktree $2 to a new temp file; print its path.
new_lock_file() {
  local tmp="$LOCK.tmp.$$.$RANDOM"
  printf 'ticket=%s\nworktree=%s\nnonce=%s\nacquired_at=%s\nacquired_at_human=%s\n' \
    "$1" "$2" "$$-$RANDOM$RANDOM" "$(date +%s)" "$(date '+%Y-%m-%d %H:%M %Z')" > "$tmp" && echo "$tmp"
}

# Take the lock only if it is free. Atomic; never needs the mutex.
create_lock() {
  local tmp rc
  tmp="$(new_lock_file "$1" "$2")" || return 1
  ln "$tmp" "$LOCK" 2>/dev/null; rc=$?
  rm -f "$tmp"
  return $rc
}

# Short critical section. A mutex left behind by a crashed agent is cleared after 60s.
mutex_lock() {
  local i
  for i in $(seq 1 100); do
    mkdir "$MUTEX" 2>/dev/null && return 0
    if [ $(( $(date +%s) - $(mtime "$MUTEX") )) -gt 60 ]; then rmdir "$MUTEX" 2>/dev/null; fi
    sleep 0.1
  done
  echo "could not get $MUTEX after 10s" >&2
  return 1
}
mutex_unlock() { rmdir "$MUTEX" 2>/dev/null; }

print_holder() {
  echo "$ENV_NAME is held by $(field ticket) since $(field acquired_at_human) (worktree: $(field worktree))"
}

# The env (from the pool) that <ticket> holds; sets the helpers' env and returns 0, or returns 1.
find_held() {
  local e
  for e in $ENVS; do
    use_env "$e"
    [ "$(field ticket)" = "$1" ] && return 0
  done
  return 1
}

# Try to take the CURRENT env for <ticket>. 0 = got it (prints what happened), 1 = busy.
try_acquire() {
  local ticket="$1" worktree="$2" try holder nonce at age tmp
  mkdir -p "$LOCK_DIR"
  for try in 1 2 3 4 5; do
    if create_lock "$ticket" "$worktree"; then echo "acquired $ENV_NAME for $ticket"; return 0; fi
    holder="$(field ticket)"; nonce="$(field nonce)"; at="$(field acquired_at)"
    [ -n "$nonce" ] || continue                      # released between our two reads — retry
    age=$(( $(date +%s) - at ))
    if [ "$holder" != "$ticket" ] && [ "$age" -lt $(( TTL_HOURS * 3600 )) ]; then return 1; fi

    # Ours to refresh, or stale to take over: replace it under the mutex.
    mutex_lock || return 1
    if [ "$(field nonce)" != "$nonce" ]; then mutex_unlock; continue; fi   # changed — look again
    tmp="$(new_lock_file "$ticket" "$worktree")" && mv -f "$tmp" "$LOCK"
    mutex_unlock
    if [ "$holder" = "$ticket" ]; then echo "already held by $ticket — timestamp refreshed"
    else echo "took over STALE lock from $holder (held $((age / 3600))h) — acquired $ENV_NAME for $ticket"; fi
    return 0
  done
  return 1
}

acquire() {
  local ticket="$1" worktree="$2" e
  # Already holding one? Keep that env and refresh it.
  if find_held "$ticket"; then
    try_acquire "$ticket" "$worktree" && { echo "env=$ENV_NAME port=$(port_for "$ENV_NAME")"; return 0; }
  fi
  # Otherwise take the first env in the pool that is free (or stale).
  for e in $ENVS; do
    use_env "$e"
    if try_acquire "$ticket" "$worktree"; then echo "env=$ENV_NAME port=$(port_for "$ENV_NAME")"; return 0; fi
  done
  echo "all envs busy:"; status
  return 1
}

which_env() {
  if find_held "$1"; then echo "env=$ENV_NAME port=$(port_for "$ENV_NAME")"; return 0; fi
  echo "$1 holds no env" >&2; return 1
}

check() {
  if find_held "$1"; then echo "$1 holds $ENV_NAME"; return 0; fi
  echo "LOST: $1 no longer holds any env — $(status | tr '\n' ';')"
  return 1
}

release() {
  local ticket="$1"
  find_held "$ticket" || { echo "$ticket holds no env — nothing to release"; return 0; }
  mutex_lock || return 1
  if [ "$(field ticket)" != "$ticket" ]; then      # lost it between find and mutex
    mutex_unlock; echo "not releasing: $ENV_NAME is held by $(field ticket), not $ticket"; return 0
  fi
  rm -f "$LOCK"
  mutex_unlock
  echo "released $ENV_NAME ($ticket)"
}

status() {
  local e
  for e in $ENVS; do
    use_env "$e"
    if [ -f "$LOCK" ]; then print_holder; else echo "$ENV_NAME is free"; fi
  done
}

case "${1:-}" in
  acquire) [ $# -eq 3 ] || { echo "usage: $0 acquire <TICKET> <WORKTREE>" >&2; exit 2; }; acquire "$2" "$3" ;;
  which)   [ $# -eq 2 ] || { echo "usage: $0 which <TICKET>" >&2; exit 2; }; which_env "$2" ;;
  check)   [ $# -eq 2 ] || { echo "usage: $0 check <TICKET>" >&2; exit 2; }; check "$2" ;;
  release) [ $# -eq 2 ] || { echo "usage: $0 release <TICKET>" >&2; exit 2; }; release "$2" ;;
  status)  status ;;
  *) echo "usage: $0 acquire <TICKET> <WORKTREE> | which <TICKET> | check <TICKET> | release <TICKET> | status" >&2; exit 2 ;;
esac
