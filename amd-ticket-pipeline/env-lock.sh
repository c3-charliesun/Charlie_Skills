#!/usr/bin/env bash
# env-lock.sh — one-agent-at-a-time lock on a personal C3 env (default charlieamdpo03).
#
#   env-lock.sh acquire <TICKET> <WORKTREE>   exit 0 = you hold it, 1 = busy or lost (prints why)
#   env-lock.sh check   <TICKET>              exit 0 = <TICKET> still holds it, 1 = it doesn't
#   env-lock.sh release <TICKET>              exit 0 = released (or already free), 1 = not yours
#   env-lock.sh status                        prints holder, or "free"
#
# How it stays safe with many agents:
#   - Taking a FREE lock: the lock is written in full to a temp file, then hard-linked into place
#     with `ln`, which fails if a lock already exists. So "is it free?" and "take it" are one atomic
#     step, and nobody ever reads a half-written lock.
#   - Changing an EXISTING lock (refresh, stale takeover, release) happens only while holding a
#     short-lived mutex (`mkdir $LOCK.mutex`, held for milliseconds). Under the mutex nobody else can
#     replace or delete the lock, so "is it still the lock I read (same nonce)?" followed by
#     "replace it" (atomic rename) or "delete it" cannot be interleaved with another agent.
#   - Re-acquiring with the same ticket refreshes the timestamp. A lock older than
#     ENV_LOCK_TTL_HOURS (default 6) is stale and gets taken over.

set -u
ENV_NAME="${ENV_LOCK_ENV:-charlieamdpo03}"
LOCK_DIR="${ENV_LOCK_DIR:-$HOME/.c3amdpo/locks}"
TTL_HOURS="${ENV_LOCK_TTL_HOURS:-6}"
LOCK="$LOCK_DIR/$ENV_NAME.lock"
MUTEX="$LOCK.mutex"

field() { sed -n "s/^$1=//p" "${2:-$LOCK}" 2>/dev/null | head -1; }
mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }

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

acquire() {
  local ticket="$1" worktree="$2" try holder nonce at age tmp
  mkdir -p "$LOCK_DIR"
  for try in 1 2 3 4 5; do
    if create_lock "$ticket" "$worktree"; then echo "acquired $ENV_NAME for $ticket"; return 0; fi
    holder="$(field ticket)"; nonce="$(field nonce)"; at="$(field acquired_at)"
    [ -n "$nonce" ] || continue                      # released between our two reads — retry
    age=$(( $(date +%s) - at ))
    if [ "$holder" != "$ticket" ] && [ "$age" -lt $(( TTL_HOURS * 3600 )) ]; then break; fi

    # Ours to refresh, or stale to take over: replace it under the mutex.
    mutex_lock || break
    if [ "$(field nonce)" != "$nonce" ]; then mutex_unlock; continue; fi   # changed — look again
    tmp="$(new_lock_file "$ticket" "$worktree")" && mv -f "$tmp" "$LOCK"
    mutex_unlock
    if [ "$holder" = "$ticket" ]; then echo "already held by $ticket — timestamp refreshed"
    else echo "took over STALE lock from $holder (held $((age / 3600))h) — acquired $ENV_NAME for $ticket"; fi
    return 0
  done
  print_holder; return 1
}

check() {
  if [ "$(field ticket)" = "$1" ]; then echo "$1 holds $ENV_NAME"; return 0; fi
  if [ -f "$LOCK" ]; then echo "LOST: $1 no longer holds $ENV_NAME — $(print_holder)"
  else echo "LOST: $1 no longer holds $ENV_NAME — it is free"; fi
  return 1
}

release() {
  local ticket="$1"
  mutex_lock || return 1
  if [ ! -f "$LOCK" ]; then mutex_unlock; echo "$ENV_NAME is already free"; return 0; fi
  if [ "$(field ticket)" != "$ticket" ]; then
    mutex_unlock; echo "not releasing: $ENV_NAME is held by $(field ticket), not $ticket"; return 1
  fi
  rm -f "$LOCK"
  mutex_unlock
  echo "released $ENV_NAME ($ticket)"
}

status() {
  if [ -f "$LOCK" ]; then print_holder; else echo "free"; fi
}

case "${1:-}" in
  acquire) [ $# -eq 3 ] || { echo "usage: $0 acquire <TICKET> <WORKTREE>" >&2; exit 2; }; acquire "$2" "$3" ;;
  check)   [ $# -eq 2 ] || { echo "usage: $0 check <TICKET>" >&2; exit 2; }; check "$2" ;;
  release) [ $# -eq 2 ] || { echo "usage: $0 release <TICKET>" >&2; exit 2; }; release "$2" ;;
  status)  status ;;
  *) echo "usage: $0 acquire <TICKET> <WORKTREE> | check <TICKET> | release <TICKET> | status" >&2; exit 2 ;;
esac
