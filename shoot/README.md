# shoot

`shoot` opens a web page in a headless browser (no window), clicks through steps you describe, and
saves screenshots to a gallery you can open in your browser. It's a thin wrapper around Playwright.

## Setup (one time, Node.js 18+)

```bash
cd ~/Code/Charlie_Skills/shoot
npm install
npx playwright install chromium

mkdir -p ~/.local/bin
printf '#!/usr/bin/env bash\nexec node "$HOME/Code/Charlie_Skills/shoot/shoot.mjs" "$@"\n' > ~/.local/bin/shoot
chmod +x ~/.local/bin/shoot
shoot --help
```

`~/.local/bin` must be on your PATH. If `shoot --help` says "command not found", add
`export PATH="$HOME/.local/bin:$PATH"` to `~/.zshrc` and open a new terminal.

## Use

- One screenshot: `shoot http://localhost:8000/ --name "home page"`
- Click-through: write a steps file, then
  `shoot http://localhost:8000/ --steps steps.json --project apo-1317 --name "create channel"`
- Re-run later with the same `--project` and the new run is added to that task's page.

```json
[
  {"click": "text=Create channel"},
  {"wait": "text=Channel name"},
  {"fill": ["input[name=name]", "Pricing review"]},
  {"shot": "modal filled in"}
]
```

Step types: `goto`, `click`, `fill`, `press`, `hover`, `select`, `scroll`, `wait` (ms or a
selector), `shot` (caption). Any non-shot step with a `"note"` also takes a captioned screenshot.
A failing step is screenshotted and ends the run with exit code 1. `shoot --help` lists them all.

Flags: `--project <name>` groups runs into one page (defaults to the git repo name), `--video`
records a video, `--mobile` adds an iPhone-sized run, `--no-full` captures only the visible part.
`shoot --rebuild` regenerates every page from the saved runs (use it after upgrading `shoot`).
`shoot --discard <run id>` deletes one run and its section (the run id is the folder name, or the
`#run-...` part of the printed link). Use it for a run that failed because of the steps file, not
because of the app.

Every step waits up to 30 seconds (the apps this is used on are slow on a cold start). Change that
with `HARNESS_STEP_TIMEOUT_MS`.

## Gallery

Each run is saved to `~/.harness/shots/<project>/<timestamp>-<name>/` as PNGs plus a `report.json`.
Runs have no pages of their own. Instead there is **one page per project** (a task or ticket), with
a collapsible section for every run:

- Click a screenshot to open it in a viewer: the ‹ › buttons or the ←/→ keys move between photos,
  Home/End jump to the first/last, Esc (or a click on the dark background) closes it. Click the photo
  to switch between fit-to-screen and full width. Only photos in expanded runs are in the sequence.
- Failed runs are collapsed (unless it is the newest run) and can be hidden with "Hide failed runs".
- Repeated console/network errors are listed once with a count.
- Open a run directly with `/<project>/#run-<run id>` (the link `shoot` prints).

`~/.harness/shots/index.html` lists the projects. Serve the folder and open the link `shoot` prints:

```bash
python3 -m http.server 4100 -d ~/.harness/shots
```

http://localhost:4100/ lists every project, newest first.

## Cleanup

Automatic. Every run deletes runs older than 30 days (and empty project folders) — no manual
deletion needed. Settings: `HARNESS_SHOTS_KEEP_DAYS` (default 30), `HARNESS_SHOTS_DIR` (default
`~/.harness/shots`), `HARNESS_GALLERY_PORT` (port in the printed link, default 4100),
`HARNESS_STEP_TIMEOUT_MS` (per-step wait, default 30000).
