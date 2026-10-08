// shoot — headless Playwright click-through that saves screenshots + a report
// into a gallery folder (~/.harness/shots), then prints a link to the run.
import { chromium, devices } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SHOTS = process.env.HARNESS_SHOTS_DIR || path.join(os.homedir(), '.harness', 'shots');
const PORT = process.env.HARNESS_GALLERY_PORT || '4100';
const KEEP_DAYS = Number(process.env.HARNESS_SHOTS_KEEP_DAYS || 30);

const USAGE = `shoot <url> [--name <label>] [--project <name>] [--steps <file.json>]
            [--mobile] [--video] [--no-full]

Without --steps: one screenshot of <url>.
With --steps, a JSON array run in order against <url>. Each step is one of:
  {"goto": "/path"}                  relative to <url>, or absolute
  {"click": "<selector>"}            Playwright selector, e.g. "text=Sign in"
  {"fill": ["<selector>", "text"]}
  {"press": "Enter"}
  {"hover": "<selector>"}
  {"select": ["<selector>", "value"]}
  {"scroll": 800}                    pixels down (negative = up)
  {"wait": 500 | "<selector>"}       ms, or until selector is visible
  {"shot": "caption"}                screenshot with a caption
Any non-shot step with a "note" also takes a screenshot captioned with it.
A failing step is screenshotted and ends the run (exit code 1).`;

function usage(msg) {
  if (msg) console.error(`shoot: ${msg}`);
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv) {
  const o = { full: true };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) usage(`${a} needs a value`);
      return v;
    };
    if (a === '--name') o.name = value();
    else if (a === '--project') o.project = value();
    else if (a === '--steps') o.steps = value();
    else if (a === '--mobile') o.mobile = true;
    else if (a === '--video') o.video = true;
    else if (a === '--no-full') o.full = false;
    else if (a === '-h' || a === '--help') usage();
    else if (a.startsWith('--')) usage(`unknown flag ${a}`);
    else rest.push(a);
  }
  if (rest.length !== 1) usage('expected exactly one URL');
  o.url = rest[0];
  return o;
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'run';

function defaultProject() {
  try {
    return path.basename(execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim());
  } catch {
    return path.basename(process.cwd());
  }
}

function stamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Delete runs older than KEEP_DAYS (never the run just made), then any project folders left empty.
// Other shoot runs may be writing at the same time, so a folder that changes under us is skipped.
function prune(root, keepDir) {
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  for (const project of fs.readdirSync(root, { withFileTypes: true })) {
    if (!project.isDirectory() || project.name.startsWith('.')) continue;
    const pdir = path.join(root, project.name);
    try {
      for (const run of fs.readdirSync(pdir, { withFileTypes: true })) {
        const rdir = path.join(pdir, run.name);
        if (rdir === keepDir || !run.isDirectory()) continue;
        if (fs.statSync(rdir).mtimeMs < cutoff) fs.rmSync(rdir, { recursive: true, force: true });
      }
      if (!fs.readdirSync(pdir).length) fs.rmdirSync(pdir);
    } catch (e) {
      if (!['ENOTEMPTY', 'ENOENT', 'EEXIST'].includes(e.code)) throw e;
    }
  }
}

async function runViewport({ browser, opts, steps, viewport, outDir, shots, problems }) {
  const ctxOpts = viewport.device ? { ...devices[viewport.device] } : { viewport: viewport.size };
  if (opts.video) ctxOpts.recordVideo = { dir: path.join(outDir, '.video'), size: ctxOpts.viewport };
  const context = await browser.newContext({ ...ctxOpts, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') problems.push({ viewport: viewport.label, kind: 'console', text: m.text() }); });
  page.on('pageerror', e => problems.push({ viewport: viewport.label, kind: 'pageerror', text: String(e.message || e) }));
  page.on('requestfailed', r => problems.push({ viewport: viewport.label, kind: 'requestfailed', text: `${r.method()} ${r.url()} — ${r.failure()?.errorText}` }));
  page.on('response', r => { if (r.status() >= 400) problems.push({ viewport: viewport.label, kind: 'http', text: `${r.status()} ${r.request().method()} ${r.url()}` }); });

  let n = 0, unsaved = 0;
  const shot = async (caption, note, failed = false) => {
    n++;
    const file = `${viewport.label}-${String(n).padStart(2, '0')}-${slug(caption)}.png`;
    const error = await page.screenshot({ path: path.join(outDir, file), fullPage: opts.full })
      .then(() => null, e => e.message.split('\n')[0]);
    if (error) {
      unsaved++;
      shots.push({ viewport: viewport.label, file, caption, note: `screenshot not saved: ${error}`, url: page.url(), failed: true, missing: true });
    } else {
      shots.push({ viewport: viewport.label, file, caption, note, url: page.url(), failed });
    }
  };

  let failed = null;
  try {
    // 'load', not 'networkidle': dev servers and polling apps never go idle, which cost a 30s wait.
    // Use explicit {"wait": ...} steps for anything that renders after load.
    await page.goto(opts.url, { waitUntil: 'load', timeout: 30000 });
    if (!steps) {
      await shot('page');
    } else {
      for (const [i, s] of steps.entries()) {
        const label = `step ${i + 1}`;
        try {
          if (s.goto !== undefined) await page.goto(new URL(s.goto, opts.url).href, { waitUntil: 'load', timeout: 30000 });
          else if (s.click !== undefined) await page.locator(s.click).first().click({ timeout: 10000 });
          else if (s.fill !== undefined) await page.locator(s.fill[0]).first().fill(String(s.fill[1]), { timeout: 10000 });
          else if (s.press !== undefined) await page.keyboard.press(s.press);
          else if (s.hover !== undefined) await page.locator(s.hover).first().hover({ timeout: 10000 });
          else if (s.select !== undefined) await page.locator(s.select[0]).first().selectOption(String(s.select[1]), { timeout: 10000 });
          else if (s.scroll !== undefined) await page.mouse.wheel(0, Number(s.scroll));
          else if (s.wait !== undefined) {
            if (typeof s.wait === 'number') await page.waitForTimeout(s.wait);
            else await page.locator(s.wait).first().waitFor({ state: 'visible', timeout: 15000 });
          }
          else if (s.shot !== undefined) { await page.waitForTimeout(300); await shot(s.shot, s.note); continue; }
          else throw new Error(`unknown step ${JSON.stringify(s)}`);
          if (s.note) await shot(s.note);
        } catch (e) {
          failed = `${label} ${JSON.stringify(s)} failed: ${e.message.split('\n')[0]}`;
          await shot(`FAILED ${label}`, failed, true);
          break;
        }
      }
    }
  } catch (e) {
    failed = `could not load ${opts.url}: ${e.message.split('\n')[0]}`;
    await shot('load failed', failed, true);
  }

  if (!failed && unsaved) failed = `${unsaved} screenshot(s) could not be saved`;

  const video = page.video();
  await context.close();
  if (video) {
    const src = await video.path().catch(() => null);
    if (src && fs.existsSync(src)) {
      const dest = `${viewport.label}.webm`;
      fs.renameSync(src, path.join(outDir, dest));
      shots.push({ viewport: viewport.label, file: dest, caption: 'video', video: true });
    }
  }
  return failed;
}

// ---- gallery (static HTML) ----

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
:root{--bg:#f7f7f5;--fg:#1c1c1a;--muted:#6b6b66;--card:#fff;--line:#e4e4df;--bad:#c2410c;--ok:#15803d}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#ecece8;--muted:#9a9a93;--card:#1e1e1c;--line:#2e2e2b;--bad:#fb923c;--ok:#4ade80}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px}
a{color:inherit}.muted{color:var(--muted)}.ok{color:var(--ok)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.card{display:block;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden;text-decoration:none}
.card.failed{border-color:var(--bad)}
.card img,.card video{display:block;width:100%;max-height:360px;object-fit:cover;object-position:top}
.meta{padding:8px 12px}.meta b{display:block}
.box{border:1px solid var(--bad);color:var(--bad);border-radius:8px;padding:8px 12px;margin:12px 0}
.problems{color:var(--bad);font-family:ui-monospace,monospace;font-size:12px}
.badge{margin-left:6px;font-size:11px;color:var(--bad)}`;

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;

function renderRun(r) {
  const byVp = {};
  for (const s of r.shots) (byVp[s.viewport] ||= []).push(s);
  const sections = Object.entries(byVp).map(([vp, shots]) => `<h2>${esc(vp)}</h2><div class="grid">${shots.map(s => s.video
    ? `<div class="card"><video src="${esc(s.file)}" controls muted playsinline></video><div class="meta"><b>Video</b></div></div>`
    : `<a class="card${s.failed ? ' failed' : ''}" href="${esc(s.file)}" target="_blank"><img loading="lazy" src="${esc(s.file)}" alt="${esc(s.caption)}"><div class="meta"><b>${esc(s.caption)}</b>${s.note ? `<span class="muted">${esc(s.note)}</span><br>` : ''}<span class="muted">${esc(s.url)}</span></div></a>`
  ).join('')}</div>`).join('');
  const problems = r.problems.length
    ? `<h2>Console / network problems (${r.problems.length})</h2><ul class="problems">${r.problems.slice(0, 200).map(p => `<li>[${esc(p.viewport)}] ${esc(p.kind)}: ${esc(p.text)}</li>`).join('')}</ul>`
    : `<p class="ok">No console errors or failed requests.</p>`;
  return page(`${r.project} · ${r.name}`, `<p><a href="../../">← all runs</a></p>
    <h1>${esc(r.project)} · ${esc(r.name)}</h1>
    <div class="muted">${esc(new Date(r.createdAt).toLocaleString())} · <a href="${esc(r.url)}">${esc(r.url)}</a></div>
    ${r.failures.map(f => `<div class="box">✗ ${esc(f)}</div>`).join('')}${problems}${sections}`);
}

const listDirs = dir => {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name); }
  catch { return []; }
};

function renderIndex(root) {
  const runs = [];
  for (const project of listDirs(root)) {
    for (const runId of listDirs(path.join(root, project))) {
      try { runs.push(JSON.parse(fs.readFileSync(path.join(root, project, runId, 'report.json'), 'utf8'))); }
      catch { /* not a run folder */ }
    }
  }
  runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!runs.length) return page('Shots', '<h1>Shots</h1><p class="muted">No runs yet.</p>');
  const cards = runs.slice(0, 300).map(r => {
    const thumb = r.shots.find(s => !s.video && !s.missing);
    const badges = (r.failures.length ? '<span class="badge">failed</span>' : '') + (r.problems.length ? `<span class="badge">${r.problems.length} errors</span>` : '');
    return `<a class="card${r.failures.length ? ' failed' : ''}" href="${esc(r.project)}/${esc(r.runId)}/">${thumb ? `<img loading="lazy" src="${esc(r.project)}/${esc(r.runId)}/${esc(thumb.file)}" alt="">` : ''}<div class="meta"><b>${esc(r.project)} · ${esc(r.name)}${badges}</b><span class="muted">${esc(new Date(r.createdAt).toLocaleString())} · ${r.shots.filter(s => !s.video).length} shots</span></div></a>`;
  }).join('');
  return page('Shots', `<h1>Shots</h1><p class="muted">Newest first.</p><div class="grid">${cards}</div>`);
}

// ---- main ----

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let steps = null;
  if (opts.steps) {
    steps = JSON.parse(fs.readFileSync(opts.steps, 'utf8'));
    if (!Array.isArray(steps)) usage('--steps file must contain a JSON array');
  }
  const project = slug(opts.project || defaultProject());
  const name = opts.name || (steps ? 'click-through' : 'snapshot');
  const runId = `${stamp()}-${slug(name)}`;
  const outDir = path.join(SHOTS, project, runId);
  fs.mkdirSync(outDir, { recursive: true });

  const viewports = [{ label: 'desktop', size: { width: 1440, height: 900 } }];
  if (opts.mobile) viewports.push({ label: 'mobile', device: 'iPhone 15' });

  const browser = await chromium.launch({ headless: true });
  const shots = [], problems = [], failures = [];
  for (const viewport of viewports) {
    const f = await runViewport({ browser, opts, steps, viewport, outDir, shots, problems });
    if (f) failures.push(`${viewport.label}: ${f}`);
  }
  await browser.close();
  fs.rmSync(path.join(outDir, '.video'), { recursive: true, force: true });

  const report = { project, runId, name, url: opts.url, createdAt: new Date().toISOString(), steps, shots, problems, failures };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'index.html'), renderRun(report));
  prune(SHOTS, outDir);
  fs.writeFileSync(path.join(SHOTS, 'index.html'), renderIndex(SHOTS));

  console.log(`http://localhost:${PORT}/${project}/${runId}/`);
  console.log(`saved ${shots.filter(s => !s.video && !s.missing).length} screenshot(s) to ${outDir}`);
  if (problems.length) console.log(`${problems.length} console/network problem(s) — see report`);
  for (const f of failures) console.log(`FAILED ${f}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch(e => { console.error(`shoot: ${e.stack || e}`); process.exit(1); });
