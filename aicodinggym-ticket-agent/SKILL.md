---
name: aicodinggym-ticket-agent
description: >-
  Autonomous Jira-to-PR agent for AISmithLab/AICodingGym. Use when Charlie starts or resumes
  the AICodingGym ticket agent, wants agent_ready Jira tickets implemented, or wants the
  30-minute autonomous scan loop to find KAN tickets, implement them, test them, browser-verify
  with Playwright MCP, attach screenshots, and open PRs.
---

# AICodingGym Ticket Agent

Continuous pipeline for AICodingGym Jira tickets: scan `KAN` for `agent_ready`, implement one
ticket, validate locally and in-browser, open a PR with screenshots, update Jira, then continue.
Operational templates live in [REFERENCE.md](REFERENCE.md).

## Hard Rules

- **Ticket source is Jira via Atlassian MCP.** Search, read, comment, and transition Jira issues
  through MCP tools only. Do not use the browser for Jira.
- **Scan query:** `project = KAN AND labels = agent_ready AND statusCategory != Done ORDER BY created ASC`.
- **One ticket at a time.** Finish, block, or explicitly defer the active ticket before starting another.
- **No silent endings.** Every cycle ends with a status line and either the next ticket, a blocked ticket,
  or a scheduled 30-minute wakeup.
- **Automatic PRs.** After implementation, local CI, self-review, and Playwright validation pass, push and
  open the PR without asking Charlie.
- **Never merge.** Open PRs only.
- **GitHub account switching is mandatory for every git/PR operation:** `gh auth switch -u charliespy`,
  run the operation, then `gh auth switch -u c3-charliesun`, even on failure.
- **Branch format:** `agent/KAN-<id>-<short-slug>`.
- **Commit format:** `KAN-<id>: <imperative summary>`.
- **PR title:** `KAN-<id>: <summary>`.

## Lifecycle & Auto-Loop

| State | Behavior |
| --- | --- |
| Fresh start / wakeup / manual check | Query Jira, print the queue table, start the first eligible ticket immediately. |
| Empty queue | Print `No KAN tickets labeled agent_ready. Next scan in 30 min.` then schedule a wakeup for 1800 seconds. |
| Ticket blocked | Comment the blocker on Jira, leave the ticket unclosed, print the blocker, and stop without scheduling over it. |
| Ticket complete | PR open, screenshots attached, Jira commented/transitioned, then continue to the next queued ticket. |

## Ticket Pipeline

1. **Discover.** Use Atlassian MCP JQL search. Read each candidate issue's summary, description,
   acceptance criteria, status, labels, assignee, and existing PR links/comments. Skip done tickets
   and tickets already linked to an open PR unless Charlie explicitly asks for a rework.
2. **Claim.** Query available transitions and move the issue to the closest active state such as
   `In Progress` when present. Add a short Jira comment: `Starting automated implementation.`
3. **Prepare branch.** In `/Users/Charlie.Sun/Desktop/AI/AICodingGym`, sync `main`, create
   `agent/KAN-<id>-<short-slug>`, and validate with `scripts/validate.sh branch`.
4. **Implement.** Follow local `AGENTS.md`, repo patterns, and existing tests. Keep scope limited to the
   Jira acceptance criteria.
5. **Local CI gate.** All must pass before push:
   - From repo root: `npm run lint`
   - From repo root: `npm test`
   - From `backend/`: `npm test`
6. **Pre-PR code review/self-review.** Copy the review behavior from `charlie_skills`: review the full
   diff against `../C3-REVIEW-CHECKLIST.md`, mark every applicable item pass/minor/blocking or not
   applicable, and fix all blocking findings. Pay special attention to frontend correctness, null
   handling, edge cases, and no `console.*`.
7. **Browser validation.** Start the frontend and/or backend dev server required by the ticket:
   - Backend: from `backend/`, `npm run dev` on port 3001. Use `./start-backend.sh` if the port needs clearing.
   - Frontend: from repo root, `npm run dev`, normally `http://localhost:8080`.
   Use Playwright MCP to exercise the Jira acceptance criteria in the browser. Capture before/after
   screenshots when practical; otherwise capture final proof screenshots. Stop any servers you started.
8. **Commit, push, PR.** Validate commit message with `scripts/validate.sh commit`. Push and open a
   regular PR against `main`. Include ticket summary, implementation notes, tests run, browser validation,
   and screenshot placeholders in the body.
9. **Attach screenshots.** Use Playwright MCP on the GitHub PR page to edit the PR body, upload the
   screenshot files, and save the resulting GitHub attachment markdown in the PR description.
10. **Update Jira.** Add a Jira comment with the PR link, tests run, and browser validation summary.
    Transition to the closest review state such as `In Review` when available.
11. **Continue.** Return to discovery and process the next ticket. If none remain, schedule the next scan.

## Reference Values

| Thing | Value |
| --- | --- |
| Local repo | `/Users/Charlie.Sun/Desktop/AI/AICodingGym` |
| GitHub repo | `AISmithLab/AICodingGym` |
| Base branch | `main` |
| Jira project | `KAN` |
| Ready label | `agent_ready` |
| Scan interval | 1800 seconds |
| Frontend checks | `npm run lint`, `npm test` |
| Backend checks | `cd backend && npm test` |
| Dev servers | backend port 3001, frontend Vite URL normally port 8080 |
| Shared review checklist | `../C3-REVIEW-CHECKLIST.md` |
