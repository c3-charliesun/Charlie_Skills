# PR Reviewer — Reference

Lookups for the `pr-reviewer` skill: the full review checklist, exact output templates, and the
review-log schema. SKILL.md holds the operational flow and points here for the details.

## Review checklist (Step 2d)

The correctness + C3-conventions checklist is the shared **[C3-REVIEW-CHECKLIST.md](../C3-REVIEW-CHECKLIST.md)**
(skills-repo root — `Charlie_Skills/C3-REVIEW-CHECKLIST.md`), one source of truth shared with the
amd-ticket-pipeline author-time gate. Mark each item ✅ / ⚠️ (minor, non-blocking) / ❌ (blocking),
with a one-line note for each non-✅. Correctness is the primary focus.

## Output templates

### Queue Status Table (Step 1)

One markdown table covering *every* PR, finished and unfinished. Re-print at every cycle start and
after each submitted review.

```markdown
## Queue Status — <date/time>

| # | PR    | Title                          | Author      | Build   | Status                          |
|---|-------|--------------------------------|-------------|---------|---------------------------------|
| 1 | #1234 | [APO-456] Fix null ref         | c3-pradeepj | 🟢 Green | ⏳ Queued — reviewing first     |
| 2 | #1236 | [APO-459] Refactor Snowflake   | c3-venkata  | 🔴 Red   | ⏳ Queued — after greens        |
| 3 | #1230 | [APO-450] Update Deal schema   | c3-mike     | 🟢 Green | ✅ Done — reviewed 2d ago, watching |

Queue: 2 to review (1 green, 1 red) · 0 drafts pending · 1 done/watching
```

Status values: `✅ Done — submitted this cycle` · `✅ Done — reviewed <when>, watching` ·
`📝 Draft pending approval` · `⏳ Queued` (+ order note) ·
`⏸ Deferred — test-syntax finding, CI pending` · `⛔ Skipped`.

### Conflict Check (Step 2c)

```text
### Conflict Check
PRs scanned: <n>  |  Conflicts found: <n>

| PR    | Author  | Overlapping files         | Risk   |
|-------|---------|---------------------------|--------|
| #1004 | harshal | src/Foo.c3typ, src/Foo.js | High   |

High = same file(s), merge conflict likely · Medium = related type/impl pair · Low = peripheral only (tests, seed)
```

If none: `No other open PRs touch the same files.` **High/Medium conflicts MUST also appear in the
Step 3 review comment** as a `### Merge conflict heads-up` section; Low may stay triage-only.

## Review log (schema & analytics)

Log file: `review-log.jsonl` in the skill directory (append-only, one JSON object per line).
Append **only** for submitted reviews — auto-APPROVE or approved REQUEST_CHANGES/COMMENT — never
deferrals, skips, or unsent drafts. Use the helper, which computes `round`, stamps the UTC `ts`,
and escapes every field:

```bash
scripts/review-log.sh append --pr 1234 --title "[APO-456] Fix null ref" \
  --author c3-pradeepj --verdict REQUEST_CHANGES --blocking 2 --minor 1 \
  --note "missing fetch include; bad test syntax fixed after CI fail"
```

Schema:

| field | meaning |
|-------|---------|
| `ts` | UTC ISO 8601 at submission time (set by the script) |
| `pr` | PR number |
| `title` / `author` | PR title and GitHub login |
| `verdict` | `APPROVE` / `REQUEST_CHANGES` / `COMMENT` |
| `round` | prior log lines for this PR + 1 (re-reviews increment it; set by the script) |
| `blocking` / `minor` | final ❌ / ⚠️ counts from the checklist |
| `note` | one-line gist of the main findings (empty string for a clean APPROVE) |

Analytics — per-PR rounds, verdicts, and total blocking, sorted by rounds:

```bash
scripts/review-log.sh stats
```
