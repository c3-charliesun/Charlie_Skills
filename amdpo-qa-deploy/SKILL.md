---
name: amdpo-qa-deploy
description: >-
  Deploy an amdPoUI build to the amdpoqa QA environment on stgazamd2.c3.ai end-to-end —
  pull the package + server version from a Studio build, pause InvalidationQueues, drain task
  nodes, run the app upgrade, wait out the 503, restore nodes, resume queues, report the C3PRICING
  tickets in the build for Charlie to transition to "Implemented", and post the deployment summary to
  the AMD SE Teams chat. Use when Charlie wants to push a build to QA / upgrade amdpoqa / run the QA
  deployment runbook for amdPoUI on stgazamd2.
---

# amdPoUI QA deployment (amdpoqa on stgazamd2.c3.ai)

Ordered runbook to upgrade the `amdpoqa` app to a new `amdPoUI` build, then close out the
tickets and announce the deploy. Run the steps **in order** — each depends on the previous.
Verbatim console/API snippets live in [REFERENCE.md](REFERENCE.md).

## Hard rules

0. **Always drive the browser via the Playwright MCP.** Every browser session in this runbook (Studio build page, both consoles) must be run through the Playwright MCP. If a C3 Okta sign-in page appears, check whether Charlie's credentials are already pre-populated: if so, sign in automatically; if not (or MFA is required), stop and prompt Charlie for guidance.
1. **Two different consoles.** Queue/node steps run on the **amdpricingopt** console
   (`/amdpoqa/amdpricingopt/console/`). The upgrade (Step 4) runs on the **c3** console
   (`/amdpoqa/c3/console/`). Do not mix them up.
2. **Field is `paused`, not `isPaused`.** When verifying queues, read `q.paused`.
3. **Leader nodes never drain.** Task drain target is `taskCount === 0` (leaders remain, expected).
   Restore target is `taskCount === 10` (total 12 = 2 leaders + 10 task).
4. **A `BatchError` with an empty `errors` array on upgrade is success** — it means the upgrade
   was accepted, not that it failed.
5. **503 during Step 5 is normal.** Title `503 Service Temporarily Unavailable` = still upgrading
   (5–7 min typical); navigation timeouts (~60s) in this window are expected — wait 30s, retry.
   Done when the title is `Console | C3 AI Platform™`.
6. **Never resume queues or restore nodes before the app is confirmed back up** (Step 5 green).
7. **Never transition C3PRICING tickets yourself.** Step 8 is report-only: list the tickets and the field
   values, and let Charlie apply them on `ontrack.amd.com`. Don't open the browser for this step.
8. **Teams post is a write action — get Charlie's approval on the drafted table before posting.**
   Post to the **SEs ONLY - AMD PO Working Team** chat, nowhere else.

## Steps

**1. Get the amdPoUI package + server version.** On the Studio branches page for
`github-c3-e-c3amdpo--po-develop--develop`, open the target build → **All packages (3)** →
`amdPoUI`. The UI label is truncated, so extract the full version via console
(`document.body.innerText.match(/1\.1\.0\+\S+/)?.[0]`). Also note the short **SHA** and the
**SERVER VERSION** (e.g. `8.9.3+139`) from the build detail page. See [REFERENCE.md](REFERENCE.md) §1.

**2. Pause InvalidationQueues.** On the **amdpricingopt** console, `await InvalidationQueue.pause()`,
then verify **all 22** queues show `paused: true` (field is `paused`). [REFERENCE.md](REFERENCE.md) §2.

**3. Drain task nodes to 0.** `App.nodePool('task').setNodeCount(0,0,0).update()`, then poll every
30s until `taskCount === 0` (leaders remain). [REFERENCE.md](REFERENCE.md) §3.

**4. Run the upgrade.** Switch to the **c3** console and call
`C3.env().upgradeAppById("stgazamd2-amdpoqa-amdpricingopt", { serverVersion, rootPkgVersion })`
with the values from Step 1. Empty-`errors` `BatchError` = accepted. [REFERENCE.md](REFERENCE.md) §4.

**5. Poll until QA recovers from the 503.** Poll the amdpricingopt console every 30s until the page
title is `Console | C3 AI Platform™`. [REFERENCE.md](REFERENCE.md) §5.

**6. Restore task nodes to 10.** `App.nodePool('task').setNodeCount(10,10,30).update()`, poll every
30s until `taskCount === 10` (total 12). [REFERENCE.md](REFERENCE.md) §6.

**7. Resume InvalidationQueues.** `await InvalidationQueue.resume()`, verify all 22 show
`paused: false`. [REFERENCE.md](REFERENCE.md) §7.

**8. Report the C3PRICING tickets for Charlie to transition.** Diff the previous → new SHA to find merged PRs
(`gh api repos/c3-e/c3amdpo/compare/<before_SHA>...<after_SHA> --jq '.commits[].commit.message'`).
List every referenced C3PRICING ticket in chat with its title and a direct `ontrack.amd.com` link, plus the
field values to apply: Issue Resolution **Fixed** · Root Cause **Ready to be tested again** · Root Cause
Category **AMD: Software Coding**. **Do not open the browser and do not transition anything** — Charlie does
these himself. [REFERENCE.md](REFERENCE.md) §8.

**9. Post the deployment summary to Teams.** 🔒 Draft, show Charlie, post on approval. Post to the
**SEs ONLY - AMD PO Working Team** chat a table of **APO ↔ C3PRICING ↔ Assignee ↔ What it does**.
The "from" SHA comes from the last `QA upgrade <SHA> → <SHA>` message in that chat (it tracks the
actual QA state, which can differ from CI build SHAs) — not from the git history.
[REFERENCE.md](REFERENCE.md) §9.

## Reference values

| Thing | Value |
| --- | --- |
| App ID | `stgazamd2-amdpoqa-amdpricingopt` |
| Cluster host | `stgazamd2.c3.ai` |
| Studio branch | `github-c3-e-c3amdpo--po-develop--develop` |
| amdpricingopt console | `https://stgazamd2.c3.ai/amdpoqa/amdpricingopt/console/index.html` |
| c3 console (upgrade) | `https://stgazamd2.c3.ai/amdpoqa/c3/console/index.html` |
| Package version regex | `/1\.1\.0\+\S+/` |
| Queue count | 22 (verify field `paused`) |
| Task node target | drain 0/0/0 → `taskCount 0`; restore 10/10/30 → `taskCount 10` (total 12) |
| GitHub repo | `c3-e/c3amdpo` |
| C3PRICING | `ontrack.amd.com` — **report only, Charlie transitions** |
| Transition values to report | Fixed / Ready to be tested again / AMD: Software Coding |
| Teams target | **SEs ONLY - AMD PO Working Team** chat |
