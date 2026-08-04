# amdpo-c3-exec — reference

Copy-paste recipes and evidence backing [SKILL.md](SKILL.md). All commands below are **read-only**
unless explicitly marked.

Shell shorthand used throughout:

```bash
PERSONAL=https://stgazamd2.c3.ai/charlieamdpo02/amdpoui
DEV=https://stgazamd2.c3.ai/amdpodev/amdvirtualization3
QA=https://stgazamd2.c3.ai/amdpoqa/amdpricingopt
PROD=https://prdazamd.c3.ai/amdpricing/amdpricingprod
```

The §2 data recipes use `"$QA"` because `amdpoqa` is the env with the full dataset — counts and
aggregates from `charlieamdpo02` are partial and misleading (SKILL.md Rule 4). Swap in `"$PERSONAL"`
when the point is to exercise code you just changed rather than to learn something true about the
data.

---

## §1 Probe evidence

Everything in SKILL.md was verified live against `charlieamdpo02` (and read-only against the shared
envs). Results worth remembering:

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

The `charlieamdpo02` token from `react/.env` authenticated successfully against **both** other
stgazamd2 apps:

| Env | `PoQuotesHeader.fetchCount()` |
| --- | --- |
| `charlieamdpo02` / `amdpoui` | ~186,484 |
| `amdpoqa` / `amdpricingopt` | ~186,483 |
| `amdpodev` / `amdvirtualization3` | ~181,258 |

Counts drift over time — treat these as magnitudes for a sanity check, not exact expectations. Use
this call as the connectivity smoke test for any stgazamd2 env.

**Don't read this table as evidence the envs hold equivalent data.** `PoQuotesHeader` happens to sit
close between `charlieamdpo02` and `amdpoqa`, but `charlieamdpo02` is a partial dataset in general —
other types, views, and joins diverge much further. Landing on one near-matching type is exactly the
trap that makes a wrong answer look right, which is why live data questions go to `amdpoqa`
(SKILL.md Rule 4).

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
TOK=$(grep '^export C3_AUTH_COOKIE=' ~/Desktop/c3amdpo/.c3_credentials/stgazamd2_charlieamdpo02_amdpoui | cut -d'"' -f2)
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
- `charlieamdpo02` needs none of this.
