# PR Reviewer — Reference

Lookups for the `pr-reviewer` skill: the full review checklist and exact output templates.
SKILL.md holds the operational flow and points here for the details.

## Review checklist (Step 2d)

The correctness + C3-conventions checklist is the shared **[C3-REVIEW-CHECKLIST.md](../C3-REVIEW-CHECKLIST.md)**
(skills-repo root — `Charlie_Skills/C3-REVIEW-CHECKLIST.md`), one source of truth shared with the
amd-ticket-pipeline author-time gate. Mark each item ✅ / ⚠️ (minor, non-blocking) / ❌ (blocking),
with a one-line note for each non-✅. Correctness is the primary focus.

## Output templates

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
