# shoot

`shoot` opens a web page in a headless browser (no window), clicks through steps you describe, and
saves screenshots to a gallery you can open in your browser. It's a thin wrapper around Playwright.

## Setup (one time, Node.js 18+)

```bash
cd ~/Desktop/charlie_skills/shoot
npm install
npx playwright install chromium

mkdir -p ~/.local/bin
printf '#!/usr/bin/env bash\nexec node "$HOME/Desktop/charlie_skills/shoot/shoot.mjs" "$@"\n' > ~/.local/bin/shoot
chmod +x ~/.local/bin/shoot
shoot --help
```

`~/.local/bin` must be on your PATH. If `shoot --help` says "command not found", add
`export PATH="$HOME/.local/bin:$PATH"` to `~/.zshrc` and open a new terminal.

## Use

- One screenshot: `shoot http://localhost:8000/ --name "home page"`
- Click-through: write a steps file, then
  `shoot http://localhost:8000/ --steps steps.json --project apo-1317 --name "create channel"`

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

Flags: `--project <name>` groups runs in the gallery (defaults to the git repo name), `--video`
records a video, `--mobile` adds an iPhone-sized run, `--no-full` captures only the visible part.

## Gallery

Runs are saved to `~/.harness/shots/<project>/<timestamp>-<name>/`, each with the PNGs, a
`report.json`, and an `index.html` that lists failed steps plus console errors and failed
network requests. Serve the folder and open the link `shoot` prints:

```bash
python3 -m http.server 4100 -d ~/.harness/shots
```

http://localhost:4100/ lists every run, newest first.

## Cleanup

Automatic. Every run deletes runs older than 30 days (and empty project folders) — no manual
deletion needed. Settings: `HARNESS_SHOTS_KEEP_DAYS` (default 30), `HARNESS_SHOTS_DIR` (default
`~/.harness/shots`), `HARNESS_GALLERY_PORT` (port in the printed link, default 4100).
