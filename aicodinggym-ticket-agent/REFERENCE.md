# AICodingGym Ticket Agent Reference

Templates and exact output rules for the `aicodinggym-ticket-agent` skill.

## Queue Status Table

Print before starting work on a fresh scan or wakeup.

```markdown
## AICodingGym Agent Queue - <date/time>

| # | Ticket | Summary | Status | Agent Status |
|---|--------|---------|--------|--------------|
| 1 | KAN-123 | Fix login redirect | To Do | Queued - starting first |
| 2 | KAN-124 | Add challenge filter | To Do | Queued |

Queue: 2 ready tickets - Active: none - Next scan: after this cycle
```

Empty queue line:

```text
No KAN tickets labeled agent_ready. Next scan in 30 min.
```

## Pre-PR Self-Review

Use this AICodingGym-specific checklist before pushing. It is the source of truth for
pre-PR review in this skill.

Correctness is the primary focus. Mark each applicable item `PASS`, `MINOR`, or `BLOCKING`;
mark irrelevant items `N/A`. Fix all `BLOCKING` items before pushing.

Required review items:

- Acceptance criteria: the diff directly satisfies the Jira ticket and does not add unrelated scope.
- Correctness: control flow, state updates, API calls, and persistence match the intended behavior.
- Null/undefined handling: every optional value, missing response field, empty list, and absent parent is handled.
- Edge cases: empty states, failed requests, loading states, permission/auth failures, and repeated actions behave sensibly.
- Frontend behavior: UI state is accessible, responsive, and does not overlap or shift unexpectedly.
- Backend/API behavior: inputs are validated, errors return useful status/messages, and data access is scoped correctly.
- Async/concurrency: pending, retry, cancellation, and duplicate-submit paths do not corrupt state.
- Tests: changed behavior is covered by focused frontend and/or backend tests; existing tests still pass.
- Logging/debug code: no stray `console.log`, `console.error`, `debugger`, temporary comments, or test-only fixtures remain.
- Security/secrets: no tokens, secrets, private env values, or unsafe user-controlled rendering are introduced.
- Performance: no obvious unbounded loops, excessive fetches, unnecessary rerenders, or large synchronous work on hot paths.
- Browser proof: Playwright validation exercises the acceptance criteria and screenshots prove the user-visible result.

Output shape:

```markdown
### Pre-PR Self-Review

Checklist: AICodingGym ticket-agent REFERENCE.md

| Item | Result | Note |
|------|--------|------|
| Acceptance criteria | PASS | Jira behavior implemented directly |
| Null/undefined handling | PASS | Optional response fields handled |
| Edge cases | PASS | Empty and failed states tested |
| Logging/debug code | PASS | No console.* or debugger left |
| Tests | PASS | npm run lint, npm test, backend npm test |
| Browser proof | PASS | Playwright scenario and screenshots captured |

Blocking: 0 - Minor: 0
```

## Browser Validation

Use Playwright MCP after local CI and before opening the PR.

Validation output:

```markdown
### Browser Validation

- Servers started: frontend <url>, backend <url or n/a>
- Scenario: <acceptance criterion exercised>
- Result: PASS
- Screenshots:
  - <local screenshot path>: <what it proves>
```

If no meaningful browser path exists for a backend-only ticket, use the browser against an endpoint,
API docs view, or other visible proof. If there is still no meaningful visual proof, block and ask
Charlie rather than opening an unverified PR.

## Attaching Screenshots To PRs

Preferred method for AICodingGym private-repo PRs:

1. Capture screenshots locally with Playwright into `/private/tmp`, e.g.
   `/private/tmp/kan123-feature-proof.png`.
2. Copy each final proof screenshot into the PR branch under `docs/screenshots/`, using a stable
   ticket-scoped filename:

   ```bash
   mkdir -p docs/screenshots
   cp /private/tmp/kan123-feature-proof.png docs/screenshots/kan123-feature-proof.png
   ```

3. Because this adds a commit, rerun the required pre-push gate first:

   ```bash
   npm run lint
   npm test
   cd backend && npm test
   ```

4. Commit and push the screenshot with the required Jira commit format, then get the pushed commit SHA:

   ```bash
   git add docs/screenshots/kan123-feature-proof.png
   git commit -m "KAN-123: Attach validation screenshot"
   git push
   git rev-parse HEAD
   ```

5. Replace the PR `## Screenshots` section with commit-pinned GitHub blob image markdown:

   ```markdown
   ## Screenshots
   ![Short proof description](https://github.com/AISmithLab/AICodingGym/blob/<commit-sha>/docs/screenshots/kan123-feature-proof.png?raw=true)
   ```

6. Update the PR body with `gh pr edit --body-file <file>` under the required GitHub account switch.

Important details:

- Use `https://github.com/AISmithLab/AICodingGym/blob/<commit-sha>/...png?raw=true`.
- Do **not** use `https://raw.githubusercontent.com/...` for private-repo PR body images; it can show
  as `404 Not Found` without a token.
- Do **not** paste the tokenized `download_url` returned by the GitHub Contents API into the PR body.
  Those URLs are temporary and may expose access tokens.
- Avoid `https://github.com/.../raw/<branch>/...` when the branch contains slashes such as
  `agent/KAN-123-slug`; raw routes can be ambiguous. Commit-pinned `blob/<sha>/...?raw=true` is stable.

## PR Body Template

```markdown
## Summary
- <what changed>
- <why it satisfies KAN-123>

## Tests
- `npm run lint`
- `npm test`
- `cd backend && npm test`

## Browser Validation
- <scenario and result>

## Screenshots
![Short proof description](https://github.com/AISmithLab/AICodingGym/blob/<commit-sha>/docs/screenshots/<file>.png?raw=true)

Jira: <KAN-123 link>
```

## Wakeup

After a complete cycle with no active blockers:

```text
Cycle complete - <n> PR(s) opened, <n> ticket(s) blocked. Next scan in 30 min.
```

Then schedule a wakeup:

```text
ScheduleWakeup(delaySeconds: 1800, reason: "checking KAN agent_ready tickets for AICodingGym", prompt: "<<autonomous-loop-dynamic>>")
```
