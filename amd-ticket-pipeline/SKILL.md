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

A single-invocation pipeline for the repeating c3amdpo workflow: intake a ticket, mirror it
to APO, plan, implement, validate, and open a draft PR. It pauses at every outbound
(egress) action for explicit approval. Drive all steps in order; record state in `bob-tasks`
so a ticket can be resumed across sessions.

**Repo:** `/Users/Charlie.Sun/Desktop/c3amdpo`  ·  **Frontend:** `amdpo/amdPoUI/react`  ·
**Base branch:** `develop`

## When to use / invocation

Invoke with **either** id — the pipeline figures out the rest:

- `amd-ticket-pipeline C3PRICING-339` — start from the AMD ticket.
- `amd-ticket-pipeline APO-1199` — start from the APO ticket (mirror already exists).

The entry point is flexible because no matter which id is given, you usually need both
tickets' content — **unless the APO ticket already has everything**, in which case you skip
the expensive C3PRICING fetch (see Rule 2).

## Hard rules (always)

1. **Branch naming — NO SLUG.** Branches are exactly `<type>/cs/APO-<id>` —
   e.g. `bugfix/cs/APO-1199`. `<type>` ∈ {feature, bugfix, fix, hotfix, perf}, chosen by the
   work; `cs` = Charlie Sun; the id is the **APO** id. **Never append a slug** — it is
   `bugfix/cs/APO-1177`, NOT `bugfix/cs/APO-1177-quote-status-filters`. Do not copy slugged
   branch names from old `docs/specs/` files or from generic `fix/hg/APO-xxxx-slug` examples.
2. **Minimize Playwright / C3PRICING fetches.** C3PRICING lives on `ontrack.amd.com` (AMD
   Okta) and needs the `browser` agent — slow. APO lives on `c3energy.atlassian.net`
   (Atlassian MCP) — fast. **Always read APO first.** Only fetch C3PRICING via Playwright
   when the APO ticket is missing the info you need, or when no APO mirror exists yet.
3. **Approval gates (human-in-the-loop).** Draft first, show, then wait for explicit approval
   before any egress: creating the APO mirror, updating the APO body, pushing, opening the PR.
4. **Attribution.** End outgoing text (APO body, PR body) with, after a blank line:
   `_Drafted by Bob, reviewed by Charlie Sun_`.
5. **Commit message format:** `APO-<id> (C3PRICING-<id>): <imperative description>`.
6. **Never reopen a closed/done ticket.** If the work is a re-fix of something already
   shipped (the APO mirror is already Done, a previous PR for it is already merged, or
   Charlie says we're fixing a bug from a previous ticket), **create a NEW APO ticket and
   link it to the old one** — do not reopen the old ticket. See Step 1–2.

## Pipeline

### Entry — resolve both tickets cheaply
- Given an **APO id** → read the APO ticket (Atlassian MCP). If it already has the full
  context (description + acceptance criteria), proceed and **do not** fetch C3PRICING.
- Given a **C3PRICING id** → search APO for the mirror by the C3PRICING key/link; use it if
  found and sufficient.
- Fetch C3PRICING via the `browser` agent **only** when the APO ticket is thin/missing info,
  or no mirror exists and one must be created.

### Step 1–2 — APO mirror
- Search APO for an existing mirror by the C3PRICING key/link.
- **Found and still open / not yet implemented** → use it.
- **Found but already resolved** — the mirror is Done, a previous PR for it is already
  merged, or Charlie says we're fixing a bug from a previous ticket → **create a NEW APO
  ticket. Do NOT reopen the old one.** Link the new ticket to both the old APO ticket and
  the C3PRICING ticket.
- **Missing** → create a new mirror.
- **Minimal ticket shape** (both create cases): title, body, link back to the C3PRICING
  ticket, assignee = Charlie. **Do NOT** infer issue type / priority / epic / labels.
  → 🔒 **Approval gate:** show the draft, create only on approval.
- **Right after creating** the ticket (and assigning Charlie), transition it to
  **"In Progress"** — look up the matching transition with `getTransitionsForJiraIssue`,
  then `transitionJiraIssue`. No extra approval needed; it's part of the approved creation.

### Step 3 — Populate the APO body
- Fetch the **last 10 APO ticket bodies**, infer the house format from them, and write the
  APO body in that format (drawn from the C3PRICING content).
- → 🔒 **Approval gate:** show the proposed body, update only on approval. (Include the
  attribution postfix.)

### Step 4 — Run plan
- Present the run plan **in chat only — no file.**
- → 🔒 **Approval gate:** this is the design checkpoint. Do not write code until approved.

### Step 5 — Implement
- **Create the worktree + new branch:** `<type>/cs/APO-<id>` (no slug), off `develop`.
- Implement the change in the worktree.
- **Writing tests:** when the change needs tests, use the relevant **C3 skills** (e.g.
  `c3-testing` for conventions, plus any domain skill for the area being changed) **and read
  the existing tests in the repo** (`test/js-rhino/**`, `test/py/**`, etc.) to mimic their
  structure before writing new ones. Tests are authored here but **run by CI** (Step 6) —
  not locally and not against an env.

### Step 6 — Pre-push gate + CI
- **Pre-push gate (no env needed):** from `amdpo/amdPoUI/react`, run the build + lint scripts
  (`npm run build`, `npm run lint` — confirm names in `package.json`) **and** run
  `c3-code-review` on the diff. Fix all errors before pushing.
- Commit (use the Rule 5 message format) and → 🔒 **Approval gate: push only on approval.**
- **After push, poll the Jarvis / Release-Management build ~2 hours later** via the
  `c3-jarvis-builds` skill (check the branch's build status). Mechanism: schedule the
  re-check rather than blocking. `ScheduleWakeup` caps at 3600s per call, so re-arm once
  (two ~3600s wakeups) to reach the full ~2 hours before checking the build.
  - **Red** → pull the failing specs from the build report and surface them to Charlie
    (then loop: fix → re-push → re-poll).
  - **Green** → continue.

### Step 6b — UI validation (conditional)
- **If the change touches the UI** → drive **Playwright**: open the affected screen, exercise
  the change, capture **before/after screenshots**, and verify each caption against the
  actual pixels before sharing.
- **If there is no UI change** → do nothing.

### Step 7 — Open the PR
- **Draft PR**, **no reviewers**, add the **"don't merge"** label, assignee = Charlie,
  base = `develop`.
- Body: infer the format from Charlie's **recent PRs** (what / why + links to the APO and
  C3PRICING tickets). Include the attribution postfix.
- → 🔒 **Approval gate:** show the full PR (title + body + label + base) and open only on
  approval.
- **Once the draft PR is open**, transition the APO ticket to **"In Review"** (same
  mechanism: `getTransitionsForJiraIssue` → `transitionJiraIssue`).

## Environment access

If a step needs to hit the C3 environment (UI validation against the env, a console/curl
call, fetching live data, etc.), the **c3auth token is in `amdpo/amdPoUI/react/.env`**
(key `VITE_REACT_C3_AUTH`) — currently bound to env `charlieamdpo02` on `stgazamd2.c3.ai`.
Read it from there. **Never commit it and never echo the raw token value.** If it's expired
(401/403), ask Charlie for a fresh one rather than guessing.

## State tracking

Track each ticket as one `bob-tasks` entry so it survives across sessions:
- On start: `bob-tasks add` (or update the existing match) with `--refs` covering the APO id,
  C3PRICING id, branch, and (once open) the PR number.
- As steps complete or block, `bob-tasks update` / `note` the progress.
- On PR open: `bob-tasks update --status` with the PR link.

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
