---
name: pr-reviewer
description: >-
  Reviews a single pull request in the c3amdpo repo: checks CI status, reviews the diff against a
  correctness + C3-conventions checklist (validated with the C3 MCP docs tools), checks for
  conflicts with other open PRs, and drafts a GitHub review (APPROVE / REQUEST_CHANGES / COMMENT).
  APPROVE auto-submits; REQUEST_CHANGES and COMMENT always wait for Charlie's explicit approval.
  PRs Charlie authored himself are drafted the same way but always wait for his approval and submit
  as a comment, since GitHub blocks self-approval. Use when Charlie asks to review a specific
  c3amdpo PR (e.g. "review PR 1148" or "/pr-reviewer review 1148"). Checklist and output templates
  live in REFERENCE.md.
---

# PR Reviewer

Reviews one c3amdpo PR per invocation — Charlie gives a PR number, this reviews that PR. The full
review checklist and exact output templates are in [REFERENCE.md](REFERENCE.md).

## Hard Rules

- **APPROVE auto-submits (unless the PR is self-authored).** On a clean APPROVE for a PR authored by someone other than Charlie, submit immediately via `gh pr review --approve` — no draft-and-wait. Print the submitted message after. Self-authored PRs never auto-submit — see the self-authored rule below.
- **REQUEST_CHANGES and COMMENT always wait.** Draft → present → stop → submit only on Charlie's explicit approval or edits. Never auto-send either — both notify real colleagues with actionable asks.
- **NEVER REQUEST_CHANGES on test-syntax findings while CI is pending.** If the only blocking finding is bad test syntax and CI hasn't finished, defer (`⏸ Deferred — test-syntax finding, CI pending`) and re-check once CI completes. If CI then **fails** and the fix is clear, draft REQUEST_CHANGES with the exact corrected test syntax. Non-test blocking findings proceed regardless of CI state (note the test-syntax issue as ⚠️ pending CI).
- **ALWAYS write High/Medium conflicts into the draft** as a `### Merge conflict heads-up` section (Step 3). A conflict detected but not written into the comment is a hard failure.
- **ALWAYS validate C3 platform findings with MCP tools** (`search_c3_documentation`, fallback `ask_c3_question`) before flagging — never from memory alone. Cite the docs in the finding.
- **NEVER end without a clear status.** After the PR reaches a verdict, either present the draft awaiting Charlie's reply, or confirm the submitted result — never trail off.
- **Self-authored PRs (author `c3-charliesun`) are triaged and drafted like any other PR — never skip them.** Run the full checklist and reach a normal verdict (`APPROVE` / `REQUEST_CHANGES`). The only difference is at submission time: ALWAYS draft-and-wait for Charlie's explicit approval, even on a clean APPROVE — GitHub rejects self-approval outright, so there's no auto-submit path here regardless of verdict. On approval, submit via `gh pr review --comment` (never `--approve`/`--request-changes`), opening the body with the drafted verdict framed as a self-review, e.g. `**Self-review — would APPROVE.**` or `**Self-review — would REQUEST_CHANGES.**` (note *why* — GitHub blocks self-approval).

## Step 1 — Triage the PR

```bash
gh pr view <PR#> --repo <org>/c3amdpo --json number,title,author,body,reviewDecision,reviews,isDraft
gh pr checks <PR#> --repo <org>/c3amdpo
```

**Already reviewed by Charlie, no re-request** → report that and stop; don't re-review unless Charlie explicitly asks for a re-review.

**CI check**: green → proceed. Red → if an author comment dismisses the failure ("unrelated", "flake", "pre-existing"), treat as green; otherwise flag it to Charlie before drafting a verdict. Pending → may review, but the test-syntax deferral rule (Hard Rules) applies at verdict time.

## Step 2 — Review

- **2a. Load relevant C3 skills.** `.c3typ` → `c3-type-generation`, `c3-type-documentation` · `.py`/`.js` impls → `c3-testing` · `react/`/`.tsx` → follow `@frontend-c3.md`.
- **2b. Context summary.** 3–5 bullets from the PR body, linked Jira, and diff: **Problem** / **Expected behavior** / **Approach**.
- **2c. Open-PR conflict check.** List this PR's files (`gh pr diff <PR#> --name-only`), list other open PRs and their files (`gh pr list --repo <org>/c3amdpo --state open --json number,title,author,files`), intersect. **Direct conflict** = same file in both PRs; **logical conflict** = same C3 type family (e.g. both touch `SomeType.c3typ` / `SomeType.js`). Emit the Conflict Check table (template in REFERENCE.md); High/Medium MUST carry into the Step 3 comment.
- **2d. Checklist review.** Mark every item in the shared checklist (`../C3-REVIEW-CHECKLIST.md`, via [REFERENCE.md](REFERENCE.md)) ✅ / ⚠️ (minor) / ❌ (blocking), one-line note for each non-✅.

## Step 3 — Verdict, Draft & Submission

**Test-syntax gate (before settling on a verdict):** if the only blocking findings are bad test
syntax and CI is still pending, do NOT draft — mark the PR `⏸ Deferred — test-syntax finding, CI
pending` and re-check once CI completes. Once CI fails and the fix is clear, proceed with
REQUEST_CHANGES and include the exact corrected test code.

Present, in order: **context summary** (2b), **conflict check** (2c), **full checklist** (every item
✅/⚠️/❌ with a one-line note for non-✅), then the **review message**:

- Open with the verdict (`APPROVE` / `REQUEST_CHANGES` / `COMMENT`) + a 2–3 sentence summary of the PR and overall assessment.
- Each ❌ and significant ⚠️ gets its own 2–4 sentence paragraph: file/line, the problem, why it matters, concrete suggested fix.
- `### Merge conflict heads-up` section whenever 2c found High/Medium conflicts: each PR's number, author, overlapping files, risk, and a one-line recommendation (e.g. "rebase after #1004 merges"). Mandatory when conflicts exist.
- On APPROVE/COMMENT, note one or two things the PR does well.
- Substantive paragraphs, peer-reviewer tone — roughly 1.5× a terse review, no filler; a clean APPROVE stays short.

Then route by verdict:

- **APPROVE** (PR not self-authored) → submit immediately, no wait: `gh pr review <PR#> --repo <org>/c3amdpo --approve --body "<message>"`. Report the submitted message.
- **REQUEST_CHANGES / COMMENT** (PR not self-authored) → **stop and wait** for Charlie's approval or edits. Only on his go-ahead: `gh pr review <PR#> --repo <org>/c3amdpo --<request-changes|comment> --body "<message>"`.
- **Self-authored PR (any verdict)** → **stop and wait** for Charlie's approval or edits, same as REQUEST_CHANGES/COMMENT above — present the verdict (`APPROVE`/`REQUEST_CHANGES`) and message as normal, just don't auto-submit. Only on his go-ahead, submit as a comment: `gh pr review <PR#> --repo <org>/c3amdpo --comment --body "<message>"`, with the message opening `**Self-review — would <VERDICT>.**` (plus a one-line note that GitHub blocks self-approval).
