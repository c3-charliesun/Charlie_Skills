---
name: charlie-pipeline
description: >-
  Drive a change from intake to an open PR — present a run plan, and once approved run unattended:
  implement on a fresh worktree, self-review with /code-review high, fix, commit, push, open a PR, then
  start the dev server and stop for Charlie's review. On Charlie's say-so, squash-merge the PR. For the
  two MyBench repos (MyBench-client, MyBench-web) it also tracks the work on the Jira board: finds or
  creates the ticket, moves it to In Progress, In Review and Done. Any other repo gets no ticket. Use
  when Charlie starts work on a ticket or describes a change to ship. Invoke with a Jira id or a
  description of the work.
---

# Ticket → PR pipeline

Single-invocation pipeline: intake → ticket (MyBench repos only, Step 0) → plan → implement → self-review → push → open PR → dev
server. Pause at the two 🔒 gates (run plan, final review) for explicit approval.

## Step 0: Jira or no Jira

First work out which repo the work lives in (the repo Charlie names, the one you're in, or the one the
description points to; check with `git remote get-url origin`). That decides the mode for the whole run:

| Repo | Mode |
|---|---|
| `AISmithLab/MyBench-client` (`~/Code/MyBench-client`) | **Jira mode**, project KAN on aicodinggym.atlassian.net, no repo label |
| `AISmithLab/MyBench-web` (`~/Code/MyBench-web`) | **Jira mode**, project KAN, label `repo-web` |
| anything else | **No-ticket mode** |

- A `KAN-…` id from Charlie means Jira mode. For MyBench-web, the ticket's `repo-web` label tells
  which repo it belongs to; no `repo-web` means MyBench-client.
- Can't tell which repo → ask Charlie before doing anything else.
- **No-ticket mode:** skip every step and rule marked *(Jira)* below: no Jira search, no ticket, no
  transitions, no ticket links. Don't create a ticket "just in case", and don't mention the skipped
  steps beyond one line in the run plan (`Ticket: none, not a MyBench repo`). Where a step uses the
  ticket id (worktree folder, branch, PR body), use a short slug of the work instead, e.g.
  `fix-login-redirect`, unless the repo's own conventions say otherwise.
- State the mode in the run plan (Step 3) so Charlie can correct it.

## Hard rules

1. **Approval gates — exactly two.** Wait for explicit approval at the **run plan** (Step 3, before any
   code) and the **final review** (Step 7, once the PR is open, reviewed, and the dev server is up).
   Everything between runs unattended: creating tickets, transitioning them, implementing, self-review,
   committing, pushing, and opening the PR all proceed without asking.
   Report each with a link right after doing it — ungated means unblocking, not silent, so Charlie can
   still follow the trail.
2. *(Jira)* **Jira = Atlassian MCP.** Every ticket operation — read, search, create, update, transition, comment,
   link — goes through the Atlassian MCP tools (`getJiraIssue`, `searchJiraIssuesUsingJql`,
   `createJiraIssue`, `editJiraIssue`, `getTransitionsForJiraIssue` → `transitionJiraIssue`,
   `addCommentToJiraIssue`, `createIssueLink`, …).
3. **Repo conventions first.** Follow the repo's `CLAUDE.md` for branch naming, commit messages, PR
   title/body, labels, and anything else it specifies. Where it sets no standard, follow the repo's
   recent conventions (recent branches, commits, and PRs).
4. *(Jira)* **Never reopen a closed/done ticket.** Re-fix of already-shipped work (ticket is Done, its PR merged,
   or Charlie says it's a bug from a previous ticket) → create a **NEW** ticket linked to the old one.

## Pipeline

**1. *(Jira)* Find or create the ticket.** From Charlie's description (or the id he gives), search
project KAN for an existing ticket (for MyBench-web add `AND labels = repo-web`; for MyBench-client add
`AND (labels is EMPTY OR labels not in (repo-web))`):
- Found, still open → use it. Found but resolved (Rule 4) → create a NEW linked ticket. Missing → create it.
- Create shape: project KAN, title, body, assignee = Charlie, and the label `repo-web` if the work is
  in MyBench-web (nothing for MyBench-client). Add no other labels: no routing label (like
  `maintenance-lane`) means it's Charlie's own ticket, so the harness lanes leave it alone. Leave issue
  type / priority / epic unset too — those follow team conventions you can't reliably infer, and a
  wrong value is more work to undo than an empty one is to fill in.

**2. *(Jira)* Move it to In Progress.** Transition the ticket to **"In Progress"** and post the ticket link in chat.

**3. Run plan.** Present in chat only — no file. 🔒 Design checkpoint; no code until approved.
Besides the implementation steps, the plan always covers these, each in a line or two. Fill them from
the ticket (if any), Charlie's description and context, and propose a default where it isn't known yet:
- **Repo and mode:** which repo, and Jira mode with the ticket link, or `Ticket: none, not a MyBench repo`.
- **The task**, in Charlie's words, plus what you know from context.
- **What he really wants:** the goal behind the ticket, and how he'll judge it.
- **Done when:** measurable checks (tests, behaviour, screenshots).
- **What to iterate on:** what you'll try more than once and how you'll decide (if anything).
- **How it fits:** related tickets, other repos or lanes, and what it must not break.
- **When you'll stop and ask him** (beyond the two gates), and **what you'll decide alone**.

**4. Implement.** Fetch the latest base branch (`git fetch origin <base>`), then create a new worktree +
branch off `origin/<base>` (Rule 3) **inside the repo's hidden `.claude/worktrees/` folder**, e.g.
`git worktree add <repo>/.claude/worktrees/<TICKET-ID or slug> -b <branch> origin/<base>`. Never put it in a
folder next to the repo in `~/Code/`. Implement there and verify it works (build, tests, lint as the
repo provides). Don't stop to check in — carry straight on to Step 5.

**5. Self-review, fix, commit, push.** Run Claude's `/code-review high` on the diff, fix every issue it
surfaces, then commit and push everything.

**6. Open the PR.** Regular (non-draft) PR, no reviewers, assignee = Charlie, title/body per Rule 3. *(Jira)* Put a link to
the ticket in the body, and once the PR is open, transition the ticket to **"In Review"** (same
mechanism as Step 2).

**7. 🔒 Dev server → final review.** Start the repo's dev server from the Step 4 worktree, share it with
`devshare <port>`, and post in chat: the `https://…ts.net:<port>` URL, the PR link, the ticket link *(Jira)*, and
a short summary of what changed and what the self-review fixed. (Repo has no dev server → skip starting
one and just post the rest.) Then **stop** and wait. No build polling; do not schedule a wakeup.
- Charlie asks for changes → make them, commit, push (see *Later pushes*), let the dev server reload,
  and stop again at this gate.
- Charlie says merge → go straight to *Merge*. The PR is already reviewed, so no further review pass.

**Later pushes.** After any further commit + push to the PR, re-read the full diff and update the PR
title and description if the scope has drifted.

**Merge — only when Charlie says so.** Always squash-merge (`gh pr merge <PR#> --squash`), then *(Jira)*
transition the ticket to **"Done"**. Then clean up without asking: stop the Step 7 dev server and its
share (`devshare stop <port>`), remove the Step 4 worktree (`git worktree remove <path>`), and delete
its local branch (`git branch -D <branch>` — `-D` because a squash merge leaves the branch looking
unmerged). Finally, in the main checkout (on the base branch), run `git pull` so it has the latest
merged code. Report each.
