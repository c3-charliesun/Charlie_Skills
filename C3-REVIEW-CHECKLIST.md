# C3 Review Checklist (shared)

Single source of truth for the correctness + C3-conventions checks applied to **c3amdpo** code.
Two skills point here:

- **pr-reviewer** (review time) — mark each item ✅ / ⚠️ (minor, non-blocking) / ❌ (blocking) per PR
  in Step 2d, with a one-line note for every non-✅.
- **amd-ticket-pipeline** (author time) — self-review the diff against this list in the Step 6
  pre-push gate, *before* `c3-code-review` runs. **Pay special attention to the [PY] and [TSX]
  items:** `c3-code-review` / BUGBOT.md scope excludes `.py` and `react/**/*.tsx`, so those rules
  are caught here or not at all.

Correctness is the primary focus. Validate any C3-platform finding against the MCP docs
(`search_c3_documentation`, fallback `ask_c3_question`) before flagging — never from memory alone.

File-type tags: **[JS]** src `.js` · **[PY]** `.py` · **[TSX]** `react/**/*.tsx` · **[TYP]** `.c3typ` ·
**[DATA]** seed/data files · **[ALL]** any.

## Correctness & logic
- [ ] [JS][PY] `fetch()` includes `"include": "this, objectField.this"` for every object-type field
- [ ] [JS][PY] Filter builder, not raw strings: `.and_()` in Python, `.and()` in JS
- [ ] [JS][PY][TYP] Impl return type matches `.c3typ`; `cls` ↔ static, `this` ↔ `member` keyword
- [ ] [ALL] Null/None/undefined handled at every potentially-absent access
- [ ] [JS] C3 Array API: `.each()` not `.forEach()`, `.get(i)` not `arr[i]`
- [ ] [JS][PY] `fetch().objs` to unwrap; partial updates via `.merge()`, not `.update()`
- [ ] [JS][PY] No `limit: -1` on potentially large collections
- [ ] [ALL] Edge cases: empty collections, missing parents, zero-result fetches

## C3 conventions
- [ ] [TYP] No `id`/`meta`/`version`/`type`/`make` as field names; persistable types are `entity type`
- [ ] [PY][JS] `c3.` prefix in Python only — never in JS
- [ ] [ALL] No `console.log` / `console.error` / `print`
- [ ] [DATA] `seed/<Type>/` only if the type mixes `SeedData`, else `data/<Type>/`; no `meta`/`type`/`version` in data files
- [ ] [ALL] No README.md in packages; no `applyTo` blocks
- [ ] [TSX] Frontend: `npm run build` + `npm run lint` confirmed passing (else flag untested); correct `c3Action` / `c3MemberAction` / `c3CreateAction` pattern

## Blind spots the pipeline's `c3-code-review` step does NOT cover
`c3-code-review` reviews only `.c3typ`, src `.js`, `seed/**`, `test/js-rhino/**`, and package-root
`.json`. It explicitly skips:

- **Python (`.py`)** — hand-check the [PY] items above (esp. `.and_()`, `c3.` prefix, `cls`/`this`,
  fetch `include`, `.merge()` vs `.update()`).
- **React (`react/**/*.tsx`)** — hand-check the [TSX] / [ALL] items (esp. correct `c3Action` variant,
  no `console.*`, build + lint pass).
