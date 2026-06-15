#!/usr/bin/env bash
# Validate AMD ticket-pipeline naming rules (see ../SKILL.md, Rules 1 & 5).
#
#   scripts/validate.sh branch [name]      # default: current git branch
#   scripts/validate.sh commit [message]   # default: latest commit subject
#
# Exit codes: 0 valid, 1 invalid, 2 usage / not-in-repo.

set -euo pipefail

# Rule 1: <type>/cs/APO-<id>, type ∈ {feature,bugfix,fix,hotfix,perf}, NO slug after the id.
BRANCH_RE='^(feature|bugfix|fix|hotfix|perf)/cs/APO-[0-9]+$'
# Rule 5: APO-<id> (C3PRICING-<id>): <imperative description>
COMMIT_RE='^APO-[0-9]+ \(C3PRICING-[0-9]+\): .+'

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
        || { echo "not in a git repo — pass the branch name explicitly" >&2; exit 2; }
    fi
    if [[ "$branch" =~ $BRANCH_RE ]]; then
      echo "OK  branch: $branch"
    else
      echo "BAD branch: $branch" >&2
      echo "    expected <type>/cs/APO-<id> with NO slug; <type> ∈ feature|bugfix|fix|hotfix|perf" >&2
      echo "    e.g. bugfix/cs/APO-1199   (NOT bugfix/cs/APO-1199-quote-status-filters)" >&2
      exit 1
    fi
    ;;
  commit)
    if [ $# -ge 1 ]; then
      msg=$1
    else
      msg=$(git log -1 --format=%s 2>/dev/null) \
        || { echo "not in a git repo — pass the commit message explicitly" >&2; exit 2; }
    fi
    subject=${msg%%$'\n'*}   # subject line only
    if [[ "$subject" =~ $COMMIT_RE ]]; then
      echo "OK  commit: $subject"
    else
      echo "BAD commit: $subject" >&2
      echo "    expected: APO-<id> (C3PRICING-<id>): <imperative description>" >&2
      echo "    e.g. APO-1199 (C3PRICING-339): add quote status filter" >&2
      exit 1
    fi
    ;;
  *)
    usage
    ;;
esac
