---
name: planning
description: >-
  Plan big MyBench-client work as small PRs. Two modes. "Idea": brainstorm a feature or change with
  Charlie, read the code, and write a plan that splits it into maintenance-sized slices that each merge
  on their own; on his OK, create the Jira epic and one maintenance-lane ticket per slice. "Review":
  go through the planning lane's draft plans (epics labelled plan-draft) with Charlie, one at a time,
  and approve (create or update the slice tickets), edit, or reject each. Use when Charlie has an idea
  to plan, wants to review or approve draft plans, or asks what plans are waiting.
---

# Planning

Plans for AISmithLab/MyBench-client (Jira project KAN on aicodinggym.atlassian.net). The rules for
what a plan looks like, what makes a good slice, the epic and slice labels, and how replans work are in
`~/Code/Multiagent_Harness/mybench-client/planning.md`. **Read that file first, every time,** and
follow it exactly: the planning lane uses the same file, so plans look the same whoever wrote them.
Also read `~/Code/Multiagent_Harness/mybench-client/shared.md` for routing labels and off-limits areas.

The maintenance lane builds the slice tickets this skill creates, and the reviewing lane merges them,
with nobody looking. So the plan is Charlie's one chance to steer the work. Make every slice small,
safe to merge alone, and settled.

## Hard rules

1. **Nothing is created until Charlie approves.** Drafting, reading and discussing need no approval.
   Creating, editing or closing Jira tickets, and changing epic labels, happen only after Charlie says
   yes to that specific plan in this session.
2. **Jira = the Atlassian MCP tools.** Every ticket operation goes through them.
3. **Read the code, don't guess.** Work from a fresh `origin/main` of `~/Code/MyBench-client`
   (`git -C ~/Code/MyBench-client fetch origin main`, then read with `git show origin/main:<path>` or a
   throwaway worktree). Size estimates and file lists in a plan come from the code.
4. **No code.** This skill writes plans and tickets, never app code, branches or PRs.
5. **No AI attribution** in tickets or comments (no Co-Authored-By, "Generated with" lines or session
   links). Re-read every ticket you create.
6. **Simple English.** Plans are for Charlie to read quickly. Short sentences, plain words.

## Mode 1: Idea

Charlie describes something he wants.

1. **Understand it.** Ask only what you can't work out from the code: who it's for, what "done"
   looks like, and anything that changes the shape of the plan. One round of questions, not a quiz.
2. **Read the code** it touches, `CLAUDE.md`, and the docs for that area.
3. **Check it needs a plan** (*When not to plan* in `planning.md`). If it fits in one maintenance PR,
   say so and offer to file one `maintenance-lane` ticket instead (or to build it now with
   `charlie-pipeline`).
4. **Draft the plan** in chat, in the `planning.md` format. Put every choice under **Decisions** with
   a recommendation. Then point out the two or three things he should look at hardest: the riskiest
   slice, the decisions you were least sure of, and anything that could show users something half-built.
5. **Edit with him** until he approves. 🔒 Wait for an explicit yes.
6. **Create it** (*Creating an approved plan* below), with the epic's source line `Owner's idea`.

## Mode 2: Review drafts

1. **List what's waiting.** JQL: `project = KAN AND issuetype = Epic AND labels = plan-draft AND
   statusCategory != Done ORDER BY created ASC`. Show one line each: key, title, version (v1 or a
   replan), number of slices, and how many decisions are marked **Owner:**. Also mention epics labelled
   `needs-replan` (waiting for the planning lane) so he knows they exist. Nothing waiting → say so and stop.
2. **Go through them one at a time,** in the order he picks. For each:
   - Read the epic, its comments, its source tickets (children labelled `planned`), and for a replan,
     its existing slice tickets and the `Plan doesn't fit:` comment.
   - **Check it yourself before showing it:** spot-read the code for the riskiest slices. Are the
     sizes believable? Does each slice really merge alone without showing anything half-built? If you
     find problems, say so up front with a fix.
   - **Show a short summary:** the goal, the slices in one line each, each **Owner:** decision with the
     recommendation, your own concerns, and for a replan, *Changes from v<N-1>*. Link the epic for the
     full text.
   - 🔒 **Charlie decides:**
     - **Approve** (with or without edits): write any edits into the epic's description first, then
       *Creating an approved plan*.
     - **Edit and wait:** write his edits into the description, keep `plan-draft`, and comment
       `Owner's edits: <summary>.` It stays waiting until he approves it.
     - **Reject:** ask what should happen to the source tickets (back to `needs-triage`, to
       `human-only`, no routing label, or closed). Apply that, swapping `planned` for the new label,
       and removing each one's parent if it's leaving the epic. Then comment
       `Rejected: <reason>.` on the epic and move it to Done.

## Creating an approved plan

**New plan (v1).**
1. For Mode 1, create the epic first: issue type Epic, assignee Charlie, title = the goal in a few
   words, description = the plan.
2. Create one ticket per slice as *Slice tickets* in `planning.md` says (type, parent, labels, title,
   body), in slice order.
3. Add the "is blocked by" links between them.
4. Write each key into its slice's **Ticket:** line, set the status line to `approved v<N>`, and swap
   the epic's label `plan-draft` → `plan-approved` (Mode 1: just add `plan-approved`).
5. Re-read the epic and one slice ticket to check they came through whole.

**Replan (v2 and later).** Apply the plan's *Changes from v<N-1>* as *Replans* in `planning.md`
says: edit the kept slices whose scope changed (update the body and its plan version), create added
slices, close dropped ones (and close their open PRs with a comment), fix the "is blocked by" links,
and move any slice that went back to To Do for the replan so it's buildable again. Never reopen a Done
ticket. Then set the status line to `approved v<N>` and swap `plan-draft` → `plan-approved`.

**Report** to Charlie: the epic link, each slice ticket with its key and what it's blocked by, and
which slices the maintenance lane can start next (the ones blocked by nothing). The maintenance lane
checks every 15 minutes and builds one ticket per run, so a ready slice starts within about 15 minutes.

## Things that go wrong

- **A slice can't avoid an off-limits area.** It becomes a `human-only` slice for Charlie; later
  slices are blocked by it. Point this out at approval: the plan stalls until he builds it.
- **The plan needs a feature flag.** The repo has none yet. The first slice adds a minimal one, as
  `planning.md` says. Make sure Charlie sees and agrees to where it lives.
- **Jira rejects the description** (too long, formatting lost). Keep the plan, shorten *Risks* and
  *Why main stays safe* to one line per item, and try again. Never split one plan across epics.
