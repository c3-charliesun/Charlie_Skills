#!/usr/bin/env bash
# Review-log helper for the pr-reviewer skill (see ../SKILL.md, ../REFERENCE.md).
#
#   review-log.sh append --pr <n> --title <t> --author <a> --verdict <V> \
#                 [--blocking <n>] [--minor <n>] [--note <text>]
#       Computes round (prior lines for this PR + 1), stamps UTC ts, escapes all
#       fields, and appends one JSON object to review-log.jsonl.
#
#   review-log.sh stats
#       Per-PR aggregation: rounds, verdicts, total blocking — sorted by rounds desc.
#
# Log lives at review-log.jsonl in the skill directory (sibling of scripts/).
# Append ONLY for submitted reviews — never deferrals, skips, or unsent drafts.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 3; }

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
LOG="$SCRIPT_DIR/../review-log.jsonl"

usage() {
  echo "usage: review-log.sh append --pr <n> --title <t> --author <a> --verdict <APPROVE|REQUEST_CHANGES|COMMENT> [--blocking <n>] [--minor <n>] [--note <text>]" >&2
  echo "       review-log.sh stats" >&2
  exit 2
}

is_int() { [[ "$1" =~ ^[0-9]+$ ]]; }

[ $# -ge 1 ] || usage
mode=$1; shift || true

case "$mode" in
  append)
    pr="" title="" author="" verdict="" blocking=0 minor=0 note=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --pr)       pr=$2;       shift 2 ;;
        --title)    title=$2;    shift 2 ;;
        --author)   author=$2;   shift 2 ;;
        --verdict)  verdict=$2;  shift 2 ;;
        --blocking) blocking=$2; shift 2 ;;
        --minor)    minor=$2;    shift 2 ;;
        --note)     note=$2;     shift 2 ;;
        *) echo "unknown flag: $1" >&2; usage ;;
      esac
    done

    [ -n "$pr" ] && [ -n "$title" ] && [ -n "$author" ] && [ -n "$verdict" ] || usage
    is_int "$pr"       || { echo "--pr must be an integer" >&2; exit 2; }
    is_int "$blocking" || { echo "--blocking must be an integer" >&2; exit 2; }
    is_int "$minor"    || { echo "--minor must be an integer" >&2; exit 2; }
    case "$verdict" in
      APPROVE|REQUEST_CHANGES|COMMENT) ;;
      *) echo "--verdict must be APPROVE, REQUEST_CHANGES, or COMMENT" >&2; exit 2 ;;
    esac

    # round = prior submitted lines for this PR + 1
    if [ -f "$LOG" ]; then
      prior=$(jq -c "select(.pr == $pr)" "$LOG" 2>/dev/null | wc -l | tr -d ' ')
    else
      prior=0
    fi
    round=$((prior + 1))
    ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    jq -nc \
      --arg    ts "$ts" \
      --argjson pr "$pr" \
      --arg    title "$title" \
      --arg    author "$author" \
      --arg    verdict "$verdict" \
      --argjson round "$round" \
      --argjson blocking "$blocking" \
      --argjson minor "$minor" \
      --arg    note "$note" \
      '{ts:$ts, pr:$pr, title:$title, author:$author, verdict:$verdict, round:$round, blocking:$blocking, minor:$minor, note:$note}' \
      >> "$LOG"

    echo "logged: PR #$pr round $round ($verdict) → $LOG"
    ;;

  stats)
    [ -f "$LOG" ] || { echo "[]"; exit 0; }
    jq -s 'group_by(.pr)
           | map({pr: .[0].pr, title: .[0].title, rounds: length,
                  verdicts: map(.verdict), blocking: (map(.blocking) | add)})
           | sort_by(-.rounds)' "$LOG"
    ;;

  *)
    usage
    ;;
esac
