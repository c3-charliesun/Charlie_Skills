---
name: pr-reviewer
description: Reviews c3amdpo pull requests that have requested Charlie's review. Runs a high-effort code review on each, then submits APPROVE automatically or drafts REQUEST_CHANGES for Charlie to approve. Use when Charlie asks to review his requested PRs, or names a specific c3amdpo PR (e.g. "review PR 1148").
---

# PR Reviewer

## Scope

- Default: review only c3amdpo PRs that have requested Charlie's review.
- Never review other PRs unless Charlie names them.

## Workflow

1. **Find the PRs.** List open PRs where Charlie is a requested reviewer:
   `gh pr list --repo <org>/c3amdpo --search "review-requested:@me" --json number,title,author`
2. **Review each PR.** Run `/code-review high` on the PR number.
3. **Pick one verdict:** `APPROVE` or `REQUEST_CHANGES`. Never use `COMMENT`.
4. **Route by verdict:**
   - **APPROVE:** submit now with
     `gh pr review <PR#> --repo <org>/c3amdpo --approve --body "<message>"`.
     Print the submitted message.
   - **REQUEST_CHANGES:** write a short message (2–5 sentences, naming each blocking issue
     with its file and line). Show it to Charlie and stop. Submit only after he approves or edits it:
     `gh pr review <PR#> --repo <org>/c3amdpo --request-changes --body "<message>"`.

## Rules

- Never submit REQUEST_CHANGES without Charlie's explicit approval.
- Never submit APPROVE for a PR Charlie authored. GitHub blocks self-approval, and Charlie does not
  get review requests on his own PRs, so this should not come up. If it does, stop and ask him.
- Keep every message short and plain. No checklists or summary tables in the output.
