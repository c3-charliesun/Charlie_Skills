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

Use the shared checklist at `../C3-REVIEW-CHECKLIST.md` as the source of truth, the same way
`amd-ticket-pipeline` and `pr-reviewer` use it.

For AICodingGym, apply the checklist pragmatically:

- Treat C3-specific items as not applicable unless the diff actually touches C3 code.
- Always apply correctness, null handling, edge cases, frontend, logging, and test/build items.
- Mark each applicable item `PASS`, `MINOR`, or `BLOCKING`.
- Fix all `BLOCKING` items before pushing.

Output shape:

```markdown
### Pre-PR Self-Review

Checklist: ../C3-REVIEW-CHECKLIST.md

| Item | Result | Note |
|------|--------|------|
| Null/undefined handling | PASS | Covered affected optional fields |
| Edge cases | PASS | Empty state tested |
| No console logging | PASS | No console.* added |
| Frontend build/lint/test | PASS | npm run lint, npm test |

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
<!-- Upload screenshots with Playwright after PR creation and replace this section with attachment markdown. -->

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
