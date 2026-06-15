---
name: amd-ticket-pipeline
description: >-
  Drive an AMD pricing ticket (C3PRICING / APO) from intake to a draft PR — find or create
  the APO mirror, populate it, present a run plan, implement on a worktree, build + lint +
  code-review, push, screenshot-verify frontend-only changes, and open a draft PR. Use when Charlie starts
  work on a C3PRICING or APO ticket in the c3amdpo repo. Invoke with either a C3PRICING id
  (e.g. C3PRICING-339) or an APO id (e.g. APO-1199).
---

# AMD ticket → PR pipeline

Single-invocation pipeline for the repeating c3amdpo workflow: intake → APO mirror → plan → implement →
validate → draft PR. Pause at every 🔒 gate for explicit approval; track state in `bob-tasks` so a ticket
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
3. **Approval gates.** Draft → show → wait for explicit approval before any egress: creating the APO
   mirror, updating the APO body, pushing, opening the PR.
4. **Attribution.** End outgoing text (APO body, PR body) with, after a blank line:
   `_Drafted by Bob, reviewed by Charlie Sun_`.
5. **Commit format:** `APO-<id> (C3PRICING-<id>): <imperative description>`. Check: `scripts/validate.sh commit`.
6. **Never reopen a closed/done ticket.** Re-fix of already-shipped work (mirror is Done, its PR merged,
   or Charlie says it's a bug from a previous ticket) → create a **NEW** APO ticket linked to both the
   old APO and the C3PRICING ticket.

## Pipeline

**Entry — resolve tickets cheaply.** APO id → read it (MCP); if it has full context (description +
acceptance criteria), skip C3PRICING. C3PRICING id → search APO for the mirror by key/link; use it if
sufficient. Browser only as last resort (Rule 2).

**1–2. APO mirror.** Search APO for a mirror by the C3PRICING key/link:
- Found, still open → use it. Found but resolved (Rule 6) → create a NEW linked ticket. Missing → create it.
- Create shape: title, body, link to C3PRICING, assignee = Charlie. Do NOT infer issue type / priority /
  epic / labels. 🔒 Show draft, create on approval.
- Right after creating, transition to **"In Progress"** (`getTransitionsForJiraIssue` →
  `transitionJiraIssue`; no extra approval — part of the approved creation).

**3. Populate the APO body.** Fetch the last 10 APO ticket bodies, infer the house format, draft the body
from the C3PRICING content (+ attribution). 🔒 Update on approval.

**4. Run plan.** Present in chat only — no file. 🔒 Design checkpoint; no code until approved.

**5. Implement.** Create worktree + branch `<type>/cs/APO-<id>` off `develop` (Rule 1;
`scripts/validate.sh branch`); implement there. For tests, use the relevant C3 skills (`c3-testing` + the
domain skill) and mimic the repo's existing tests (`test/js-rhino/**`, `test/py/**`). Tests are authored
here but run by CI — not locally, not against an env.

**6. Pre-push gate.** From `amdpo/amdPoUI/react`: `npm run build` + `npm run lint` (confirm script
names in `package.json`) and `c3-code-review` on the diff — fix all errors. Then self-review the diff
against the shared **C3-REVIEW-CHECKLIST.md** (skills-repo root — `Charlie_Skills/C3-REVIEW-CHECKLIST.md`;
the same checklist pr-reviewer applies). `c3-code-review`'s ruleset skips `.py` and `react/**/*.tsx`, so
hand-check the **[PY]** and **[TSX]** items there yourself — fix all findings. Commit (Rule 5;
`scripts/validate.sh commit`). 🔒 Push on approval.

**6b. Frontend screenshot verification — frontend-only diffs.** Only when the diff is confined to the
frontend (`amdpo/amdPoUI/react` — `.tsx`/`.ts`/styles, with **no** `.c3typ`/`.py`/src `.js`/seed/metadata
changes). If the diff includes **any** backend change, **skip this step** — a preview build can't
exercise backend behavior. For a frontend-only diff: `npm run build`, then serve the bundle with
`vite preview` (`npm run preview`; confirm the script name in `package.json`, uses the `.env` token) —
**not** `npm run dev`. Point the `browser` agent / Playwright at the preview URL, exercise the affected
screen(s), and capture screenshots (before/after where a baseline is easy), verifying each against the
actual pixels. **Good** → embed the screenshots in the PR body (Step 7). **Not good** → fix the code and
re-run Step 6. Stop the preview server when done.

**7. Open the PR — then stop.** Draft PR, no reviewers, **"don't merge"** label, assignee = Charlie,
base = `develop`. Body: infer format from Charlie's recent PRs (what / why + links to both tickets +
attribution). 🔒 Show title/body/label/base, open on approval. For a frontend-only PR, embed the Step 6b
screenshots **via Playwright** — `gh` can't attach local images, so after the PR is open, drive the
`browser` agent to it, edit the description, drag/drop the screenshot files into the GitHub editor (it
uploads them to `user-attachments` and inserts the markdown), and save. Once open, transition the APO
ticket to **"In Review"** (same mechanism as Step 1–2). The pipeline **ends here** — no build polling;
do not schedule a wakeup.

## Environment access

c3auth token lives in `amdpo/amdPoUI/react/.env`, key `VITE_REACT_C3_AUTH` (bound to env `charlieamdpo02`
on `stgazamd2.c3.ai`). Never commit it, never echo the raw value. Expired (401/403) → ask Charlie for a
fresh one.

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
| Review checklist | `Charlie_Skills/C3-REVIEW-CHECKLIST.md` (shared with pr-reviewer; Step 6 self-review) |
| C3PRICING | `ontrack.amd.com` (AMD Okta → `browser` agent / Playwright — last resort, no MCP) |
| APO | `c3energy.atlassian.net` — **Atlassian MCP only, never the browser** |
| Attribution | `_Drafted by Bob, reviewed by Charlie Sun_` |
