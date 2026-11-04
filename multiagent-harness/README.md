# Multi-agent harness for AISmithLab/MicroBenchmark

Four unattended agents that keep the MicroBenchmark repo moving between them. Each file here is the full prompt for one of them. **These files are the source of truth.** Make every change here.

| Lane | Prompt | Runs |
| --- | --- | --- |
| Testing lane | [testing-lane.md](testing-lane.md) | Daily at midnight PT |
| Maintenance lane | [maintenance-lane.md](maintenance-lane.md) | Every 3 hours |
| Staging lane | [staging-lane.md](staging-lane.md) | 6am and 6pm PT |
| PR reviewer | [pr-reviewer.md](pr-reviewer.md) | Every 15 minutes when there is work, on Charlie's Mac |

## How they fit together

```
            files tickets                        builds tickets
 Testing lane ─────────┐                 ┌──► Maintenance lane ──► lane:maintenance PR ──► PR reviewer fixes + squash-merges
 Maintenance lane ─────┼──► Jira KAN ────┤
 PR reviewer ──────────┘  (routing label)└──► Staging lane ──────► lane:staging PR ──────► PR reviewer reviews only
                                                                    (≤3 tickets, ≤5 open)    staging lane fixes findings
                                                                                             Charlie merges by hand
```

- **Testing lane** clicks through the app in a headless browser against seeded fake data and files up to 5 tickets per run. It never writes code.
- **Maintenance lane** builds small `maintenance-lane` tickets, opening one PR each, and files tickets for problems it finds in the repo.
- **Staging lane** builds medium `staging-lane` tickets onto staging PRs and fixes the PR reviewer's findings on them. Charlie reviews and merges these, using the `staging-pipeline` skill in this repo.
- **PR reviewer** reviews, fixes and squash-merges maintenance PRs. It reviews staging PRs and teammates' PRs without changing them, and leaves Charlie's hand-made PRs alone.
- Big features, `human-only` tickets and `needs-triage` decisions belong to Charlie.

### Routing labels

Every ticket a lane files has exactly one routing label, which says who builds it:

- `maintenance-lane`: small, up to about 300 lines.
- `staging-lane`: medium, up to about 800 lines.
- `needs-triage`: waits for an `Owner's decision:` comment.
- `human-only`: off-limits areas or big work.

It also has one source label, which says who found it: `found-by-testing`, `found-by-maintenance`, `found-by-reviewer` or `found-by-staging-lane`. A ticket with no routing label is Charlie's own, and no lane touches it.

### Signatures

Everything is posted from the same GitHub account, so comments are signed:

- `— Automated PR reviewer`
- `— Staging lane`

Anything unsigned is Charlie. Lane PRs also end with a marker line, such as `Opened by the maintenance lane.`

## Editing the prompts

- **Shared blocks must stay identical in all four files:** the four-lane summary paragraph, *No AI attribution* and *Routing labels*. When you change one, change it everywhere.
- If you change how one lane behaves toward another (labels, signatures, caps, schedules), update the other prompts that depend on it in the same commit.
