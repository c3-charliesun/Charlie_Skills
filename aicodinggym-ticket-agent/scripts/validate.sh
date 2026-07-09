#!/usr/bin/env bash
# Validate AICodingGym ticket-agent naming rules (see ../SKILL.md).
#
#   scripts/validate.sh branch [name]      # default: current git branch
#   scripts/validate.sh commit [message]   # default: latest commit subject

set -euo pipefail

BRANCH_RE='^agent/KAN-[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$'
COMMIT_RE='^KAN-[0-9]+: .+'

usage() {
  echo "usage: validate.sh branch [name] | commit [message]" >&2
  exit 2
}

[ $# -ge 1 ] || usage
mode=$1
shift || true

case "$mode" in
  branch)
    if [ $# -ge 1 ]; then
      branch=$1
    else
      branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) \
        || { echo "not in a git repo - pass the branch name explicitly" >&2; exit 2; }
    fi
    if [[ "$branch" =~ $BRANCH_RE ]]; then
      echo "OK  branch: $branch"
    else
      echo "BAD branch: $branch" >&2
      echo "    expected: agent/KAN-<id>-<short-slug>" >&2
      echo "    e.g. agent/KAN-123-fix-login-redirect" >&2
      exit 1
    fi
    ;;
  commit)
    if [ $# -ge 1 ]; then
      msg=$1
    else
      msg=$(git log -1 --format=%s 2>/dev/null) \
        || { echo "not in a git repo - pass the commit message explicitly" >&2; exit 2; }
    fi
    subject=${msg%%$'\n'*}
    if [[ "$subject" =~ $COMMIT_RE ]]; then
      echo "OK  commit: $subject"
    else
      echo "BAD commit: $subject" >&2
      echo "    expected: KAN-<id>: <imperative summary>" >&2
      echo "    e.g. KAN-123: fix login redirect" >&2
      exit 1
    fi
    ;;
  *)
    usage
    ;;
esac
