---
name: amd-ticket-pipeline
description: >-
  Drive an AMD pricing ticket (C3PRICING / APO) from intake to an open PR — find or create
  the APO mirror, populate it, present a run plan, implement on a worktree, sync it to
  a free personal env (charlieamdpo03 or charlieamdpo04) under a shared env lock, and run build + lint +
  code-review with fixes, `shoot` screenshots, push and open the PR — all unattended right after
  implementation — then wait for Charlie to choose: request review from Harshal, run the PR reviewer
  and post a comment, or squash-merge. Use when Charlie starts
  work on a C3PRICING or APO ticket in the c3amdpo repo. Invoke with either a C3PRICING id
  (e.g. C3PRICING-339) or an APO id (e.g. APO-1199).
---

# AMD ticket → PR pipeline

Single-invocation pipeline: intake → APO mirror → plan → implement → validate + screenshots → push +
open PR → Charlie's decision. Pause at the two 🔒 gates (run plan, final decision on the open PR) for
explicit approval.

## Hard rules

1. **Approval gates — exactly two.** Wait for explicit approval at the **run plan** (Step 3, before any
   code) and the **final decision** (Step 6, once the PR is open with screenshots). Everything between
   them runs unattended: implementing, build/lint/code-review and fixes, env sync, screenshots,
   commit, push, opening the PR, and creating/updating/transitioning APO tickets all proceed without
   asking. Report each with a link right after doing it — ungated means unblocking, not silent, so
   Charlie can still follow the trail.
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
   lock (Step 5). Take whichever is free; if both are held, wait. Release only once Charlie has made
   his final decision (Step 6), or when Charlie says to abort.
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

As soon as the code is written, go straight on to Step 4b — do not stop to report the result and wait.

**4b. Self-review and fix (unattended).** From `amdpo/amdPoUI/react`, run `npm run build` + `npm run lint`,
and run Claude's `/code-review high` on the diff. `/code-review` skips `.py` and `react/**/*.tsx`, so
also self-review the diff against `C3-REVIEW-CHECKLIST.md` (skills-repo root; the same checklist
pr-reviewer uses), hand-checking the **[PY]** and **[TSX]** items. Fix every issue surfaced and
re-run build + lint until clean. The unit/integration tests authored in Step 4 run in CI, not locally.
Do this *before* the env review so the screenshots show the final code.

**5. Env review, screenshots, push, open PR (unattended).** Show Charlie the change running.
`LOCK=~/.claude/skills/amd-ticket-pipeline/env-lock.sh`. The pool is `charlieamdpo03` and
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
5. **Commit, push, open the PR — right after the shoot, no approval needed.** Commit and push
   everything. Open a regular (non-draft) PR against `develop`, no reviewers, assignee = Charlie, no
   labels, title/body per Rule 3 with links to the APO and C3PRICING tickets. Once open, transition
   the APO ticket to **"In Review"**. If scope drifted or something worth recording surfaced (root
   cause, scope-out decision, follow-up), update the APO title/description; otherwise skip.
6. **Share.** Make sure the gallery is served (`python3 -m http.server 4100 -d ~/.harness/shots` in
   the background, unless port 4100 already answers). Send the PNGs that show each acceptance
   criterion with `SendUserFile`, plus **one** link: the ticket page `shoot` printed
   (`http://localhost:4100/apo-<id>/#run-<run id>`). That page has a section per run, a viewer that
   opens when a photo is clicked (‹ › buttons or ←/→ keys, Esc to close) and a "Hide failed runs"
   toggle. Never link a run folder or `http://localhost:4100/apo-<id>/<run id>/` — runs have no
   pages of their own, only a bare file listing. Add one line per screenshot mapping it to its
   acceptance criterion, any console/network problems from the report, and the **PR link**. Tell
   Charlie which env (`$ENV`) and port he can click around on. Screenshot cleanup is automatic
   (`shoot` prunes runs older than 30 days) — don't delete runs by hand; if the pages look out of
   date after upgrading `shoot`, run `shoot --rebuild`.
7. **Hold everything and go to Step 6.** Keep the lock, the synced env, and the dev server up so he
   can click around http://localhost:$PORT himself. No build polling; do not schedule a wakeup.

If something breaks (sync error, dev server won't start), **keep the lock** and tell Charlie what
failed, with the error. He decides: keep going with extra instructions, or abort. An expired token
is the exception: ask once, then follow "Environment access" below. Only on abort — or when
Charlie stops the ticket — stop the dev server and `$LOCK release APO-<id>`.

**6. 🔒 Final decision.** The PR is open and the screenshots are shared. Ask Charlie exactly this, with
these three options (use `AskUserQuestion` if available):

> The PR is up. What now?
> 1. **Request a review** from Harshal
> 2. **PR review** — run the PR reviewer and post its review as a comment
> 3. **Merge** it

When he answers, first run `$LOCK check APO-<id>`:
- **Exit 1 (LOST)** — the wait ran past 6 hours and another agent took your env, so it now runs that
  agent's code. Tell Charlie which ticket took it and that anything he clicked since then wasn't this
  branch. Stop your dev server. If he only asked for changes, wait for an env again (Step 5 sub-step
  1 — you may land on the other one, so re-read `$ENV`/`$PORT`), re-sync, re-shoot, re-share. For
  options 1–3 the env is no longer needed: just continue.
- **Exit 0** — carry on.

Then:
- **Changes requested instead** (he clicked around and wants edits) → fix, re-run `$LOCK acquire`
  (refreshes the 6h clock on the same env), repeat Step 4b and Step 5 (re-sync, re-shoot, push to the
  same PR, re-share), then ask this question again.
- **1. Request review** → stop the dev server, `$LOCK release APO-<id>`, then
  `gh pr edit <pr> --add-reviewer <Harshal's GitHub login>` (find the login from the repo's recent
  PR reviewers or collaborators; ask Charlie only if it's genuinely ambiguous). Report the link. The
  pipeline ends; the APO ticket stays "In Review".
- **2. PR review** → stop the dev server, `$LOCK release APO-<id>`, then run the `pr-reviewer` skill on
  the PR (Charlie often runs this in a separate agent — if he says so, give him the PR number and
  stop). It is Charlie's own PR, so pr-reviewer drafts the review as a comment and waits for his
  approval before posting, per its own rules. After it is posted, ask again with only **Request a
  review** and **Merge** (and "fix the findings" if it raised any; fixes go back through Step 4b
  and Step 5).
- **3. Merge** → stop the dev server, `$LOCK release APO-<id>`, squash-merge (always squash), then
  transition the APO ticket to **"Done"**.

Never merge, request a review, or post a review comment without Charlie's explicit answer here.

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
