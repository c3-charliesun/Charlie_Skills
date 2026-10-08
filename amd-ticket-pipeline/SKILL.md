---
name: amd-ticket-pipeline
description: >-
  Drive an AMD pricing ticket (C3PRICING / APO) from intake to an open PR — find or create
  the APO mirror, populate it, present a run plan, implement on a worktree, sync it to
  charlieamdpo03 under a shared env lock and send Charlie `shoot` screenshots for review, then
  build + lint + code-review, push, and open a PR (no reviewers, "dont merge" label). Use when Charlie starts
  work on a C3PRICING or APO ticket in the c3amdpo repo. Invoke with either a C3PRICING id
  (e.g. C3PRICING-339) or an APO id (e.g. APO-1199).
---

# AMD ticket → PR pipeline

Single-invocation pipeline: intake → APO mirror → plan → implement → validate → open PR. Pause at the
two 🔒 gates (run plan, push) for explicit approval.

## Hard rules

1. **Approval gates — exactly two.** Wait for explicit approval at the **run plan** (Step 3, before any
   code) and the **push** (Step 5 — given by Charlie's OK on the env review in Step 4b). Everything else
   runs unattended: creating APO tickets, updating their bodies, transitioning them, and opening the PR
   all proceed without asking. Report each with a link right after doing it — ungated means
   unblocking, not silent, so Charlie can still follow the trail.
2. **APO = Atlassian MCP, never the browser.** Every APO operation — read, search, create, update,
   transition, comment, link — goes through the Atlassian MCP tools. The browser is only for C3PRICING
   (`ontrack.amd.com`, AMD Okta — no MCP), and only when APO is thin or no mirror exists.
3. **Repo conventions first.** Follow the c3amdpo `CLAUDE.md` for branch name, commit message, PR title,
   and PR description sections. This skill does not restate them.
4. **Never reopen a closed/done ticket.** Re-fix of already-shipped work (mirror is Done, its PR merged,
   or Charlie says it's a bug from a previous ticket) → create a **NEW** APO ticket linked to both the
   old APO and the C3PRICING ticket.
5. **charlieamdpo03 is one-agent-at-a-time.** Several pipeline runs may be live at once and the env
   holds one copy of the code, so never sync to it, or run a dev server against it, without holding
   the env lock (Step 4b). Release it only on Charlie's OK, or when Charlie says to abort.

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

**4b. Env review on charlieamdpo03.** Show Charlie the change running before asking to push.
`LOCK=~/Desktop/charlie_skills/amd-ticket-pipeline/env-lock.sh`.

1. **Take the lock.** `$LOCK acquire APO-<id> <worktree path>`. Exit 0 → you hold it. Exit 1 → it
   prints who holds it; post "waiting on charlieamdpo03 (held by APO-xxxx since …)" in chat once,
   then re-run `acquire` every 10 minutes in a background until-loop (`until $LOCK acquire …; do
   sleep 600; done` — not foreground sleeps) until it succeeds. A lock older than 6 hours is taken
   over automatically; if `acquire` says it took over a stale lock, tell Charlie which ticket lost it.
2. **Sync** the worktree with the `amdpo-c3-exec` §6 recipe — from the worktree root,
   `c3 sync -f -s https://stgazamd2.c3.ai/charlieamdpo03/dev --no-tty`, run in the background until
   `✓ Synced <N> files`. Always sync, even for frontend-only changes, so the env matches this branch
   and not the last agent's.
3. **Start the dev server** from the worktree's `amdpo/amdPoUI/react` with the `VITE_REACT_C3_*` env
   vars from `amdpo-c3-exec` §6, token read from the main checkout's `react/.env`
   (`VITE_REACT_C3_AUTH`) without echoing it. It serves http://localhost:8000.
4. **Photo shoot with `shoot`** (`charlie_skills/shoot/README.md`). Write a steps file in the
   session scratchpad that walks each acceptance criterion, with a `shot` per criterion, then run
   `shoot http://localhost:8000/ --steps <file> --project apo-<id> --name "<what it shows>"`. Fix the
   steps and re-run if a step fails for a selector reason; a real UI failure is a finding — fix the
   code, re-sync, re-shoot. This step is Charlie's standing request for screenshots.
5. **Share.** Make sure the gallery is served (`python3 -m http.server 4100 -d ~/.harness/shots` in
   the background, unless port 4100 already answers). Send the PNGs with `SendUserFile`, plus the
   gallery link `shoot` printed, with one line per screenshot mapping it to its acceptance criterion
   and any console/network problems from the report. Then ask for the push OK. Screenshot cleanup is
   automatic (`shoot` prunes runs older than 30 days) — don't delete runs by hand.
6. **Hold everything until Charlie answers.** Keep the lock, the synced env, and the dev server up so
   he can click around http://localhost:8000 himself. When he answers, first run
   `$LOCK check APO-<id>`:
   - **Exit 1 (LOST)** — the review ran past 6 hours and another agent took the env, so it now runs
     that agent's code. Tell Charlie which ticket took it and that anything he clicked since then
     wasn't this branch. Stop your dev server. Then wait for the lock again (sub-step 1), re-sync,
     re-shoot, and re-share before treating any OK as the push approval.
   - **Exit 0** — changes requested → fix, re-run `$LOCK acquire` (refreshes the 6h clock), re-sync,
     re-shoot, re-share. OK → stop the dev server, `$LOCK release APO-<id>`, then go to Step 5.
If something breaks (token expired, sync error, dev server won't start), **keep the lock** and tell
Charlie what failed, with the error. He decides: keep going with extra instructions (e.g. a fresh
token — cache it with `c3 auth -t <token> -s <appUrl>` and resume), or abort. Only on abort — or
when Charlie stops the ticket — stop the dev server and `$LOCK release APO-<id>`.

**5. 🔒 Push gate → self-review, fix, commit, push.** Charlie's OK in Step 4b is the push approval.
Then, from `amdpo/amdPoUI/react`, run `npm run build` + `npm run lint`, and run
Claude's `/code-review high` on the diff. `/code-review` skips `.py` and `react/**/*.tsx`, so also
self-review the diff against `C3-REVIEW-CHECKLIST.md` (skills-repo root; the same checklist pr-reviewer
uses), hand-checking the **[PY]** and **[TSX]** items. Fix every issue surfaced, then commit and push
everything.

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
