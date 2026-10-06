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

Single-invocation pipeline: intake → APO mirror → plan → implement → validate → open PR. Pause at the
two 🔒 gates (run plan, push) for explicit approval.

## Hard rules

1. **Approval gates — exactly two.** Wait for explicit approval at the **run plan** (Step 3, before any
   code) and the **push** (Step 5). Everything else runs unattended: creating APO tickets, updating their
   bodies, transitioning them, and opening the PR all proceed without asking. Report each with a link
   right after doing it — ungated means unblocking, not silent, so Charlie can still follow the trail.
2. **APO = Atlassian MCP, never the browser.** Every APO operation — read, search, create, update,
   transition, comment, link — goes through the Atlassian MCP tools. The browser is only for C3PRICING
   (`ontrack.amd.com`, AMD Okta — no MCP), and only when APO is thin or no mirror exists.
3. **Repo conventions first.** Follow the c3amdpo `CLAUDE.md` for branch name, commit message, PR title,
   and PR description sections. This skill does not restate them.
4. **Never reopen a closed/done ticket.** Re-fix of already-shipped work (mirror is Done, its PR merged,
   or Charlie says it's a bug from a previous ticket) → create a **NEW** APO ticket linked to both the
   old APO and the C3PRICING ticket.

## Pipeline

**Entry.** APO id → read it; if it has full context (description + acceptance criteria), skip C3PRICING.
C3PRICING id → search APO for the mirror by key/link; use it if sufficient.

**1. Find or create the APO mirror.** Search APO by the C3PRICING key/link:
- Found, still open → use it. Found but resolved (Rule 4) → create a NEW linked ticket. Missing → create it.
- Create shape: title, body, link to C3PRICING, assignee = Charlie. Leave issue type / priority /
  epic / labels unset — those follow team conventions you can't reliably infer, and a wrong value is
  more work to undo than an empty one is to fill in.

**2. In Progress + populate.** Transition the ticket to **"In Progress"** and post the link in chat. Then
write the body from the C3PRICING content using the template below and summarize it in chat. Omit a
section if it doesn't apply yet (e.g. Root cause before investigation), but keep the order.

```markdown
## Context / Source

Mirror of [C3PRICING-<id>](https://ontrack.amd.com/browse/C3PRICING-<id>) (<priority/severity>,
reported by <reporter>). <AMD ask.> <If Rule 4 applies: note the prior mirror, linked below.>

## Root cause

<Where in the code the behavior lives and why — cite files/functions.>

## Scope — in

<Numbered, concrete list of the changes.>

## Scope — out

<Bulleted list of explicit exclusions, with ticket refs for anything carved out elsewhere.>

## Acceptance criteria

<Bulleted, independently-verifiable checklist.>

## Refs

<File paths touched/relevant, plus related or prior ticket links.>
```

**3. Run plan.** Present in chat only — no file. 🔒 Design checkpoint; no code until approved.

**4. Implement.** Fetch `develop`, then create a worktree + branch off `origin/develop` (Rule 3); implement
there. For tests, use the relevant C3 skills (`c3-testing` + the domain skill) and mimic the repo's
existing tests (`test/js-rhino/**`, `test/py/**`). Tests are authored here but run by CI — not locally.

**5. 🔒 Push gate → validate, commit, push.** From `amdpo/amdPoUI/react` run `npm run build` +
`npm run lint`, then `c3-code-review` on the diff. `c3-code-review` skips `.py` and `react/**/*.tsx`, so
also self-review the diff against `C3-REVIEW-CHECKLIST.md` (skills-repo root; the same checklist
pr-reviewer uses), hand-checking the **[PY]** and **[TSX]** items. Fix all findings, commit, and push
once Charlie approves.

**6. Open the PR.** Regular (non-draft) PR against `develop`, no reviewers, assignee = Charlie, label
**`dont merge`** (exact — no apostrophe), title/body per Rule 3 with links to the APO and C3PRICING
tickets. Once open, transition the APO ticket to **"In Review"**. If scope drifted or something worth
recording surfaced (root cause, scope-out decision, follow-up), update the APO title/description;
otherwise skip. The pipeline **ends here** — no build polling; do not schedule a wakeup.

**Merge — only when Charlie says so.** Always squash-merge, then transition the APO ticket to **"Done"**.

## Environment access

The c3auth token lives in `amdpo/amdPoUI/react/.env`, key `VITE_REACT_C3_AUTH` (env `charlieamdpo03` on
`stgazamd2.c3.ai` — Charlie's personal testing ground; read/write/delete freely there). Never commit it,
never echo the raw value. Expired (401/403) → ask Charlie for a fresh one.
