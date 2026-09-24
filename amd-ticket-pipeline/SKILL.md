---
name: amd-ticket-pipeline
description: >-
  Drive an AMD pricing ticket (C3PRICING / APO) from intake to an open PR — find or create
  the APO mirror, populate it, present a run plan, implement on a worktree, build + lint +
  code-review, push, and open a PR (no reviewers, "dont merge" label). Use when Charlie starts
  work on a C3PRICING or APO ticket in the c3amdpo repo. Invoke with either a C3PRICING id
  (e.g. C3PRICING-339) or an APO id (e.g. APO-1199).
---

# AMD ticket → PR pipeline

Single-invocation pipeline for the repeating c3amdpo workflow: intake → APO mirror → plan → implement →
validate → open PR. Pause at the two 🔒 gates (run plan, push) for explicit approval; track state in `bob-tasks` so a ticket
resumes across sessions. Invoke with either id, e.g. `amd-ticket-pipeline C3PRICING-339` or `APO-1199`.

## Hard rules

1. **Branch naming — NO SLUG.** Exactly `<type>/cs/APO-<id>` (e.g. `bugfix/cs/APO-1199`); `<type>` ∈
   {feature, bugfix, fix, hotfix, perf}. Never append a slug — `bugfix/cs/APO-1177`, NOT
   `bugfix/cs/APO-1177-quote-status-filters` — even if old `docs/specs/` or `fix/hg/APO-xxxx-slug`
   examples do. Check: `scripts/validate.sh branch`.
2. **APO = Atlassian MCP. Browser only as a last resort.** Every APO operation — read, search, create,
   update, transition, comment, link — MUST go through the Atlassian MCP tools (`getJiraIssue`,
   `searchJiraIssuesUsingJql`, `createJiraIssue`, `editJiraIssue`, `transitionJiraIssue`,
   `addCommentToJiraIssue`, `createIssueLink`, …). Never drive the browser on `c3energy.atlassian.net`.
   The browser (`browser` agent / Playwright) is for C3PRICING (`ontrack.amd.com`, AMD Okta — no MCP),
   and only when you truly must. Read APO first via the MCP; fetch C3PRICING via the browser only when
   APO is thin or no mirror exists.
3. **Approval gates — exactly two.** Wait for explicit approval at the **run plan** (Step 4, before any
   code) and the **push** (Step 6). Everything else runs unattended: creating APO tickets, updating their
   bodies, transitioning them, and opening the PR all proceed without asking. Report each with a link
   right after doing it — ungated means unblocking, not silent, so Charlie can still follow the trail.
   Push stays gated because it's the last point where a human sees the change before it leaves the
   machine and, via the now-automatic PR, reaches the team.
4. **Commit format:** `APO-<id> (C3PRICING-<id>): <imperative description>`. Check: `scripts/validate.sh commit`.
5. **Never reopen a closed/done ticket.** Re-fix of already-shipped work (mirror is Done, its PR merged,
   or Charlie says it's a bug from a previous ticket) → create a **NEW** APO ticket linked to both the
   old APO and the C3PRICING ticket.
6. **Merging — squash only, then close the ticket.** If Charlie asks to merge the PR, always squash
   merge it. Immediately after the merge lands, transition the APO ticket to **"Done"**
   (`getTransitionsForJiraIssue` → `transitionJiraIssue`).
7. **Post-PR ticket refresh — optional.** Right after Step 7 opens the PR and transitions the ticket to
   "In Review", reconsider the APO title/description: update them if the scope drifted during
   implementation or if something important surfaced worth recording (a root cause, a scope-out
   decision, a follow-up). If nothing changed, skip it — don't edit just to have edited.

## Pipeline

**Entry — resolve tickets cheaply.** APO id → read it (MCP); if it has full context (description +
acceptance criteria), skip C3PRICING. C3PRICING id → search APO for the mirror by key/link; use it if
sufficient. Browser only as last resort (Rule 2).

**1–2. APO mirror.** Search APO for a mirror by the C3PRICING key/link:
- Found, still open → use it. Found but resolved (Rule 5) → create a NEW linked ticket. Missing → create it.
- Create shape: title, body, link to C3PRICING, assignee = Charlie. Leave issue type / priority /
  epic / labels unset — those follow team conventions you can't reliably infer, and a wrong value is
  more work to undo than an empty one is to fill in.
- Create it without asking, then transition to **"In Progress"** (`getTransitionsForJiraIssue` →
  `transitionJiraIssue`) and post the ticket link in chat.

**3. Populate the APO body.** Draft the body in the house format below (inferred once from the last 10
APO tickets — don't re-infer it) from the C3PRICING content, and apply it. No approval needed — APO
edits are cheap to revise. Summarize what you wrote in chat.

APO body template — omit a section if it doesn't apply yet (e.g. Root Cause before investigation), but
keep the section order:

```markdown
## Context / Source

Mirror of [C3PRICING-<id>](https://ontrack.amd.com/browse/C3PRICING-<id>) (<priority/severity>,
reported by <reporter>). <Verbatim or paraphrased AMD ask.> <If Rule 5 applies: note the prior mirror
and that it's Done, linked below.>

## Root cause

<Where in the code the behavior lives and why — cite files/functions. Fill in once investigated; skip
this section in the first draft if intake hasn't reached implementation yet.>

## Scope — in

<Numbered, concrete list of the changes this ticket covers.>

## Scope — out

<Bulleted list of explicitly excluded items — cite tickets/lines for anything carved out elsewhere.>

## Acceptance criteria

<Bulleted, independently-verifiable checklist.>

## Refs

<Bulleted file paths touched/relevant, plus related or prior ticket links.>
```

**4. Run plan.** Present in chat only — no file. 🔒 Design checkpoint; no code until approved.

**5. Implement.** Create worktree + branch `<type>/cs/APO-<id>` off `develop` (Rule 1;
`scripts/validate.sh branch`); implement there. For tests, use the relevant C3 skills (`c3-testing` + the
domain skill) and mimic the repo's existing tests (`test/js-rhino/**`, `test/py/**`). Tests are authored
here but run by CI — not locally, not against an env.

**6. Pre-push gate.** From `amdpo/amdPoUI/react`: `npm run build` + `npm run lint` (confirm script
names in `package.json`) and `c3-code-review` on the diff — fix all errors. Then self-review the diff
against the shared **C3-REVIEW-CHECKLIST.md** (skills-repo root — `Charlie_Skills/C3-REVIEW-CHECKLIST.md`;
the same checklist pr-reviewer applies). `c3-code-review`'s ruleset skips `.py` and `react/**/*.tsx`, so
hand-check the **[PY]** and **[TSX]** items there yourself — fix all findings. Commit (Rule 4;
`scripts/validate.sh commit`). 🔒 Push on approval.

**7. Open the PR — then stop.** Regular (non-draft) PR, no reviewers, label **`dont merge`** (exact —
no apostrophe), assignee = Charlie, base = `develop`. Body: use the template below (inferred once from
Charlie's recent PRs — don't re-infer it). Open it without asking — the Step 6 push approval covers
this, since the `dont merge` label means an open PR can't land on its own. Once open, transition the
APO ticket to **"In Review"** (same mechanism as Step 1–2), then apply Rule 7 (optional title/description
refresh). The pipeline **ends here** — no build polling; do not schedule a wakeup.

PR body template — omit a section if it doesn't apply (e.g. no separate Scope — out), but keep the
section order:

```markdown
## What

<Narrative: what was broken/missing and why, in the surface's own terms, then a bulleted list of the
concrete changes, one bullet per file, **bold the filename** first.>

## Why

Mirror of [C3PRICING-<id>](https://ontrack.amd.com/browse/C3PRICING-<id>) (<priority>). <Reporter /
context that motivated the fix.> <If Rule 5 applies: note the prior mirror.>

## Scope — out

<Bulleted list of what this PR deliberately does not touch, with ticket refs where relevant.>

## Refs

* [APO-<id>](https://c3energy.atlassian.net/browse/APO-<id>) · [C3PRICING-<id>](https://ontrack.amd.com/browse/C3PRICING-<id>) · <related/prior tickets>
* <file paths touched>

## Test plan

* [x]/[ ] <build/lint status, added/updated automated tests and where they run (CI vs. locally),
  manual verification against real data, and any post-merge manual check still needed>
```

## Environment access

c3auth token lives in `amdpo/amdPoUI/react/.env`, key `VITE_REACT_C3_AUTH` (bound to env `charlieamdpo03`
on `stgazamd2.c3.ai` — Charlie's personal testing ground; read/write/delete freely there). Never commit
it, never echo the raw value. Expired (401/403) → ask Charlie for a fresh one.

## State tracking

One `bob-tasks` entry per ticket: `add` on start (`--refs`: APO id, C3PRICING id, branch, PR# once open);
`update`/`note` as steps complete or block; on PR open, `update --status` with the PR link.

## Reference values

| Thing | Value |
| --- | --- |
| Repo | `/Users/Charlie.Sun/Desktop/c3amdpo` |
| Frontend dir | `amdpo/amdPoUI/react` (Vite; build = `npm run build`, lint = `npm run lint`) |
| Base branch | `develop` |
| Branch pattern | `<type>/cs/APO-<id>` — **no slug** (`scripts/validate.sh branch`) |
| Commit format | `APO-<id> (C3PRICING-<id>): <desc>` (`scripts/validate.sh commit`) |
| Approval gates | run plan (Step 4) + push (Step 6) — nothing else |
| PR labels | `dont merge` (exact — no apostrophe) |
| Merge | squash only, on Charlie's request → then transition APO to Done (Rule 6) |
| Review checklist | `Charlie_Skills/C3-REVIEW-CHECKLIST.md` (shared with pr-reviewer; Step 6 self-review) |
| C3PRICING | `ontrack.amd.com` (AMD Okta → `browser` agent / Playwright — last resort, no MCP) |
| APO | `c3energy.atlassian.net` — **Atlassian MCP only, never the browser** |
