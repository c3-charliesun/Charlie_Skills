---
name: amdpo-c3-exec
description: >-
  Run JavaScript or Python on the AMD PO C3 environments with the `c3 exec` CLI — resolve the
  right auth token, target the correct app URL, read data, and decode CLI errors. Covers
  charlieamdpo02 (personal), amdpodev (dev), amdpoqa (QA) on stgazamd2.c3.ai, and amdpricing
  (prod) on prdazamd.c3.ai. Live data questions (counts, views, tables, aggregates) go to amdpoqa
  because charlieamdpo02 holds only partial data. Use when Charlie wants to query, inspect, count,
  or probe data in
  any of these environments, mentions `c3 exec` / `c3 auth`, asks to "run this on QA / dev /
  prod", needs a C3 auth token resolved or refreshed, or hits a `c3 exec` auth or syntax error.
---

# AMD PO environments via `c3 exec`

Operating guide for reaching the four AMD PO apps from the CLI. Copy-paste recipes, probe
evidence, and the approval template live in [REFERENCE.md](REFERENCE.md).

## Hard rules

1. **NEVER run a write operation in `amdpodev`, `amdpoqa`, or `amdpricing` (prod) unless Charlie
   explicitly approves that specific operation.** `charlieamdpo02` is Charlie's personal
   workspace — writes there need no approval.
2. **Write pre-flight for the three shared envs.** Before any write: name the target env, echo the
   exact code you intend to run, state what it will change, then **stop and wait** for approval.
   Approval is per-operation, not per-session. Use the template in [REFERENCE.md](REFERENCE.md) §5.
3. **Never invent, guess, forge, or scrape a token.** If no valid token is resolvable through the
   ladder below, stop and ask Charlie for a fresh one.
4. **Pick the env by intent, not habit.**
   - **Live data questions → `amdpoqa`.** Counts, view/table queries, aggregates, distributions,
     "how many / how much / what does the data look like" — all run against `amdpoqa`.
     `charlieamdpo02` holds only a partial dataset, so its numbers come back plausible but wrong,
     which is worse than an error. Reads on `amdpoqa` are safe; Rule 1 gates only writes.
   - **Writes, experiments, testing a method you just changed → `charlieamdpo02`**, the one env
     where writes need no approval.
   - When Charlie names an env, use that one.
5. **Never use a `stgazamd2` token against `prdazamd`** (or the reverse). Prod auth is separate.

### What counts as a write

`create` · `upsert` · `update` · `merge` · `remove` · `removeAll` · `Pkg.upsertAllSeed()` ·
`InvalidationQueue.pause()` / `resume()` · node-pool changes (`App.nodePool(...).update()`) ·
`c3 app upgrade|stop|start|terminate` · `c3 env` lifecycle · `c3 sync` · `c3 seed` ·
config `setConfig` / `clearConfig` / secret writes · `CronJob` start/stop/pause/trigger ·
starting BatchJobs, MapReduce jobs, or ML train/process jobs · DataLake table writes ·
Snowflake DDL/DML · anything that enqueues async work.

If you are unsure whether a call writes, treat it as a write and ask.

## Environment matrix

| Env | `-s` app URL | Use for | Write policy |
| --- | --- | --- | --- |
| personal | `https://stgazamd2.c3.ai/charlieamdpo02/amdpoui` | writes, experiments, testing changed code — **partial data, don't trust counts** | writes OK, no approval needed |
| dev | `https://stgazamd2.c3.ai/amdpodev/amdvirtualization3` | dev-specific checks | read-only unless approved |
| qa | `https://stgazamd2.c3.ai/amdpoqa/amdpricingopt` | **all live data queries** (counts, views, tables, aggregates) | read-only unless approved |
| prod | `https://prdazamd.c3.ai/amdpricing/amdpricingprod` | only when prod-specific data is the question | read-only unless approved |

`-s` takes the **bare app URL** — `https://<cluster>/<env>/<app>`. The
`/console/index.html` form is for the browser and the `/api/1/<cluster>/<env>/<app>` form is for
REST; neither works with `c3 exec`.

Platform apps are reachable the same way when needed, e.g. `https://stgazamd2.c3.ai/amdpoqa/c3`.

## Token resolution

### stgazamd2 — one token serves all three envs

A token minted for `charlieamdpo02` authenticates against `amdpodev` and `amdpoqa` too
(verified). So a working token for any one of the three unblocks the other two.

1. **Just run it.** `c3 exec -s <appUrl> '<code>'` — the CLI resolves a token on its own. Read its
   first line of output: `Using cached authentication token` (good), `Cached token expired,
   re-authenticating...` or `Using token from browser cookie` (it recovered on its own), or an
   auth error (continue down the ladder).
2. **Fall back to `.env`.** Take `VITE_REACT_C3_AUTH` from
   `c3amdpo/amdpo/amdPoUI/react/.env` and pass it with `-t`.
3. **Then the credentials file.** `C3_AUTH_COOKIE` in
   `c3amdpo/.c3_credentials/stgazamd2_charlieamdpo02_amdpoui`.
4. **Check expiry before using a token from 2 or 3** — decode the JWT payload and read `exp`,
   which is **epoch milliseconds**, not seconds. Snippet in [REFERENCE.md](REFERENCE.md) §4.
5. **Still nothing valid → ask Charlie.** He generates one with
   `Authenticator.generateActionAuthToken()` in any C3 console. Cache it with
   `c3 auth -t <token> -s <appUrl>` so later calls reuse it.

**Don't reach for `-t` first.** An expired token passed via `-t` *overrides* the CLI's own working
resolution and turns a call that would have succeeded into
`Server returned HTML instead of JSON`. Verified: with an expired `.env` token, the same command
succeeded without `-t` (via browser cookie) and failed with it. Always try step 1 bare, and only
pass `-t` after the CLI itself fails.

### prdazamd (prod) — separate, never in `.env`

The prod token is independent of the stgazamd2 tokens and **is never present in `.env`** — do not
go looking for it there. It lives only in the CLI cache/keychain. If the cached prod token is
missing or expired, **ask Charlie for a new one**. Never substitute a stgazamd2 token.

### Cache mechanics

The index is `~/.c3cli/config.json`; token bodies live in the macOS keychain. Entries are keyed by
**(project directory, app URL)** — so the working directory changes which cache slot is used, and a
token cached from `~/Desktop/c3amdpo` is not seen from `/tmp`.

- `c3 auth --list` — show all cached tokens (project, server, cache time, token prefix)
- `c3 auth -t <token> -s <appUrl>` — cache a token directly
- `c3 auth --clear --workspace <dir>` — clear that workspace's tokens
- `C3_AUTH_TOKEN` and `C3_SERVER_URL` env vars are also honored

## `c3 exec` syntax

```bash
c3 exec [-s <appUrl>] [-t <token>] [--py|--ts] <CODE|file> [-- <ARGS>...]
```

`<CODE>` is either inline source or a path to a file. For a file, the extension picks the language;
`--py` / `--ts` only matter for inline code. Default for inline is JavaScript.

### JavaScript (default)

Two forms both work:

```bash
# main() with args passed after --
c3 exec -s <appUrl> 'function main(a, b) { return a + "-" + b; }' -- foo bar

# bare top-level statements; the last expression is the result
c3 exec -s <appUrl> 'PoQuotesHeader.fetchCount()'
c3 exec -s <appUrl> 'var x = 5; var y = 6; x * y'
```

Use **bare type names** in JS — `PoQuotesHeader.fetchCount()`, not `c3.PoQuotesHeader...`.

Two JS gotchas worth knowing up front: `.map()` over a fetched collection returns a C3 **indexed
map**, not a JS array (so `JSON.stringify` gives `{"0":..,"1":..}` — push into a plain `[]` instead),
and `get` is a **member** function, so read one record via `X.forId(id).get("this")` rather than
`X.get(id, "this")`. Both are covered in [REFERENCE.md](REFERENCE.md) §2.

### Python — single expression only

Python runs through `Py.eval`, which accepts **exactly one expression**. `def main():` and any
multi-statement script fail with `SyntaxError: invalid syntax (Py.py#90)` — this is not a bug in
your code.

```bash
# works
c3 exec --py -s <appUrl> 'c3.PoQuotesHeader.fetchCount()'
c3 exec --py -s <appUrl> '[o.id for o in c3.PoQuotesHeader.fetch({"limit": 2, "include": "id"}).objs]'

# fails — multi-statement
c3 exec --py -s <appUrl> 'r = c3.PoQuotesHeader.fetchCount()
print(r)'
```

Python requires the **`c3.` prefix**. When logic needs more than one statement, either chain it into
a comprehension or **write it in JavaScript instead** — JS supports full multi-statement bodies.

### Output

Results come back as nested `Boxed<...>` JSON, which gets verbose for collections. Wrap the result
in `JSON.stringify(...)` in JS to get one compact string:

```bash
c3 exec -s <appUrl> 'JSON.stringify({count: PoQuotesHeader.fetchCount()})'
```

## Decoding errors

| Message | What it actually means |
| --- | --- |
| `Server returned HTML instead of JSON (check if app is running)` | **Auth failure** — bad or expired token. The app is almost certainly fine; ignore the hint and fix the token. |
| `ReferenceError: "X" is not defined` (`Js.execEs`) | The type doesn't exist in that app, or a `c3.`-prefixed name was used in JS. |
| `SyntaxError: invalid syntax (Py.py#90)` (`Py.eval`) | Multi-statement Python. Collapse to one expression or switch to JS. |
| `status 500 Internal Server Error` wrapping a message | Normal envelope for an app-side exception — read the inner message, not the 500. |
| `BatchError` with an empty `errors` array | Success, not a failure (shows up on upgrade-style calls). |

A bad `-t` value gets cached, but the CLI recovers on the next call by re-authenticating, so a
single failed attempt does not poison the cache.

## Quick smoke test

`PoQuotesHeader.fetchCount()` returns a large non-zero count in all three stgazamd2 envs and is a
safe read-only way to confirm connectivity and auth. Run it against whichever env you're about to
use. Observed magnitudes are in [REFERENCE.md](REFERENCE.md) §1 — note the counts differ per env,
which is exactly why live data questions belong on `amdpoqa` (Rule 4).
