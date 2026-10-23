# amdpo-c3-exec — reference

Copy-paste recipes and evidence backing [SKILL.md](SKILL.md). All commands below are **read-only**
unless explicitly marked.

Shell shorthand used throughout:

```bash
PERSONAL=https://stgazamd2.c3.ai/charlieamdpo03/amdpoui
DEV=https://stgazamd2.c3.ai/amdpodev/amdvirtualization3
QA=https://stgazamd2.c3.ai/amdpoqa/amdpricingopt
PROD=https://prdazamd.c3.ai/amdpricing/amdpricingprod
```

The §2 data recipes use `"$QA"` because `amdpoqa` is the env with the full dataset — counts and
aggregates from `charlieamdpo03` are partial and misleading (SKILL.md Rule 4). Swap in `"$PERSONAL"`
when the point is to exercise code you just changed rather than to learn something true about the
data.

---

## §1 Probe evidence

Everything in SKILL.md was originally verified live against `charlieamdpo02` (and read-only against
the shared envs); `charlieamdpo03` replaced it as the personal sandbox on 2026-08-20, mirroring the
same Snowflake schema isolation (`instanceDatabaseSchemaMap.C3` → `DB_C3_OUTBOUND_DEV.C3_PRICING_DEV2`)
and JDBC store setup. Results worth remembering:

| Probe | Result |
| --- | --- |
| `'function main() { return 1 + 1; }'` | `Boxed<double> 2.0` — `main()` form works |
| `'1+1'` (no `main`) | `Boxed<double> 2.0` — bare expression works |
| `'var x = 5; var y = 6; x * y'` | `Boxed<double> 30.0` — JS multi-statement top-level works |
| `'function main(a, b) {...}' -- foo bar` | `Boxed<string> "foo-bar"` — args flow through `--` |
| `--py '1+1'` | `Boxed<int> 2` — inline Python expression works |
| `--py 'def main(): ...'` | `SyntaxError: invalid syntax (Py.py#90)` — **no `def main()` in Python** |
| `.py` file with two statements | same `SyntaxError` — file form doesn't help |
| `.py` file with one bare expression | works |
| `--py '[o.id for o in c3.X.fetch(...).objs]'` | works — comprehensions are the multi-step workaround |
| `.js` file with a full `main()` body | works, including `fetch` + a `for` loop |
| `'JSON.stringify(...)'` | `Boxed<string>` — compact output trick |
| `X.get("id", "this")` | 400 parameter mismatch — `get` is a **member** fn, use `X.forId(id).get("this")` |
| `JSON.stringify(objs.map(...))` | yields `{"0":..,"1":..}` — `.map()` returns an indexed map, not a JS array |
| `objs.map(...).toArray()` | fails — `toArray` needs an explicit `arrayType` argument |
| `-t <bogus token>` | `Server returned HTML instead of JSON (check if app is running)` |
| `-t <expired token>` | same error — an expired `-t` **overrides** the CLI's own working token resolution, so the identical call succeeds *without* `-t` and fails *with* it |
| no `-t`, expired `.env` | `Using token from browser cookie` → succeeded; the ladder self-recovers |
| next call after bogus token | recovered automatically — cache not permanently poisoned |
| `NoSuchType.fetchCount()` | `ReferenceError: "NoSuchType" is not defined` |
| `TenantConfig.tag()` in JS | `ReferenceError` — not every platform type is in scope in the app |
| `C3_AUTH_TOKEN=<tok> c3 exec ...` | works — env var honored |

### Cross-env token reuse (the key finding)

The `charlieamdpo03` token from `react/.env` authenticates successfully against **both** other
stgazamd2 apps (verified pattern; carried over from `charlieamdpo02`):

| Env | `PoQuotesHeader.fetchCount()` |
| --- | --- |
| `charlieamdpo03` / `amdpoui` | ~181,258 |
| `amdpoqa` / `amdpricingopt` | ~186,483 |
| `amdpodev` / `amdvirtualization3` | ~181,258 |

Counts drift over time — treat these as magnitudes for a sanity check, not exact expectations. Use
this call as the connectivity smoke test for any stgazamd2 env.

**Don't read this table as evidence the envs hold equivalent data.** `charlieamdpo03` is a partial
dataset in general — other types, views, and joins diverge much further from `amdpoqa`. Landing on
one near-matching type is exactly the trap that makes a wrong answer look right, which is why live
data questions go to `amdpoqa` (SKILL.md Rule 4).

`prdazamd` was confirmed to authenticate from its own separately cached token (probed with `1+1`
only — no prod data touched).

---

## §2 Read-only recipes

### Count rows

```bash
c3 exec -s "$QA" 'PoQuotesHeader.fetchCount()'
c3 exec --py -s "$QA" 'c3.PoQuotesHeader.fetchCount()'
```

### Fetch a few ids

`.map()` on a C3 collection returns an **indexed map**, so `JSON.stringify` of it yields
`{"0":"a","1":"b"}` rather than an array. Push into a plain `[]` when you want real JSON array
output:

```bash
c3 exec -s "$QA" 'var r = PoQuotesHeader.fetch({limit: 5, include: "id"}); var out = []; for (var i = 0; i < r.objs.length; i++) { out.push(r.objs[i].id); } JSON.stringify(out)'
```

`.toArray()` does **not** fix this — it requires an explicit `arrayType` argument and fails with
`Invalid value null for parameter: arrayType`.

### Inspect one full record

```bash
c3 exec -s "$QA" 'JSON.stringify(PoQuotesHeader.fetch({limit: 1, include: "this"}).objs[0])'
```

### Fetch by id

`get` is a **member** function taking only `include` — `PoQuotesHeader.get(id, "this")` fails with a
400 parameter-mismatch. Go through `forId`:

```bash
c3 exec -s "$QA" 'JSON.stringify(PoQuotesHeader.forId("C10001-000").get("this"))'
```

Or filter in a `fetch`:

```bash
c3 exec -s "$QA" 'JSON.stringify(PoQuotesHeader.fetch({filter: "id == \"C10001-000\"", include: "id", limit: 1}).objs[0].id)'
```

### Filtered count

```bash
c3 exec -s "$QA" 'PoQuotesHeader.fetchCount({filter: "exists(id)"})'
```

### Compare the same metric across all three stgazamd2 envs with one token

```bash
TOK=$(grep '^VITE_REACT_C3_AUTH=' ~/Desktop/c3amdpo/amdpo/amdPoUI/react/.env | cut -d= -f2-)
for U in "$PERSONAL" "$DEV" "$QA"; do
  echo "== $U"
  c3 exec -s "$U" -t "$TOK" 'PoQuotesHeader.fetchCount()'
done
```

### Multi-step logic — use a JS file

Python can't do this; JS can. Write the file, then exec it:

```javascript
// /tmp/probe.js
function main() {
  var r = PoQuotesHeader.fetch({ limit: 2, include: 'id' });
  var ids = [];
  for (var i = 0; i < r.objs.length; i++) {
    ids.push(r.objs[i].id);
  }
  return JSON.stringify({ count: r.count, ids: ids });
}
```

```bash
c3 exec -s "$QA" /tmp/probe.js
```

### Check what's cached / cache a token

```bash
c3 auth --list
c3 auth -t "$TOK" -s "$QA"
c3 auth --clear --workspace /tmp     # scoped clear
```

---

## §3 Python one-liners that survive `Py.eval`

`Py.eval` allows one expression. Patterns that fit:

```bash
# comprehension over a fetch
c3 exec --py -s "$QA" '[o.id for o in c3.PoQuotesHeader.fetch({"limit": 3, "include": "id"}).objs]'

# dict literal to bundle several reads
c3 exec --py -s "$QA" '{"headers": c3.PoQuotesHeader.fetchCount()}'

# conditional expression instead of if/else
c3 exec --py -s "$QA" '"many" if c3.PoQuotesHeader.fetchCount() > 1000 else "few"'

# len() over a comprehension instead of a loop with a counter
c3 exec --py -s "$QA" 'len([o for o in c3.PoQuotesHeader.fetch({"limit": 50, "include": "id"}).objs])'
```

If none of these fit the task, switch to JavaScript rather than fighting `Py.eval`.

---

## §4 Decode a JWT's expiry

`exp` is **epoch milliseconds**. Divide by 1000 before converting.

```bash
python3 -c "
import base64, json, datetime, sys
tok = sys.argv[1]
p = tok.split('.')[1]
p += '=' * (-len(p) % 4)
d = json.loads(base64.urlsafe_b64decode(p))
exp = datetime.datetime.fromtimestamp(d['exp'] / 1000, datetime.timezone.utc)
now = datetime.datetime.now(datetime.timezone.utc)
print('app:   ', d.get('app'))
print('user:  ', d.get('id'))
print('groups:', d.get('groups'))
print('expires:', exp)
print('now:    ', now)
print('EXPIRED' if exp <= now else 'valid for ' + str(exp - now))
" "$TOK"
```

Read the token straight out of `.env`:

```bash
TOK=$(grep '^VITE_REACT_C3_AUTH=' ~/Desktop/c3amdpo/amdpo/amdPoUI/react/.env | cut -d= -f2-)
```

Or out of the credentials file:

```bash
TOK=$(grep '^export C3_AUTH_COOKIE=' ~/Desktop/c3amdpo/.c3_credentials/stgazamd2_charlieamdpo03_amdpoui | cut -d'"' -f2)
```

These tokens are short-lived (hours), so re-check expiry rather than assuming a token that worked
earlier in the session still works.

### Asking for a fresh token

> The cached and `.env` tokens for `<env>` are both expired (expired at `<time>`). Can you generate
> a new one? In a C3 console on `<env>`, run `Authenticator.generateActionAuthToken()` and paste the
> result here.

For prod, always ask — the prod token is never in `.env`.

---

## §5 Write-approval template

Required before **any** write to `amdpodev`, `amdpoqa`, or `amdpricing`. Show this, then stop.

> **Write approval needed — `<env name>` (`<app URL>`)**
>
> What I want to run:
>
> ```javascript
> <exact code, verbatim>
> ```
>
> What it changes: `<types/records/config affected, approximate row counts>`
> Reversible: `<yes + how / no>`
> Why: `<one line>`
>
> Approve?

Notes:

- Approval covers **that one operation**. A second write needs a second approval.
- If a read-only investigation uncovers a needed fix, still stop and ask — don't chain a write onto
  the end of a read.
- `charlieamdpo03` needs none of this — it's Charlie's testing ground; read/write/delete freely
  there as long as it serves the task at hand.

---

## §6 Syncing a branch to an env (`c3 sync`)

**Write operation.** Free on `charlieamdpo03` and `charlieamdpo04`; needs §5 approval anywhere else.
Inside an `amd-ticket-pipeline` run, hold an env lock first (`amd-ticket-pipeline/env-lock.sh`, Step
4b) — other agents may be syncing too, and the script hands you whichever of 03/04 is free. Swap
that env's name into every URL below and use its dev-server port (03 → 8000, 04 → 8001).

```bash
SYNC_TARGET=https://stgazamd2.c3.ai/charlieamdpo03/dev   # the IDE app, NOT /amdpoui
```

### Recipes

```bash
# A PR's branch — find its worktree, then sync from there
gh pr view 1174 --json headRefName -q .headRefName       # -> bugfix/cs/APO-1317
git worktree list | grep 'APO-1317'                      # -> path of the worktree
cd <that path> && c3 sync -f -v -s "$SYNC_TARGET" --no-tty

# Latest develop — move a CLEAN worktree onto it (detached, no branch needed)
git status --short                                       # must print nothing
git fetch origin develop -q && git checkout --detach origin/develop
c3 sync -f -s "$SYNC_TARGET" --no-tty

# Keep syncing while you edit
c3 sync -w -f -s "$SYNC_TARGET" --no-tty

# Confirm the app survived
c3 app status amdpoui -s https://stgazamd2.c3.ai/charlieamdpo03
```

When running it from an agent, run it in the background and wait for `✓ Synced <N> files` (or
`Worker error`) in the output instead of polling with `sleep`. The output is a spinner stream —
strip ANSI codes and split on `\r` to read it.

### Which app to target

`c3 app list -s https://stgazamd2.c3.ai/charlieamdpo03` shows two apps:

| App | Root package | Role |
| --- | --- | --- |
| `amdpoui` | `amdPoUI` | runs the application — target for `c3 exec` |
| `dev` | `ide` | the workbench app with the `Ide` upload type — target for `c3 sync` (and what the VS Code extension uses) |

Packages are shared across the env, so code uploaded through `dev` is what `amdpoui` runs.

### Evidence (2026-10-08)

| Attempt | Result |
| --- | --- |
| `c3 sync -s .../charlieamdpo03/amdpoui` | spun on `Comparing with server` ~30 min, nothing uploaded |
| same, with `-f` | spun on `Uploading (0/3)` indefinitely; the 3 files are package declarations (0 KB) |
| same, with `-w -f -v` | same hang |
| same, with `RUST_LOG=debug` | revealed `Worker error: Ide.writeEncodedContents failed with status 404 Not Found: Missing TypeMeta Ide in pkg amdPoUI` |
| `c3 sync -f -v -s .../charlieamdpo03/dev` from PR 1174's worktree | `✓ Synced 774 files` in minutes; `amdpoui` stayed RUNNING |
| `c3 sync -f -s .../charlieamdpo03/dev` from a worktree on `origin/develop` | `✓ Synced 777 files`; `amdpoui` stayed RUNNING |

The `Ide.setupWorkspacePackages ... 404` warning printed at startup is the early tell that `-s`
points at the wrong app. Against `dev` it does not appear.

### Frontend-only changes: no sync needed

Changes only under `amdpo/amdPoUI/react/src` run in a local Vite server that proxies `/api` to the
env (`vite.config.js`), so the env never needs the code:

```bash
cd <worktree>/amdpo/amdPoUI/react
VITE_REACT_C3_BASE_URL=https://stgazamd2.c3.ai VITE_REACT_C3_ENV=charlieamdpo03 \
VITE_REACT_C3_APP=amdpoui VITE_REACT_C3_AUTH="$TOK" npm run dev -- --port 8000    # 03 serves :8000; use --port 8001 and ENV=charlieamdpo04 for 04
```

Passing these as env vars means no `.env` file is written in the worktree.
