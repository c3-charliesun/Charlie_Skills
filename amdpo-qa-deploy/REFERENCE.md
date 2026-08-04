# amdPoUI QA deployment — command reference

Verbatim snippets for each step of the [SKILL.md](SKILL.md) runbook. App ID is
`stgazamd2-amdpoqa-amdpricingopt` throughout. Always drive the browser via the Playwright MCP.
If a C3 Okta sign-in page appears, sign in automatically only when Charlie's credentials are
already pre-populated; otherwise (or if MFA is required) stop and prompt Charlie for guidance.

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

Verify with `allPaused()`, which returns the names of the paused queues — expect **all 22**:

```js
const paused = await InvalidationQueue.allPaused();
const stats = await InvalidationQueue.countAll();
return { pausedCount: paused.length, queueCount: stats.length, paused };
```

Do **not** verify by reading `q.paused` off `countAll()`. `countAll()` returns
`InvalidationQueueStats`, whose only fields are `type, queue, initial, pending, disabled,
computingActions, computingEntries, awaitingCompute, pendingActions, failed, unreviewedFailed` —
there is no `paused` field, so `q.paused` is always `undefined` and can serialize as `false`. The
check then reports "0 paused" whether or not the pause took effect, silently disabling the gate
that protects the upgrade. `InvalidationQueue.isPaused()` is also unusable here: on the base type
it throws `Function isPaused can not be called on base InvalidationQueue type`.

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

- Title `503 Service Temporarily Unavailable` = still upgrading (typically 5–7 min, but it has
  come back in as little as ~90s).
- Title `Console | C3 AI Platform™` = serving again.

Navigation timeouts (~60s) during this window are normal — wait 30s and retry. Don't poll with
`browser_wait_for`'s `time` argument — it has been observed not to honor the requested duration
(120s + 150s elapsed ~90s of real time). Poll out-of-band instead, e.g. a background shell loop
that exits on the first non-503 response:

```bash
URL=https://stgazamd2.c3.ai/amdpoqa/amdpricingopt/console/index.html
until [ "$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$URL")" != "503" ]; do sleep 20; done
```

(A recovered app answers `302` unauthenticated — anything that isn't `503` means the proxy is
serving again.)

**A recovered title only proves the proxy is up — it does not prove the new build is live.**
Confirm the intended versions actually landed before moving on:

```js
const rv = await Pkg.resolvedVersions();
return JSON.parse(JSON.stringify(rv)).filter(v => /^amdPoUI:|^amdPoDataModel:|^platform:/.test(v));
```

Expect `amdPoUI:` and `amdPoDataModel:` at the §1 package version and `platform:` at the §1 server
version, e.g.:

```
amdPoUI:1.1.0+583.8.9.3.139.2d9e78f417a7374812dd6e2efe6f3b3bf74ad71e.develop.uid.61859416
amdPoDataModel:1.1.0+583.8.9.3.139.2d9e78f417a7374812dd6e2efe6f3b3bf74ad71e.develop.uid.61859416
platform:8.9.3+139
```

If these still show the *previous* version, the upgrade did not take — stop and investigate. Do
not restore nodes or resume queues. Note that `Pkg.version()` returns only the base `1.1.0` and is
useless for this check.

## §6 — Restore task nodes to 10

```js
await App.nodePool('task').setNodeCount(10, 10, 30).update()
```

Poll every 30s until `taskCount === 10` (total = 12: 2 leaders + 10 task), using the §3 poll snippet.

## §7 — Resume InvalidationQueues

```js
await InvalidationQueue.resume()
```

Verify with `allPaused()` — it must come back **empty**:

```js
const paused = await InvalidationQueue.allPaused();
const stats = await InvalidationQueue.countAll();
return { stillPaused: paused, stillPausedCount: paused.length, queueCount: stats.length };
```

`stillPausedCount: 0` with `queueCount: 22` means every queue is running again. The same
`countAll().paused` caveat from §2 applies — that field does not exist.

## §8 — Report C3PRICING tickets for Charlie to transition

Find merged PRs between the previous and new SHA:

```bash
gh api repos/c3-e/c3amdpo/compare/<before_SHA>...<after_SHA> --jq '.commits[].commit.message'
```

**Report only — do not open `ontrack.amd.com` and do not transition anything.** Charlie applies these
himself. Present the tickets in chat like this:

> These tickets need **Move to Implemented** on `ontrack.amd.com`:
>
> | C3PRICING | Title | Link |
> | --- | --- | --- |
> | C3PRICING-507 | <title> | https://ontrack.amd.com/browse/C3PRICING-507 |
>
> For each, set: Issue Resolution **Fixed** · Root Cause **Ready to be tested again** ·
> Root Cause Category **AMD: Software Coding**

Values to report for every ticket:

- Issue Resolution: **Fixed**
- Root Cause: **Ready to be tested again**
- Root Cause Category: **AMD: Software Coding**

## §9 — Post deployment summary to AMD SE Teams chat

Post to the **SEs ONLY - AMD PO Working Team** chat a table of:

| APO | C3PRICING | Assignee | What it does |
| --- | --- | --- | --- |

Find the "from" SHA by checking recent messages in that chat for the last
`QA upgrade <SHA> → <SHA>` message — this tracks the actual QA state, which may differ from the CI
build SHAs. Draft the table, show Charlie, and post only on approval.
