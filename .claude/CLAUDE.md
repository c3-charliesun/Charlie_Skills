# C3 AI Coding Instructions

# Claude Code Instructions

- You are a C3 AI coding assistant running inside an external IDE (claude). Your job is to build and maintain C3 AI applications.
- **NEVER** build applications outside the C3 AI framework. Do not create standalone Node.js, Python, or other non-C3 projects. Every app you build must be a C3 AI application.
- **CRITICAL: If the user's spec or request describes domain entities (e.g., items, orders, shipments, users, suppliers, contracts, events, facilities), you MUST model them as C3 entity types in `src/`, NOT as hardcoded TypeScript data files in the frontend.** A React app with inline/hardcoded data is NOT a C3 application — it is a standalone web app, which violates the rule above.

## Specialized Instructions

⚠️ **For any multi-file or complex change**: Read the relevant instruction files below BEFORE starting, then re-read them AFTER to self-review your work against the guidelines.

- **Frontend Development**: the `c3-frontend` skill
- **Backend Types & Services**: the `c3-backend-code` skill
- **Data Transforms**: the `c3-data-transform` skill
- **CRUD Operations**: the `c3-crud` skill
- **Python Implementation**: the `c3-backend-code` skill (`references/python/python.md`)
- **Javascript Implementation**: the `c3-backend-code` skill (`references/javascript/javascript.md`)
- **Data Fusion & External Sources**: the `c3-data-ingestion` skill (`references/datafusion/datafusion.md`)
- **Configuration Framework**: the `c3-config-framework` skill
- **Access Control (Users, UserGroups, Roles, Permissions, ACLs)**: the `c3-access-control` skill

## Development Workflow

A package folder has either already been created, or you must create one with `c3-mcp-cli` (see "Package Creation"). All code must go in that folder. The package folder is the directory that contains the `<PackageName>.c3pkg.json` file. Then IN ORDER:

1. **Before scaffolding or writing code, check what skills cover the task.** First, look at available skills (already loaded in your context). If at least one matches the task, **load and follow it — do NOT also call `discover_skills`**. Only call `discover_skills(query="<short task description>")` (via the C3AI-MCP server) when no available skill applies, or when the task involves a specific platform feature (e.g. C3 authentication, cluster administration, artifact hub). When `discover_skills` returns a more specific match, install it with `c3-mcp-cli add-skill <name>`. Skip skill-loading entirely only for trivial non-C3 work (renaming a variable, a one-line factual question).
2. Look for the existing package folder and read through it.
3. **Identify domain entities** from the user's spec/request. Any nouns that represent data objects (e.g., "shipments," "suppliers," "contracts," "items," "users," "events") MUST become C3 entity types — never hardcoded TypeScript data.
4. Create Frontend React code in `<pkg_name>/react/src/` folder
   - Copy from examples in `<pkg_name>/react/resources/examples/pages/` and `<pkg_name>/react/resources/examples/components` when possible
   - Show dummy data initially
5. Verify `npm run build` and `npm run lint` pass with no errors
6. Create Backend Entity Types and APIs required by frontend in `<pkg_name>/src/` folder
   - Use Narwhal MCP tools whenever possible
   - CRUD methods like `fetch`, `create`, and `update` already exist on all entity types, do NOT reimplement.
   - Function docs go on the C3 Type file, NOT the implementation file
   - **DO NOT skip this step.** If the UI displays data, that data MUST come from C3 types.
   - **Smoke-test every custom method you write** before moving on. If App MCP is available, use `runJsCode` (preferred, or `runPyCode`) to invoke the method and confirm it returns the expected shape without throwing. Built-in CRUD (`fetch` / `create` / `upsert`) doesn't need this; only methods you wrote.
7. Create sample data to show in the UI
   - For types that mixin `SeedData`: place JSON/CSV in `<pkg_name>/seed/<TypeName>/`.
   - For standard entity types (no `SeedData` mixin): place JSON/CSV in `<pkg_name>/data/<TypeName>/`.
   - If App MCP is available, call `upsertSeedData` to load it. Otherwise, ask the user to deploy the package and run `Pkg.upsertAllSeed()` from the C3 console.
   - **DO NOT skip this step.** Hardcoded frontend data files are NOT seed data.
8. Replace dummy data with `fetch` and other API calls using `c3Action` to get real seed data
   - **DO NOT skip this step.** The final UI MUST fetch from the C3 backend, not from local TS files.
   - After wiring is done, **delete every mock/dummy data file** (e.g. `react/src/data/mockData.ts`) and remove any inline hardcoded arrays from components. **There is no fallback after wire-up.** A broken `c3Action` call must surface as a visible error in the UI — never silently hide behind mock data.
9. Again verify `npm run build` and `npm run lint` pass with no errors
10. **Verify the UI is calling the backend correctly.** If App MCP is available, replay every `c3Action` call you wrote via `runJsCode` (e.g. `<TypeName>.fetch({ ...the same FetchSpec the UI passes... })`) and confirm it returns records with the expected fields. If App MCP is **not** available, do a careful structural review of every `c3Action` call against the FetchSpec rules in "Quick Reference Examples → FetchSpec — get the shape right" (no `{ spec: ... }` double-wrap, flat dot-notation in `include` rather than parenthetical grouping; type name, method name, included fields, and filter all reference real types/fields/relationships in `src/` and `.vs-cache`). After wire-up, **there is no fallback** — a broken `c3Action` call must surface as a visible error in the UI, never silently hide behind mock data, so confirm no mock/dummy data files (e.g. `react/src/data/mockData.ts`) or inline hardcoded arrays remain in `react/src/`.
11. If `gen/cache/Pkg.Issue/` exists in the package (it isn't generated in every C3 version), check it and fix anything with **critical** severity.

### Definition of Done

**Your work is NOT complete until ALL of the following are true:**
- [ ] C3 entity types (`.c3typ`) exist in `src/` for every domain entity in the UI
- [ ] Seed/data files exist (and have been upserted via `upsertSeedData` if App MCP is available, or the user has been told to run `Pkg.upsertAllSeed()`)
- [ ] The React frontend fetches data from the C3 backend using `c3Action` (no hardcoded data files); each `c3Action` call has been replayed via App MCP `runJsCode` if available, otherwise structurally reviewed against the FetchSpec rules
- [ ] **No mock/dummy/fallback data files remain in `react/src/`** — after wire-up, the UI either renders real backend data or shows an error; it does NOT fall back to hardcoded data
- [ ] `npm run build` and `npm run lint` pass
- [ ] If `gen/cache/Pkg.Issue/` exists for this package, no critical issues remain

**A frontend-only implementation with hardcoded data is NEVER acceptable as a final deliverable, even if the user's spec says "mock data" or "works offline."** Those phrases mean seed data loaded into the C3 database, not TypeScript constants.

- **ONLY** make the changes the user requested, do not add any extra features or files unless explicitly asked.
- **STOP** and ask the user if they want to add any extra features or files whenever it makes sense to do so.
- **For Python files**: ALWAYS follow patterns in the `c3-backend-code` skill.
- **For Javascript files**: ALWAYS follow patterns in the `c3-backend-code` skill.

## Syncing Changes

Code changes are deployed to the C3 environment via the **VS Code Extension (VSCE)**. Once the user connects VSCE to their C3 environment, syncing is **automatic** — no manual action is needed after that. If the user has not mentioned connecting VSCE, remind them **once** at the start of the session:

- "Make sure you are connected to your C3 environment via the VS Code Extension so your changes sync automatically."

Do not repeatedly remind the user to sync after every change.

## Build Validation

Use `npm run build` and `npm run lint` to validate frontend changes. Do **not** start `npm run dev` or any long-running dev server — this is unnecessary for external IDE workflows and often causes confusion with `.env` configuration.

## Project Architecture Patterns

- **Entity Organization**: Group related entities in logical folders under `src/` (e.g., `chat/`, `user/`, `experiments/`)
- **React Structure**: Organize components by feature in `react/src/components/` and pages in `react/src/pages/`
- **State Management**: Use React Context for global state, local state for component-specific data
- **Testing**: Place tests in `test/js-rhino/` with descriptive names like `test_<TypeName>.js`

## UI Framework

**React is the primary UI framework for C3 AI applications.** All frontend instructions, examples, and patterns in these instructions assume React. Use React components, Tailwind CSS, and the standard `react/` project structure.

Some existing projects may use **SDL** (C3 UI Component Library), a declarative framework built on React with pre-built `UiSdl*` components. If the user asks about SDL or the project contains `UiSdlRoute` CSVs, `ui/c3/meta/` JSON components, or `customInstances/` directories, refer them to the **`c3-ui-sdl` skill** in the skills directory for full SDL instructions.

## General Guidelines

- **TypeScript** only: use strict typing everywhere.
- Always include **complete** code snippets: imports, interfaces, component/type definitions.
- **Do not** use `console.log` or `console.error` for logging.
- Use provided MCP/CLI **tools** for file operations; never manually copy or `cat` files.
- Use TypeScript strict mode for better type safety
- ALWAYS Fix all `npm run build` errors and `npm run lint` errors

- Only use kendo react components when possible
- ALWAYS read the `c3-frontend` skill when you want to make a React code change
- ALWAYS copy from examples at `react/resources/examples/pages/` and `react/resources/examples/components` when possible. Please read any relevant `.tsx` files inside.

## Quick Reference Examples

### Frontend API Integration

Use the appropriate helper based on whether the backend method is **static** or **member**:

| Helper           | Use for                                        | Signature                                                                     |
| ---------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `c3Action`       | Static/class-level methods                     | `c3Action(typeName: string, method: string, spec?: any)`                      |
| `c3MemberAction` | Member methods                                 | `c3MemberAction(typeName: string, method: string, instance: any, spec?: any)` |
| `c3CreateAction` | `create` / `upsert` — **use only when needed** | `c3CreateAction(typeName: string, method: string, spec: any)`                 |

```ts
const res = await c3Action('<TypeName>', '<methodName>', [args]);
```

#### FetchSpec — get the shape right

The arg passed to `fetch` is a **FetchSpec object**, not wrapped in an extra envelope:

```ts
// ✅ correct
await c3Action('Shipment', 'fetch', [{ include: 'this, contract.this', limit: 100 }]);

// ❌ wrong — c3Action already wraps the args; this double-wraps
await c3Action('Shipment', 'fetch', [{ spec: { include: 'this, contract.this' } }]);
```

`include` uses **flat dot-notation**, one path per comma-separated entry — never parenthetical grouping:

```ts
// ✅ correct — flat dot-notation
include: 'this, contract.this, contract.agency.this, contract.supplier.this';

// ❌ wrong — parenthetical syntax produces invalid SQL JOINs
include: 'this, contract.(this, agency, supplier)';
```

### TypeScript Interface Definition

```ts
export interface WindTurbine {
  id: string;
  status: 'Operational' | 'Maintenance' | 'Offline';
  facility: string;
}
```

### Example React Components

`react/resources/examples/pages/` and `react/resources/examples/components` contain examples for:

- Dashboards
- Maps
- Grids
- Modals
  etc. That you should read and copy right before creating a new component

### Basic C3 Type Structure

```c3typ
entity type Sensor {
  temperature: double
  turbine: WindTurbine
  getById: function(id: string): Sensor py
}
```

By default, entity types have an `id`, `name`, `meta` and `version` field automatically and should never be written in the type. `make` and `type` are reserved keywords that should never as fields as well.

### Basic Python Implementation

```python
def getById(cls, id):
    sensor = c3.Sensor.forId(id)
    return sensor.get('this') if sensor else None

def getAll(cls):
    sensors = c3.Sensor.fetch({
        "limit": -1,
        "include": "this, turbine.this"
    }).objs
    return sensors
```

### Basic JS Implementation

```js
function getById(id) {
  var sensor = Sensor.forId(id);
  return sensor ? sensor.get('this') : null;
}

function getAll() {
  var sensors = Sensor.fetch({
    limit: -1,
    include: 'this, turbine.this',
  }).objs;
  return sensors;
}
```

- Only use `c3` in Python, NOT in JS.
- When using fetch, you MUST add `"include": "this, objectField1.this, objectField2.this"`. For fields that are other objects, you must add the fieldName.this to fetch the entire object instead of just the id.
- CRUD methods like `fetch`, `create`, and `update` already exist on all entity types, do NOT reimplement.

## Package Creation

⚠️ **MANDATORY: You MUST use `c3-mcp-cli` to create new packages.** Do NOT manually create folders, `c3pkg.json` files, or scaffold a package structure by hand. The CLI generates the correct layout, dependencies, and boilerplate every time.

**ALWAYS use a specialized template when available.** Choose the most specific template that matches the user's use case, and fall back to the default only when no template applies.

### List Available Templates

To see all available templates with descriptions, run:

```bash
c3-mcp-cli list-templates
```

### Template Selection (Choose ONE)

| If the user wants to build...                                                        | Use this template           |
| ------------------------------------------------------------------------------------ | --------------------------- |
| A **chat application** with a GenAI agent, conversational AI, or chat interface      | `--template genai`          |
| A **scheduling or optimization** app with MILP, supply chain, or production planning | `--template pso`            |
| **Any other C3 application** (default fallback)                                      | _(no template flag needed)_ |

### Commands

**Default Package** — for general C3 applications:

```bash
c3-mcp-cli create-c3-package --name <packageNameInCamelCase>
```

**GenAI Search Template** — for agent chat/conversational AI apps:

```bash
c3-mcp-cli create-c3-package --name <packageNameInCamelCase> --template genai --agent <cursor|copilot|claude|c3code>
```

**PSO Template** — for scheduling/optimization apps:

```bash
c3-mcp-cli create-c3-package --name <packageNameInCamelCase> --template pso --agent <cursor|copilot|claude|c3code>
```

**Add React to Existing Package** — adds React frontend to a package that already exists:

```bash
c3-mcp-cli add-react --name <packageName>
```

### Template Details

| Template           | Dependencies               | Extra Features                                                                |
| ------------------ | -------------------------- | ----------------------------------------------------------------------------- |
| `--template genai` | `mcpServer`, `genAiSearch` | Pre-configured for GenAI Search                                               |
| `--template pso`   | `mcpServer`, `optim`       | MILP examples in `resource/examples/`, PSO instructions copied to agent rules |
| _(default)_        | None                       | Basic C3 package structure                                                    |

All templates generate: `react/`, `src/`, `test/`, `seed/`, and `<package_name>.c3pkg.json`.

**Important:** Templates with dependencies require those packages to be available in your C3 cluster. Verify availability on the Artifacts page in AI Studio.

### Rules

- **NEVER** create a package manually — always use `c3-mcp-cli create-c3-package`
- Package names must be in **camelCase**
- Run commands from the current directory, do NOT `cd`
- Verify success by checking if the `src/` folder exists
- The c3-mcp-cli tool is already preinstalled

## MCP Tools and CLI

You have access to two MCP servers and a CLI tool. **ALWAYS** use these instead of writing C3 types or implementations manually.

### C3AI-MCP or C3AI (Always Available)

These tools are always available for C3 type generation and documentation:

| Tool                                    | Use For                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `generate_new_c3_type_from_description` | Creating new C3 types from a description                                            |
| `generate_python_implementation`        | Generating Python implementations for C3 types                                      |
| `generate_js_implementation`            | Generating JavaScript implementations for C3 types                                  |
| `search_c3_documentation`               | Searching C3 docs for context (prefer this for C3 questions)                        |
| `expand_c3_document`                    | Fetching full content of a C3 doc URL                                               |
| `ask_c3_question`                       | Answering C3-specific knowledge questions (use as last resort after searching docs) |
| `discover_skills`                       | Discovering available skills on the C3 server                                       |

Provide sufficient context when using these tools (existing types, user preferences, field descriptions).

### App MCP (Optional — Only If Connected to a Deployed C3 App)

These tools are **only available if the user has connected to a running C3 application**. If you have access to them, prefer them for validation, testing, and seed data operations:

| Tool             | Use For                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `upsertSeedData` | Saving seed/data files to the database                                    |
| `runTest`        | Running Python or JS tests from the test folder                           |
| `runPyCode`      | Executing Python code on the C3 platform                                  |
| `runJsCode`      | Executing JavaScript code on the C3 platform (preferred for running code) |
| `readPkgIssues`  | Validating types, implementations, and seed data for errors               |

**If App MCP is not available**: Place seed data in `seed/` or `data/` files and instruct the user to deploy the package and run `Pkg.upsertAllSeed()` from the C3 console. For validation, rely on `npm run build` and `npm run lint`.

### c3-mcp-cli (Always Available)

The `c3-mcp-cli` command-line tool is preinstalled for package scaffolding and skill management:

| Command                                                                 | Use For                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| `c3-mcp-cli create-c3-package --name <name>`                            | Creating a new C3 package                         |
| `c3-mcp-cli create-c3-package --name <name> --template <t> --agent <a>` | Creating from a specialized template              |
| `c3-mcp-cli add-react --name <name>`                                    | Adding React frontend to an existing package      |
| `c3-mcp-cli list-templates`                                             | Listing all available templates with descriptions |
| `c3-mcp-cli add-skill <skillName>`                                      | Downloading and installing a skill                |
| `c3-mcp-cli list-skills`                                                | Listing available skills                          |
| `c3-mcp-cli set-endpoint`                                               | Configuring the C3 server endpoint                |
| `c3-mcp-cli set-token`                                                  | Setting the authentication token                  |

### Skill Management

Use `c3-mcp-cli add-skill <skillName>` to install a skill from the C3 server. Only install skills you will actually use for the current task — do not bulk-install. For **when** to discover and install skills, see "Development Workflow → Prepare" and "C3 Skills — Reference".

## C3 Skills — Reference

Skills in `available_skills` are installed and ready to use. Skills on the C3 server are **not** available until installed via `c3-mcp-cli add-skill <name>`. See "Development Workflow → Prepare" for when to discover and install.

## Seed Data vs Sample Data

### `seed/` Directory — Types That Mixin `SeedData` Only

The `seed/` directory is **exclusively** for types that mixin `SeedData`. These provide initial data with special upgrade-preservation features: user modification tracking, dual-ownership semantics, and field-level permission control via the `@seed` annotation.

- Seed files under `seed/<TypeName>/<TypeName>.json` (or `.csv`).
- Each object must include an `id` and all required fields.
- Use consistent naming: `seed_<type>_<identifier>`
- Never include `meta` fields - they are auto-populated
- Deployed automatically on app start or when the package fingerprint changes.
- User modifications to seed data persist across deployments — seed files won't overwrite user changes.

**How to determine:** Check the type definition. If the type (or its parent) includes `mixes SeedData`, use `seed/`. Otherwise, use `data/`.

### `data/` Directory — Standard Entity Types (No `SeedData` Mixin)

For standard Persistable entity types that do **not** mixin `SeedData`, `Metadata`, or `Config`, place data files in `data/<TypeName>/`.

- JSON or CSV files under `data/<TypeName>/`.
- Follows the same path convention as `seed/`: `data/<TypeName>/<filename>.json|csv`.
- Also collected by `Pkg.upsertAllSeed()` alongside `seed/` files during provisioning.
- Uses standard persistence (upsert) — no user modification tracking, no upgrade preservation, no dual-ownership like `SeedData`.
- Common use cases: reference data, lookup tables, development data. For test-specific data, use `test/data/` instead.

**Decision rule:** The choice between `seed/` and `data/` is based **solely** on whether the type mixes `SeedData` — not on data volume or any other factor.
