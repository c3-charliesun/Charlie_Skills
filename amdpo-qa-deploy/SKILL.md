---
name: amdpo-qa-deploy
description: >-
  Deploy an amdPoUI build to the amdpoqa QA environment on stgazamd2.c3.ai end-to-end —
  pull the package + server version from a Studio build, pause InvalidationQueues, drain task
  nodes, run the app upgrade, wait out the 503, restore nodes, resume queues, and post the
  deployment summary to the AMD SE Teams chat. Use when Charlie wants to push a build to QA /
  upgrade amdpoqa / run the QA deployment runbook for amdPoUI on stgazamd2.
---

# amdPoUI QA deployment (amdpoqa on stgazamd2.c3.ai)

Ordered runbook to upgrade the `amdpoqa` app to a new `amdPoUI` build, then announce the deploy.
Run the steps **in order** — each depends on the previous. Verbatim console/API snippets live in
[REFERENCE.md](REFERENCE.md).

## Hard rules

0. **Always drive the browser via the Playwright MCP.** Every browser session in this runbook (Studio build page, both consoles) must be run through the Playwright MCP. If a C3 Okta sign-in page appears, check whether Charlie's credentials are already pre-populated: if so, sign in automatically; if not (or MFA is required), stop and prompt Charlie for guidance.
1. **Two different consoles.** Queue/node steps run on the **amdpricingopt** console
   (`/amdpoqa/amdpricingopt/console/`). The upgrade (Step 4) runs on the **c3** console
   (`/amdpoqa/c3/console/`). Do not mix them up.
2. **Verify queue pause/resume with `InvalidationQueue.allPaused()`.** It returns the paused queue
   names — 22 after Step 2, empty after Step 7. Never read `q.paused` off `countAll()`: that field
   does not exist on `InvalidationQueueStats`, so the check always reads "not paused" and silently
   passes even when the pause failed.
3. **Leader nodes never drain.** Task drain target is `taskCount === 0` (leaders remain, expected).
   Restore target is `taskCount === 10` (total 12 = 2 leaders + 10 task).
4. **A `BatchError` with an empty `errors` array on upgrade is success** — it means the upgrade
   was accepted, not that it failed.
5. **503 during Step 5 is normal.** Title `503 Service Temporarily Unavailable` = still upgrading
   (5–7 min typical, sometimes ~90s); navigation timeouts (~60s) in this window are expected —
   wait 30s, retry. Don't rely on `browser_wait_for`'s `time` argument for the wait; it has been
   observed not to honor the requested duration. Poll out-of-band (§5 has a shell loop).
6. **A recovered page title is not proof the build landed.** Step 5 is only green once
   `Pkg.resolvedVersions()` shows the Step 1 package + server versions. Never resume queues or
   restore nodes before that.
7. **Teams post is a write action — get Charlie's approval on the drafted table before posting.**
   Post to the **SEs ONLY - AMD PO Working Team** chat, nowhere else.

## Steps

**1. Get the amdPoUI package + server version.** On the Studio branches page for
`github-c3-e-c3amdpo--po-develop--develop`, open the target build → **All packages (3)** →
`amdPoUI`. The UI label is truncated, so extract the full version via console
(`document.body.innerText.match(/1\.1\.0\+\S+/)?.[0]`). Also note the short **SHA** and the
**SERVER VERSION** (e.g. `8.9.3+139`) from the build detail page. See [REFERENCE.md](REFERENCE.md) §1.

**2. Pause InvalidationQueues.** On the **amdpricingopt** console, `await InvalidationQueue.pause()`,
then verify `InvalidationQueue.allPaused()` lists **all 22** queues. [REFERENCE.md](REFERENCE.md) §2.
Before moving on, also capture the **currently deployed** `amdPoUI` version with
`Pkg.resolvedVersions()` — its embedded commit SHA is the Step 8 "from" SHA. [REFERENCE.md](REFERENCE.md) §2.

**3. Drain task nodes to 0.** `App.nodePool('task').setNodeCount(0,0,0).update()`, then poll every
30s until `taskCount === 0` (leaders remain). [REFERENCE.md](REFERENCE.md) §3.

**4. Run the upgrade.** Switch to the **c3** console and call
`C3.env().upgradeAppById("stgazamd2-amdpoqa-amdpricingopt", { serverVersion, rootPkgVersion })`
with the values from Step 1. Empty-`errors` `BatchError` = accepted. [REFERENCE.md](REFERENCE.md) §4.

**5. Poll until QA recovers from the 503, then confirm the build landed.** Poll the amdpricingopt
console every 30s until the page title is `Console | C3 AI Platform™`, then check
`Pkg.resolvedVersions()` shows the Step 1 `amdPoUI` package version and `platform` server version.
The title alone only proves the proxy is serving. [REFERENCE.md](REFERENCE.md) §5.

**6. Restore task nodes to 10.** `App.nodePool('task').setNodeCount(10,10,30).update()`, poll every
30s until `taskCount === 10` (total 12). [REFERENCE.md](REFERENCE.md) §6.

**7. Resume InvalidationQueues.** `await InvalidationQueue.resume()`, then verify
`InvalidationQueue.allPaused()` comes back **empty**. [REFERENCE.md](REFERENCE.md) §7.

**8. Post the deployment summary to Teams.** 🔒 Draft, show Charlie, post on approval. Post to the
**SEs ONLY - AMD PO Working Team** chat a table of **APO ↔ C3PRICING ↔ Assignee ↔ What it does**.
The "from" SHA is the one captured in Step 2 (pre-upgrade `amdPoUI` version on QA); the "to" SHA is
Step 1's. Diff them with `gh api repos/c3-e/c3amdpo/compare/<from>...<to>` to list the merged PRs. If the
last `QA upgrade <SHA> → <SHA>` message in the chat disagrees with the Step 2 SHA, flag it to Charlie.
[REFERENCE.md](REFERENCE.md) §8.

## Reference values

| Thing | Value |
| --- | --- |
| App ID | `stgazamd2-amdpoqa-amdpricingopt` |
| Cluster host | `stgazamd2.c3.ai` |
| Studio branch | `github-c3-e-c3amdpo--po-develop--develop` |
| amdpricingopt console | `https://stgazamd2.c3.ai/amdpoqa/amdpricingopt/console/index.html` |
| c3 console (upgrade) | `https://stgazamd2.c3.ai/amdpoqa/c3/console/index.html` |
| Package version regex | `/1\.1\.0\+\S+/` |
| Queue count | 22 (verify with `allPaused()` — 22 paused, then empty) |
| Upgrade-landed check | `Pkg.resolvedVersions()` → `amdPoUI:` + `platform:` match Step 1 |
| Task node target | drain 0/0/0 → `taskCount 0`; restore 10/10/30 → `taskCount 10` (total 12) |
| GitHub repo | `c3-e/c3amdpo` |
| Teams target | **SEs ONLY - AMD PO Working Team** chat |
