---
name: amd-ticket-pipeline
description: >-
  Drive an AMD pricing ticket (C3PRICING / APO) from intake to a draft PR — find or create
  the APO mirror, populate it, present a run plan, implement on a worktree, build + lint +
  code-review, push, poll the Jarvis build, and open a draft PR. Use when Charlie starts
  work on a C3PRICING or APO ticket in the c3amdpo repo. Invoke with either a C3PRICING id
  (e.g. C3PRICING-339) or an APO id (e.g. APO-1199).
---

# AMD ticket → PR pipeline

Single-invocation pipeline for the repeating c3amdpo workflow: intake a ticket, mirror it to
APO, plan, implement, validate, open a draft PR. Pause at every 🔒 gate for explicit
approval. Record state in `bob-tasks` so a ticket can resume across sessions.

Invoke with either id: `amd-ticket-pipeline C3PRICING-339` or `amd-ticket-pipeline APO-1199`.

## Hard rules

1. **Branch naming — NO SLUG.** Exactly `<type>/cs/APO-<id>` (e.g. `bugfix/cs/APO-1199`);
   `<type>` ∈ {feature, bugfix, fix, hotfix, perf}. Never append a slug — it's
   `bugfix/cs/APO-1177`, NOT `bugfix/cs/APO-1177-quote-status-filters` — even if old
   `docs/specs/` files or `fix/hg/APO-xxxx-slug` examples do.
2. **Minimize C3PRICING fetches.** C3PRICING (`ontrack.amd.com`, AMD Okta) needs the
   `browser` agent — slow. APO (`c3energy.atlassian.net`, Atlassian MCP) is fast. Always
   read APO first; fetch C3PRICING only when APO is thin or no mirror exists yet.
3. **Approval gates.** Draft → show → wait for explicit approval before any egress: creating
   the APO mirror, updating the APO body, pushing, opening the PR.
4. **Attribution.** End outgoing text (APO body, PR body) with, after a blank line:
   `_Drafted by Bob, reviewed by Charlie Sun_`.
5. **Commit format:** `APO-<id> (C3PRICING-<id>): <imperative description>`.
6. **Never reopen a closed/done ticket.** Re-fix of already-shipped work (mirror is Done,
   its PR merged, or Charlie says it's a bug from a previous ticket) → create a **NEW** APO
   ticket linked to both the old APO and the C3PRICING ticket.

## Pipeline

**Entry — resolve tickets cheaply.** APO id → read it (Atlassian MCP); if it has full
context (description + acceptance criteria), skip C3PRICING entirely. C3PRICING id → search
APO for the mirror by key/link; use it if sufficient. Playwright only as last resort (Rule 2).

**1–2. APO mirror.** Search APO for a mirror by the C3PRICING key/link:
- Found, still open → use it. Found but resolved (Rule 6) → create a NEW linked ticket.
  Missing → create the mirror.
- Create shape: title, body, link to C3PRICING, assignee = Charlie. Do NOT infer issue
  type / priority / epic / labels. 🔒 Show draft, create on approval.
- Right after creating: transition the ticket to **"In Progress"**
  (`getTransitionsForJiraIssue` → `transitionJiraIssue`; no extra approval — part of the
  approved creation).

**3. Populate the APO body.** Fetch the last 10 APO ticket bodies, infer the house format,
draft the body from the C3PRICING content (+ attribution). 🔒 Update on approval.

**4. Run plan.** Present in chat only — no file. 🔒 Design checkpoint; no code until approved.

**5. Implement.** Create worktree + branch `<type>/cs/APO-<id>` off `develop`; implement
there. For tests, use the relevant C3 skills (`c3-testing` + the domain skill) and mimic the
repo's existing tests (`test/js-rhino/**`, `test/py/**`). Tests are authored here but run by
CI — not locally, not against an env.

**6. Pre-push gate + CI.** From `amdpo/amdPoUI/react`: `npm run build` + `npm run lint`
(confirm script names in `package.json`) and `c3-code-review` on the diff — fix all errors.
Commit (Rule 5 format). 🔒 Push on approval. After push, poll the Jarvis build ~2h later via
`c3-jarvis-builds` — `ScheduleWakeup` caps at 3600s, so re-arm once (two ~3600s wakeups).
Red → surface the failing specs to Charlie, then loop fix → re-push → re-poll. Green → continue.

**6b. UI validation (only if the change touches UI).** Drive Playwright: open the affected
screen, exercise the change, capture before/after screenshots, verify each caption against
the actual pixels before sharing.

**7. Open the PR.** Draft PR, no reviewers, **"don't merge"** label, assignee = Charlie,
base = `develop`. Body: infer format from Charlie's recent PRs (what / why + links to both
tickets + attribution). 🔒 Show title/body/label/base, open on approval. Once open:
transition the APO ticket to **"In Review"** (same mechanism as Step 1–2).

## Environment access

c3auth token lives in `amdpo/amdPoUI/react/.env`, key `VITE_REACT_C3_AUTH` (bound to env
`charlieamdpo02` on `stgazamd2.c3.ai`). Never commit it, never echo the raw value. Expired
(401/403) → ask Charlie for a fresh one.

## State tracking

One `bob-tasks` entry per ticket: `add` on start (`--refs`: APO id, C3PRICING id, branch,
PR# once open); `update`/`note` as steps complete or block; on PR open, `update --status`
with the PR link.

## Reference values

| Thing | Value |
| --- | --- |
| Repo | `/Users/Charlie.Sun/Desktop/c3amdpo` |
| Frontend dir | `amdpo/amdPoUI/react` (Vite; dev = `npm run dev`, build = `npm run build`, lint = `npm run lint`) |
| Base branch | `develop` |
| Branch pattern | `<type>/cs/APO-<id>` — **no slug** |
| Commit format | `APO-<id> (C3PRICING-<id>): <imperative description>` |
| C3PRICING | `ontrack.amd.com` (AMD Okta → `browser` agent / Playwright) |
| APO | `c3energy.atlassian.net` (Atlassian MCP) |
| CI build | Jarvis / Release Management (`c3-jarvis-builds` skill) |
| Attribution | `_Drafted by Bob, reviewed by Charlie Sun_` |
