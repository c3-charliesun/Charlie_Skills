---
name: amd-ticket-pipeline
description: >-
  Drive an AMD pricing ticket (C3PRICING / APO) from intake to an open PR — find or create
  the APO mirror, populate it, present a run plan, implement on a worktree, sync it to
  a free personal env (charlieamdpo03 or charlieamdpo04) under a shared env lock and send Charlie `shoot` screenshots for review, then
  build + lint + code-review, push, and open a PR (no reviewers, no label). Use when Charlie starts
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
5. **Each personal env is one-agent-at-a-time.** There are two, `charlieamdpo03` and `charlieamdpo04`
   (same permissions, same token). Several pipeline runs may be live at once and each env holds one
   copy of the code, so never sync to an env, or run a dev server against it, without holding its
   lock (Step 4b). Take whichever is free; if both are held, wait. Release only on Charlie's OK, or
   when Charlie says to abort.
6. **A pasted token is saved, not just used.** When Charlie pastes a fresh token, write it into the
   shared `.env` right away (see "Environment access") so no other agent ever has to ask again.

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

**4b. Env review on a free personal env.** Show Charlie the change running before asking to push.
`LOCK=~/Desktop/charlie_skills/amd-ticket-pipeline/env-lock.sh`. The pool is `charlieamdpo03` and
`charlieamdpo04`; `$LOCK status` shows who holds what. Everything below uses `$ENV` (the env you got)
and `$PORT` (its dev-server port: 8000 for 03, 8001 for 04).

1. **Take an env.** `$LOCK acquire APO-<id> <worktree path>`. Exit 0 → its last line is
   `env=<name> port=<n>`: that is your `$ENV` and `$PORT` (also available any time as
   `$LOCK which APO-<id>`). It picks the first free env, so if another agent has 03 you get 04.
   Exit 1 → both are held (it prints who). Post "waiting on a personal env (03 held by APO-xxxx, 04 held
   by APO-yyyy)" in chat once, then re-run `acquire` every 10 minutes in a background until-loop
   (`until $LOCK acquire …; do sleep 600; done` — not foreground sleeps). Whichever env frees up
   first goes to whoever retries next. A lock older than 6 hours is taken over automatically; if
   `acquire` says it took over a stale lock, tell Charlie which ticket lost it.
2. **Sync** the worktree with the `amdpo-c3-exec` §6 recipe — from the worktree root,
   `c3 sync -f -s https://stgazamd2.c3.ai/$ENV/dev --no-tty`, run in the background until
   `✓ Synced <N> files`. Always sync, even for frontend-only changes, so the env matches this branch
   and not the last agent's.
3. **Start the dev server** from the worktree's `amdpo/amdPoUI/react` with the `VITE_REACT_C3_*` env
   vars from `amdpo-c3-exec` §6 (`VITE_REACT_C3_ENV=$ENV`) and `--port $PORT`, token read from the
   main checkout's `react/.env` (`VITE_REACT_C3_AUTH`) without echoing it. It serves
   http://localhost:$PORT. Use that URL everywhere below — never assume 8000.
4. **Photo shoot with `shoot`** (`charlie_skills/shoot/README.md`). Write a steps file in the
   session scratchpad that walks each acceptance criterion, with a `shot` per criterion, then run
   `shoot http://localhost:$PORT/ --steps <file> --project apo-<id> --name "<what it shows>"`. Always use
   the same `--project apo-<id>` for every run of the ticket: they all land on one page for that
   ticket, one section per run, so give each run a distinct `--name`. Each step waits up to 30s. When a
   run fails, open its `FAILED step N` screenshot and decide why. If the steps file caused it (wrong
   selector, timing, a default your script toggled), fix the steps, re-run, then delete the bad run
   with `shoot --discard <run id>` so it never shows on Charlie's page. Keep a failed run only when
   it shows a real problem in the app: that is a finding — fix the code, re-sync, re-shoot. This
   step is Charlie's standing request for screenshots.
5. **Share.** Make sure the gallery is served (`python3 -m http.server 4100 -d ~/.harness/shots` in
   the background, unless port 4100 already answers). Send the PNGs that show each acceptance
   criterion with `SendUserFile`, plus **one** link: the ticket page `shoot` printed
   (`http://localhost:4100/apo-<id>/#run-<run id>`). That page has a section per run, a viewer that
   opens when a photo is clicked (‹ › buttons or ←/→ keys, Esc to close) and a "Hide failed runs"
   toggle. Never link a run folder or `http://localhost:4100/apo-<id>/<run id>/` — runs have no
   pages of their own, only a bare file listing. Add one line per screenshot mapping it to its
   acceptance criterion, and any console/network problems from the report. Tell Charlie which env
   (`$ENV`) and port he can click around on. Then ask for the push OK. Screenshot cleanup is
   automatic (`shoot` prunes runs older than 30 days) — don't delete runs by hand; if the pages
   look out of date after upgrading `shoot`, run `shoot --rebuild`.
6. **Hold everything until Charlie answers.** Keep the lock, the synced env, and the dev server up so
   he can click around http://localhost:$PORT himself. When he answers, first run
   `$LOCK check APO-<id>`:
   - **Exit 1 (LOST)** — the review ran past 6 hours and another agent took your env, so it now runs
     that agent's code. Tell Charlie which ticket took it and that anything he clicked since then
     wasn't this branch. Stop your dev server. Then wait for an env again (sub-step 1 — you may
     land on the other one, so re-read `$ENV`/`$PORT`), re-sync, re-shoot, and re-share before
     treating any OK as the push approval.
   - **Exit 0** — changes requested → fix, re-run `$LOCK acquire` (refreshes the 6h clock on the same
     env), re-sync, re-shoot, re-share. OK → stop the dev server, `$LOCK release APO-<id>`, then go
     to Step 5.
If something breaks (sync error, dev server won't start), **keep the lock** and tell Charlie what
failed, with the error. He decides: keep going with extra instructions, or abort. An expired token
is the exception: ask once, then follow "Environment access" below. Only on abort — or when
Charlie stops the ticket — stop the dev server and `$LOCK release APO-<id>`.

**5. 🔒 Push gate → self-review, fix, commit, push.** Charlie's OK in Step 4b is the push approval.
Then, from `amdpo/amdPoUI/react`, run `npm run build` + `npm run lint`, and run
Claude's `/code-review high` on the diff. `/code-review` skips `.py` and `react/**/*.tsx`, so also
self-review the diff against `C3-REVIEW-CHECKLIST.md` (skills-repo root; the same checklist pr-reviewer
uses), hand-checking the **[PY]** and **[TSX]** items. Fix every issue surfaced, then commit and push
everything.

**6. Open the PR.** Regular (non-draft) PR against `develop`, no reviewers, assignee = Charlie, no
labels, title/body per Rule 3 with links to the APO and C3PRICING tickets. Once open, transition the APO ticket to **"In Review"**. If scope drifted or something worth
recording surfaced (root cause, scope-out decision, follow-up), update the APO title/description;
otherwise skip. The pipeline **ends here** — no build polling; do not schedule a wakeup.

**Merge — only when Charlie says so.** Always squash-merge, then transition the APO ticket to **"Done"**.

## Environment access

The c3auth token lives in `amdpo/amdPoUI/react/.env` of the **main checkout**
(`~/Desktop/c3amdpo/amdpo/amdPoUI/react/.env`), key `VITE_REACT_C3_AUTH`. One token works for
`charlieamdpo03`, `charlieamdpo04` and the other envs on `stgazamd2.c3.ai` — Charlie's personal envs
(03 and 04) are his testing grounds; read/write/delete freely there. Never commit it, never echo it
back in chat or logs. Every agent reads the token from that one file, so keeping it fresh there keeps
every agent working.

**Expired token (401/403, or `Server returned HTML instead of JSON`).**
1. First re-read the `.env`: another agent may already have saved a fresh token. If the key's value
   differs from the one that just failed, retry with it — don't ask Charlie.
2. Otherwise ask Charlie once to paste a new token in chat. He will not edit files himself.
3. When he pastes one, **you** update the `.env` — replace only the `VITE_REACT_C3_AUTH=` line in the
   main checkout's file, leaving every other line as it is (substitute `NEW_TOKEN` through the
   environment rather than typing it into a command line that gets logged):
   ```bash
   ENV_FILE=~/Desktop/c3amdpo/amdpo/amdPoUI/react/.env
   NEW_TOKEN='<pasted token>' python3 - "$ENV_FILE" <<'PY'
   import os, re, sys
   p = sys.argv[1]
   s = open(p).read()
   line = "VITE_REACT_C3_AUTH=" + os.environ["NEW_TOKEN"]
   s = re.sub(r"(?m)^VITE_REACT_C3_AUTH=.*$", lambda m: line, s) if re.search(r"(?m)^VITE_REACT_C3_AUTH=", s) else s.rstrip("\n") + "\n" + line + "\n"
   open(p, "w").write(s)
   PY
   ```
   Match the file's existing quoting style if the old value was quoted. Then confirm with a
   `c3 exec` call that the token authenticates, and cache it for both pool envs:
   `c3 auth -t <token> -s https://stgazamd2.c3.ai/charlieamdpo03/amdpoui` and the same for
   `charlieamdpo04`.
4. Restart any dev server that was started with the old token (it read the value at launch), then
   resume the step that failed. Tell Charlie in one line that the `.env` is updated, so he knows he
   doesn't need to paste again. The `.env` is untracked, so this is never a commit.
