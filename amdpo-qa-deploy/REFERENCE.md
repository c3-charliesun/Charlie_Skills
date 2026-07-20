# amdPoUI QA deployment — command reference

Verbatim snippets for each step of the [SKILL.md](SKILL.md) runbook. App ID is
`stgazamd2-amdpoqa-amdpricingopt` throughout. Always drive the browser via the Playwright MCP.

## §1 — Get the amdPoUI package + server version

1. Navigate to the Studio branches page:
   `https://stgazamd2.c3.ai/c3ai/studio/release-management/branches/github-c3-e-c3amdpo--po-develop--develop`
2. Find the target build, click it, scroll to **All packages (3)** → click **amdPoUI**.
3. The UI label is truncated. Extract the full package version from the browser console:

```js
document.body.innerText.match(/1\.1\.0\+\S+/)?.[0]
```

4. From the build detail page, note the short **SHA** and the **SERVER VERSION** (e.g. `8.9.3+139`).

## §2 — Pause InvalidationQueues (amdpricingopt console)

Console: `https://stgazamd2.c3.ai/amdpoqa/amdpricingopt/console/index.html`

```js
await InvalidationQueue.pause()
```

Verify all 22 queues show `paused: true` (field is `paused`, NOT `isPaused`):

```js
const result = await InvalidationQueue.countAll();
return result.map(q => ({ queue: q.queue, paused: q.paused }));
```

## §3 — Drain task nodes to 0

```js
await App.nodePool('task').setNodeCount(0, 0, 0).update()
```

Poll every 30s until `taskCount === 0` (leader nodes always remain — expected):

```js
const nodes = await App.nodes();
const taskNodes = nodes.filter(n => n.id.includes('apptask'));
return { taskCount: taskNodes.length };
```

## §4 — Run the upgrade (c3 console — different URL)

Console: `https://stgazamd2.c3.ai/amdpoqa/c3/console/index.html`

```js
await C3.env().upgradeAppById("stgazamd2-amdpoqa-amdpricingopt", {
  serverVersion: "<SERVER_VERSION>",   // e.g. "8.9.3+139"
  rootPkgVersion: "<PACKAGE_VERSION>"  // full version string from §1
})
```

A `BatchError` with an empty `errors` array is **normal** — it means the upgrade was accepted.

## §5 — Poll until QA recovers from 503

Poll the amdpricingopt console every 30s:

- Title `503 Service Temporarily Unavailable` = still upgrading (typically 5–7 min).
- Title `Console | C3 AI Platform™` = back up ✅

Navigation timeouts (~60s) during this window are normal — wait 30s and retry.

## §6 — Restore task nodes to 10

```js
await App.nodePool('task').setNodeCount(10, 10, 30).update()
```

Poll every 30s until `taskCount === 10` (total = 12: 2 leaders + 10 task), using the §3 poll snippet.

## §7 — Resume InvalidationQueues

```js
await InvalidationQueue.resume()
```

Verify all 22 queues show `paused: false` (using the §2 verify snippet).

## §8 — Transition C3PRICING tickets to "Implemented"

Find merged PRs between the previous and new SHA:

```bash
gh api repos/c3-e/c3amdpo/compare/<before_SHA>...<after_SHA> --jq '.commits[].commit.message'
```

For each C3PRICING ticket referenced, navigate to `ontrack.amd.com` (browser only — AMD Okta, no MCP)
and click **Move to Implemented** with:

- Issue Resolution: **Fixed**
- Root Cause: **Ready to be tested again**
- Root Cause Category: **AMD: Software Coding**

## §9 — Post deployment summary to AMD SE Teams chat

After transitioning tickets, post to the **SEs ONLY - AMD PO Working Team** chat a table of:

| APO | C3PRICING | Assignee | What it does |
| --- | --- | --- | --- |

Find the "from" SHA by checking recent messages in that chat for the last
`QA upgrade <SHA> → <SHA>` message — this tracks the actual QA state, which may differ from the CI
build SHAs. Draft the table, show Charlie, and post only on approval.
