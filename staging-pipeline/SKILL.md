---
name: staging-pipeline
description: >-
  Take the staging lane's open staging PR from "built" to merged — summarise every ticket on it and
  the decisions the lane made, apply Charlie's drops and decision changes, then run unattended:
  self-review with /code-review high, fix its findings and the PR's review comments, run all checks, push, start the dev server, share it and
  screenshots, and stop for Charlie's review. On Charlie's say-so, squash-merge the PR and move every
  ticket to Done. Use when Charlie wants to review, validate, or ship the staging lane's batch.
---

# Staging PR → merge pipeline

The staging lane (a scheduled cloud task) builds `staging-lane` tickets onto one staging PR, labelled
`lane:staging` and `dont merge`, and moves each ticket to In Review. This skill picks up from there:
batch summary → edits → self-review → checks → push → dev server + screenshots → merge. It is
`charlie-pipeline` starting midway: the tickets, branch, and PR already exist.

## Hard rules

1. **Approval gates — exactly two.** Wait for explicit approval at the **batch summary** (Step 2,
   before any review or fix) and the **final review** (Step 7, once the PR is reviewed, pushed, and
   the dev server is up). Everything between runs unattended: reviewing, fixing, committing, pushing,
   updating the PR and Jira all proceed without asking. Report each with a link right after doing
   it — ungated means unblocking, not silent.
2. **Jira = Atlassian MCP.** Every ticket operation goes through the Atlassian MCP tools
   (`getJiraIssue`, `editJiraIssue`, `getTransitionsForJiraIssue` → `transitionJiraIssue`,
   `addCommentToJiraIssue`, …).
3. **Repo conventions first.** Follow the repo's `CLAUDE.md` (check gate, PR body sections, doc-update
   rules). Commits on the staging branch are titled `KAN-<n>: <what changed>` after the ticket they
   belong to, matching the lane's own commits. No AI attribution anywhere: no `Co-Authored-By`
   trailers, "Generated with Claude Code" lines, or session links in commits, PR bodies, PR comments,
   or Jira comments.
4. **Share the branch with the lane.** The staging lane may push to the same branch while this runs.
   Always `git pull` (merge, not rebase) before pushing, and never force-push. If new tickets arrive
   mid-run, say so at the next gate — they haven't been through Steps 2–5.
5. **Never reopen a closed/done ticket.**

## Pipeline

**1. Find the staging PR.** In the repo's main checkout, run
`gh pr list --author @me --label lane:staging --state open`. None open → say so and stop. Otherwise
read the PR title (ticket keys), body (**Tickets**, **Decisions I made**, **What to check**,
**Unsure about**), the lane's run-report comments, and **every review comment on the PR** — inline
comments, review bodies, and PR comments, including the automated PR reviewer's (ending
`— Automated PR reviewer`). Fetch the branch and create a worktree on it (no new branch — fixes go on
this PR). For each ticket, read it in Jira (including comments) and its commit(s) on the branch
(`git log origin/main..HEAD --grep "KAN-<n>"`).

**2. 🔒 Batch summary.** Charlie hasn't watched the lane work, so explain the batch in plain English.
Post in chat:
- The PR link, its size (files / lines changed vs `main`), and whether it's behind `main`.
- **One section per ticket:** ticket link and title; what it's about (the problem, for a user); what
  was built (screens, flows, or files touched); **the decisions the lane made** for it, each with its
  reason; and anything the lane flagged as unsure, skipped, or flaky.
- Open PR review comments (from the automated PR reviewer or anyone else), one line each — Step 4
  fixes them.

Then **stop** and wait. Charlie may:
- **Drop a ticket** → `git revert` its commit(s) (one revert commit per ticket), move the ticket to
  **To Do**, remove its `staging-lane` label so the lane doesn't rebuild it, comment on it why, and
  remove it from the PR title and body.
- **Change a decision** → implement the new choice in a `KAN-<n>: <what changed>` commit, update
  **Decisions I made** in the PR body, and comment `Owner's decision: <choice>` on the ticket.
- **Say continue** → go to Step 3.

After applying edits, run the repo's checks, pull, push, and post a short recap of what changed, then
carry straight on to Step 3 — no second summary gate unless Charlie asks for one.

**3. Bring the branch up to date.** If behind, `git fetch origin main` and merge `origin/main` into
the branch (merge, not rebase — the lane does the same). Resolve conflicts keeping both sides' intent.

**4. Self-review and fix.** Fix two sources of findings, each fix its own commit titled after the
ticket it belongs to (Rule 3):
- **`/code-review high`** — run Claude's review on the whole branch diff against `main` and fix every
  issue it surfaces.
- **PR comments** — re-fetch the PR's inline comments, review bodies, and PR comments (the PR reviewer
  task may have posted more since Step 1) and fix every one not already addressed. After pushing,
  reply on each saying what was done (`Fixed in <sha>: …`). If a comment is wrong, don't change the
  code — reply with why, and list it at the Step 7 gate.

**5. Run every check.** Run everything the repo provides (`npm run check`, `npm run e2e`, …) until it
passes. A failing test unrelated to the diff: rerun it alone up to 3 times; passing on a rerun means
flaky — note it and carry on. Then pull, push (Rule 4), re-read the full diff, and update the PR body
(**Changes**, **Tests**, **What to check**) if the scope has drifted.

**6. Dev server + screenshots.** Start the repo's dev server from the worktree and share it with
`devshare <port>`. Run a `shoot` click-through against `localhost` covering every ticket's **What to
check** entry (screens and states named there), look at the screenshots yourself, and fix obvious
breakage (commit, push, reshoot) before reporting.

**7. 🔒 Final review.** Post in chat: the `https://…ts.net:<port>` URL, the `shoot` gallery link with
one line per screenshot (which ticket, what it shows), the PR link, every ticket link, what the
self-review, PR comments, and checks fixed, and any flaky tests, findings, or PR comments
deliberately left (with why). Then **stop** and
wait. No build polling; do not schedule a wakeup.
- Charlie asks for changes or drops a ticket → handle it as in Step 2, rerun the checks, push (see
  *Later pushes*), let the dev server reload, reshoot what changed, and stop again at this gate.
- Charlie says merge → go straight to *Merge*. The PR is already reviewed, so no further review pass.

**Later pushes.** After any further commit + push, re-read the full diff and update the PR title and
body if the scope has drifted (a dropped ticket leaves the title, a changed decision updates
**Decisions I made**).

**Merge — only when Charlie says so.** Pull first; if the lane pushed new tickets since the last gate,
stop and tell Charlie instead of merging. Otherwise remove the `dont merge` label
(`gh pr edit <PR#> --remove-label "dont merge"`), squash-merge (`gh pr merge <PR#> --squash
--delete-branch`), and transition **every** ticket in the PR title to **"Done"**. Then clean up without
asking: stop the Step 6 dev server and its share (`devshare stop <port>`), remove the Step 1 worktree
(`git worktree remove <path>`), and delete its local branch (`git branch -D <branch>`). Finally, in the
main checkout (on `main`), run `git pull`. Report each. The lane's next run sees the merged PR and
starts a fresh batch.
