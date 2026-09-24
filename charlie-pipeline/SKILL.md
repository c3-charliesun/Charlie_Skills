---
name: charlie-pipeline
description: >-
  Drive a Jira ticket from intake to an open PR — find or create the ticket from Charlie's
  description, move it to In Progress, present a run plan, implement on a fresh worktree, and once
  Charlie is satisfied, self-review with /code-review high, fix, commit, push, open a PR, and move the
  ticket to In Review. On Charlie's say-so, squash-merge the PR and move the ticket to Done. Use when
  Charlie starts work on a ticket or describes a change to ship. Invoke with a Jira id or a
  description of the work.
---

# Ticket → PR pipeline

Single-invocation pipeline: intake → ticket → plan → implement → self-review → push → open PR. Pause at
the two 🔒 gates (run plan, push) for explicit approval.

## Hard rules

1. **Approval gates — exactly two.** Wait for explicit approval at the **run plan** (Step 3, before any
   code) and the **push** (Step 5, once Charlie is satisfied with the change). Everything else runs
   unattended: creating tickets, transitioning them, and opening the PR all proceed without asking.
   Report each with a link right after doing it — ungated means unblocking, not silent, so Charlie can
   still follow the trail.
2. **Jira = Atlassian MCP.** Every ticket operation — read, search, create, update, transition, comment,
   link — goes through the Atlassian MCP tools (`getJiraIssue`, `searchJiraIssuesUsingJql`,
   `createJiraIssue`, `editJiraIssue`, `getTransitionsForJiraIssue` → `transitionJiraIssue`,
   `addCommentToJiraIssue`, `createIssueLink`, …).
3. **Repo conventions first.** Follow the repo's `CLAUDE.md` for branch naming, commit messages, PR
   title/body, labels, and anything else it specifies. Where it sets no standard, follow the repo's
   recent conventions (recent branches, commits, and PRs).
4. **Never reopen a closed/done ticket.** Re-fix of already-shipped work (ticket is Done, its PR merged,
   or Charlie says it's a bug from a previous ticket) → create a **NEW** ticket linked to the old one.

## Pipeline

**1. Find or create the ticket.** From Charlie's description (or the id he gives), search Jira for an
existing ticket:
- Found, still open → use it. Found but resolved (Rule 4) → create a NEW linked ticket. Missing → create it.
- Create shape: title, body, assignee = Charlie. Leave issue type / priority / epic / labels unset —
  those follow team conventions you can't reliably infer, and a wrong value is more work to undo than
  an empty one is to fill in.

**2. Move it to In Progress.** Transition the ticket to **"In Progress"** and post the ticket link in chat.

**3. Run plan.** Present in chat only — no file. 🔒 Design checkpoint; no code until approved.

**4. Implement.** Fetch the latest base branch (`git fetch origin <base>`), then create a new worktree +
branch off `origin/<base>` (Rule 3); implement there. Iterate with Charlie until he's satisfied.

**5. 🔒 Push gate → self-review, fix, commit, push.** Once Charlie approves the push, run Claude's
`/code-review high` on the diff, fix every issue it surfaces, then commit and push everything.

**6. Open the PR.** Regular (non-draft) PR, no reviewers, assignee = Charlie, title/body per Rule 3 with
a link to the ticket. Once open, transition the ticket to **"In Review"** (same mechanism as Step 2).
The pipeline **ends here** — no build polling; do not schedule a wakeup.

**Later pushes.** After any further commit + push to the PR, re-read the full diff and update the PR
title and description if the scope has drifted.

**Merge — only when Charlie says so.** Always squash-merge (`gh pr merge <PR#> --squash`), then
transition the ticket to **"Done"**.
