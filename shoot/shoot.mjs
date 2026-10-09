// shoot — headless Playwright click-through that saves screenshots + a report
// into a gallery folder (~/.harness/shots), then prints a link to the task's page.
import { chromium, devices } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SHOTS = process.env.HARNESS_SHOTS_DIR || path.join(os.homedir(), '.harness', 'shots');
const PORT = process.env.HARNESS_GALLERY_PORT || '4100';
const KEEP_DAYS = Number(process.env.HARNESS_SHOTS_KEEP_DAYS || 30);
// How long one step (click, fill, wait for a selector, page load) may take. The apps this tool is used
// on are slow, especially on a cold start, so be generous: a step that really is stuck still ends the run.
const STEP_TIMEOUT = Number(process.env.HARNESS_STEP_TIMEOUT_MS || 30000);

const USAGE = `shoot <url> [--name <label>] [--project <name>] [--steps <file.json>]
            [--mobile] [--video] [--no-full]
shoot --rebuild
shoot --discard <run id>

Each step waits up to 30s (set HARNESS_STEP_TIMEOUT_MS to change it).
--discard deletes one run and its section on the page. Use it for a run that failed because of the
steps file (wrong selector, timing, a default you toggled) and keep a failed run only when it shows a
real problem in the app. The run id is the folder name, or the "#run-..." part of the link shoot printed.

--project groups runs: every run of one task lands on that task's single page, one section per run.
--rebuild regenerates all pages from the saved runs (use it after upgrading shoot).

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
    else if (a === '--rebuild') o.rebuild = true;
    else if (a === '--discard') o.discard = value();
    else if (a === '-h' || a === '--help') usage();
    else if (a.startsWith('--')) usage(`unknown flag ${a}`);
    else rest.push(a);
  }
  if (o.rebuild || o.discard) {
    if (rest.length) usage(`${o.rebuild ? '--rebuild' : '--discard'} takes no URL`);
    if (o.rebuild && o.discard) usage('use --rebuild or --discard, not both');
    return o;
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
    await page.goto(opts.url, { waitUntil: 'load', timeout: STEP_TIMEOUT });
    if (!steps) {
      await shot('page');
    } else {
      for (const [i, s] of steps.entries()) {
        const label = `step ${i + 1}`;
        try {
          if (s.goto !== undefined) await page.goto(new URL(s.goto, opts.url).href, { waitUntil: 'load', timeout: STEP_TIMEOUT });
          else if (s.click !== undefined) await page.locator(s.click).first().click({ timeout: STEP_TIMEOUT });
          else if (s.fill !== undefined) await page.locator(s.fill[0]).first().fill(String(s.fill[1]), { timeout: STEP_TIMEOUT });
          else if (s.press !== undefined) await page.keyboard.press(s.press);
          else if (s.hover !== undefined) await page.locator(s.hover).first().hover({ timeout: STEP_TIMEOUT });
          else if (s.select !== undefined) await page.locator(s.select[0]).first().selectOption(String(s.select[1]), { timeout: STEP_TIMEOUT });
          else if (s.scroll !== undefined) await page.mouse.wheel(0, Number(s.scroll));
          else if (s.wait !== undefined) {
            if (typeof s.wait === 'number') await page.waitForTimeout(s.wait);
            else await page.locator(s.wait).first().waitFor({ state: 'visible', timeout: STEP_TIMEOUT });
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
// One page per project (task): a collapsible section per run and a lightbox for the screenshots.
// The root page lists the projects. Runs have no pages of their own, only their PNGs and report.json.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = iso => new Date(iso).toLocaleString();

const CSS = `
:root{--bg:#f7f7f5;--fg:#1c1c1a;--muted:#6b6b66;--card:#fff;--line:#e4e4df;--bad:#c2410c;--ok:#15803d}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#ecece8;--muted:#9a9a93;--card:#1e1e1c;--line:#2e2e2b;--bad:#fb923c;--ok:#4ade80}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
body.lb-open{overflow:hidden}
main{max-width:1200px;margin:0 auto;padding:24px 16px 64px}
a{color:inherit}.muted{color:var(--muted)}.ok{color:var(--ok)}
h1{margin:8px 0 4px}h3{margin:16px 0 8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.card{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden;text-decoration:none;display:block}
a.card:hover,.card:has(.thumb:hover){border-color:var(--muted)}
.card.failed{border-color:var(--bad)}
.card img,.card video{display:block;width:100%;max-height:360px;object-fit:cover;object-position:top}
.thumb{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in}
.meta{padding:8px 12px}.meta b{display:block}
.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin:16px 0}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:2px 12px;text-decoration:none;font-size:13px}
.chip.bad{border-color:var(--bad);color:var(--bad)}
details.run{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:0 0 16px}
details.run.bad{border-color:var(--bad)}
details.run>summary{cursor:pointer;padding:12px 16px;list-style:none;display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}
details.run>summary::-webkit-details-marker{display:none}
details.run>summary::before{content:"\\25B8";color:var(--muted)}
details.run[open]>summary::before{content:"\\25BE"}
.runbody{padding:0 16px 16px}
.box{border:1px solid var(--bad);color:var(--bad);border-radius:8px;padding:8px 12px;margin:12px 0}
.problems{color:var(--bad);font-family:ui-monospace,monospace;font-size:12px;margin:8px 0 0;padding-left:20px}
.badge{font-size:11px;border:1px solid currentColor;border-radius:999px;padding:0 8px}
.badge.bad{color:var(--bad)}.badge.ok{color:var(--ok)}
body.hide-failed details.run.bad{display:none}
#lb{position:fixed;inset:0;z-index:50;background:rgba(10,10,10,.97);display:flex;flex-direction:column;color:#fff}
#lb[hidden]{display:none}
#lb .bar{display:flex;gap:16px;align-items:center;padding:10px 16px}
#lb .cap{flex:1;min-width:0}#lb .cap small{display:block;opacity:.7}
#lb .count{opacity:.7;white-space:nowrap}
#lb .stage{flex:1;overflow:auto;display:flex;justify-content:center;padding:0 80px 16px}
#lb img{align-self:flex-start;background:#fff;border-radius:4px;cursor:zoom-in}
#lb img.fit{max-width:100%;max-height:calc(100vh - 96px);width:auto;height:auto}
#lb img.wide{width:100%;height:auto;cursor:zoom-out}
#lb button{border:0;color:#fff;background:rgba(255,255,255,.16);cursor:pointer;border-radius:999px;font:inherit}
#lb button:hover:not(:disabled){background:rgba(255,255,255,.3)}
#lb button:disabled{opacity:.25;cursor:default}
#lb .nav{position:fixed;top:50%;transform:translateY(-50%);width:52px;height:52px;font-size:28px}
#lb .prev{left:14px}#lb .next{right:14px}
#lb .close{width:36px;height:36px;font-size:20px}`;

// Plain string on purpose (no backticks, no dollar-brace, no backslashes): it is inlined into the page as-is.
const SCRIPT = `
(function () {
  var lb = document.getElementById('lb');
  var img = lb.querySelector('img'), cap = lb.querySelector('.cap'), count = lb.querySelector('.count');
  var prev = lb.querySelector('.prev'), next = lb.querySelector('.next'), stage = lb.querySelector('.stage');
  var list = [], idx = 0;

  function visibleThumbs() {
    // Only photos you can see: inside a run that is expanded and not hidden by "Hide failed runs".
    return Array.prototype.filter.call(document.querySelectorAll('.thumb'), function (b) {
      var run = b.closest('details.run');
      return run && run.open && getComputedStyle(run).display !== 'none';
    });
  }
  function show(i) {
    idx = Math.max(0, Math.min(list.length - 1, i));
    var b = list[idx];
    img.className = 'fit';
    img.src = b.dataset.src;
    img.alt = b.dataset.caption;
    cap.innerHTML = '';
    var t = document.createElement('b'); t.textContent = b.dataset.caption; cap.appendChild(t);
    var sub = document.createElement('small'); sub.textContent = b.dataset.run + (b.dataset.note ? ' - ' + b.dataset.note : ''); cap.appendChild(sub);
    count.textContent = (idx + 1) + ' / ' + list.length;
    prev.disabled = idx === 0;
    next.disabled = idx === list.length - 1;
    stage.scrollTop = 0;
    [idx - 1, idx + 1].forEach(function (j) { if (list[j]) new Image().src = list[j].dataset.src; });
  }
  function open(b) {
    list = visibleThumbs();
    lb.hidden = false;
    document.body.classList.add('lb-open');
    show(list.indexOf(b));
  }
  function close() { lb.hidden = true; document.body.classList.remove('lb-open'); img.removeAttribute('src'); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.thumb');
    if (b) { open(b); return; }
    if (lb.hidden) return;
    if (e.target.closest('.prev')) show(idx - 1);
    else if (e.target.closest('.next')) show(idx + 1);
    else if (e.target.closest('.close') || e.target === stage) close();
    else if (e.target === img) img.className = img.className === 'fit' ? 'wide' : 'fit';
  });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(list.length - 1);
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault();
  });
  // Very tall full-page captures are unreadable when shrunk to fit, so start those at full width and scroll.
  img.addEventListener('load', function () { if (img.naturalHeight > img.naturalWidth * 1.4) img.className = 'wide'; });

  var hide = document.getElementById('hideFailed');
  if (hide) {
    try { hide.checked = localStorage.getItem('shoot.hideFailed') === '1'; } catch (e) {}
    var sync = function () {
      document.body.classList.toggle('hide-failed', hide.checked);
      try { localStorage.setItem('shoot.hideFailed', hide.checked ? '1' : '0'); } catch (e) {}
    };
    hide.addEventListener('change', sync);
    sync();
  }

  function openHash() {
    var el = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (!el) return;
    if (el.classList.contains('bad') && hide && hide.checked) { hide.checked = false; hide.dispatchEvent(new Event('change')); }
    if (el.tagName === 'DETAILS') el.open = true;
    el.scrollIntoView();
  }
  window.addEventListener('hashchange', openHash);
  openHash();
})();`;

const LIGHTBOX = `<div id="lb" hidden role="dialog" aria-modal="true" aria-label="Screenshot viewer">
  <div class="bar"><div class="cap"></div><span class="count"></span><button type="button" class="close" aria-label="Close">&times;</button></div>
  <div class="stage"><img alt=""></div>
  <button type="button" class="nav prev" aria-label="Previous screenshot">&#8249;</button>
  <button type="button" class="nav next" aria-label="Next screenshot">&#8250;</button>
</div>`;

const page = (title, body, withViewer = false) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main>${withViewer ? `${LIGHTBOX}<script>${SCRIPT}</script>` : ''}</body></html>`;

const listDirs = dir => {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name); }
  catch { return []; }
};

// Newest first. A folder without a readable report.json is not a run (or is still being written).
function readRuns(root, project) {
  const runs = [];
  for (const runId of listDirs(path.join(root, project))) {
    try { runs.push(JSON.parse(fs.readFileSync(path.join(root, project, runId, 'report.json'), 'utf8'))); }
    catch { /* skip */ }
  }
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const shotCount = r => r.shots.filter(s => !s.video && !s.missing).length;

function renderShot(r, s) {
  const src = `${esc(r.runId)}/${esc(s.file)}`;
  if (s.video) return `<figure class="card"><video src="${src}" controls muted playsinline></video><figcaption class="meta"><b>Video</b></figcaption></figure>`;
  const note = s.note ? `<span class="muted">${esc(s.note)}</span>` : '';
  if (s.missing) return `<figure class="card failed"><figcaption class="meta"><b>${esc(s.caption)}</b>${note}</figcaption></figure>`;
  return `<figure class="card${s.failed ? ' failed' : ''}"><button type="button" class="thumb" data-src="${src}" data-caption="${esc(s.caption)}" data-note="${esc(s.note || '')}" data-run="${esc(r.name)}"><img loading="lazy" src="${src}" alt="${esc(s.caption)}"></button><figcaption class="meta"><b>${esc(s.caption)}</b>${note}</figcaption></figure>`;
}

function renderRun(r, isNewest) {
  const failed = r.failures.length > 0;
  const byVp = {};
  for (const s of r.shots) (byVp[s.viewport] ||= []).push(s);
  const multi = Object.keys(byVp).length > 1;
  const grids = Object.entries(byVp).map(([vp, shots]) =>
    `${multi ? `<h3>${esc(vp)}</h3>` : ''}<div class="grid">${shots.map(s => renderShot(r, s)).join('')}</div>`).join('');
  // The same failing request is usually logged many times; show each distinct line once with a count.
  const counts = new Map();
  for (const p of r.problems) { const k = `[${p.viewport}] ${p.kind}: ${p.text}`; counts.set(k, (counts.get(k) || 0) + 1); }
  const problems = counts.size
    ? `<details><summary class="muted">Console / network problems (${r.problems.length})</summary><ul class="problems">${[...counts].slice(0, 100).map(([k, n]) => `<li>${esc(k)}${n > 1 ? ` &times;${n}` : ''}</li>`).join('')}</ul></details>`
    : '';
  const badges = `<span class="badge ${failed ? 'bad' : 'ok'}">${failed ? 'failed' : 'passed'}</span>`
    + `<span class="badge">${shotCount(r)} shots</span>`
    + (r.problems.length ? `<span class="badge bad">${r.problems.length} console/network errors</span>` : '');
  return `<details class="run ${failed ? 'bad' : 'passed'}" id="run-${esc(r.runId)}"${!failed || isNewest ? ' open' : ''}>
    <summary><b>${esc(r.name)}</b><span class="muted">${esc(when(r.createdAt))}</span>${badges}</summary>
    <div class="runbody"><div class="muted">${esc(r.url)}</div>${r.failures.map(f => `<div class="box">&#10007; ${esc(f)}</div>`).join('')}${grids}${problems}</div>
  </details>`;
}

function renderProject(project, runs) {
  const total = runs.reduce((n, r) => n + shotCount(r), 0);
  const chips = runs.map(r => `<a class="chip${r.failures.length ? ' bad' : ''}" href="#run-${esc(r.runId)}">${r.failures.length ? '&#10007;' : '&#10003;'} ${esc(r.name)} <span class="muted">${esc(when(r.createdAt))}</span></a>`).join('');
  return page(project, `<p><a href="../">&larr; all tasks</a></p>
    <h1>${esc(project)}</h1>
    <div class="muted">${runs.length} run${runs.length === 1 ? '' : 's'} &middot; ${total} screenshots &middot; last run ${esc(when(runs[0].createdAt))}</div>
    <div class="toolbar"><nav class="chips">${chips}</nav><label class="muted"><input type="checkbox" id="hideFailed"> Hide failed runs</label></div>
    ${runs.map((r, i) => renderRun(r, i === 0)).join('')}`, true);
}

function renderIndex(projects) {
  if (!projects.length) return page('Shots', '<h1>Shots</h1><p class="muted">No runs yet.</p>');
  const cards = projects.map(({ project, runs }) => {
    const latest = runs[0];
    const pick = runs.find(r => !r.failures.length) || latest;
    const thumb = [...pick.shots].reverse().find(s => !s.video && !s.missing && !s.failed);
    const total = runs.reduce((n, r) => n + shotCount(r), 0);
    return `<a class="card${latest.failures.length ? ' failed' : ''}" href="${esc(project)}/">${thumb ? `<img loading="lazy" src="${esc(project)}/${esc(pick.runId)}/${esc(thumb.file)}" alt="">` : ''}<div class="meta"><b>${esc(project)}${latest.failures.length ? ' <span class="badge bad">latest run failed</span>' : ''}</b><span class="muted">${runs.length} run${runs.length === 1 ? '' : 's'} &middot; ${total} screenshots &middot; ${esc(when(latest.createdAt))}</span></div></a>`;
  }).join('');
  return page('Shots', `<h1>Shots</h1><p class="muted">One page per task, newest first.</p><div class="grid">${cards}</div>`);
}

// Other shoot runs may be writing at the same moment, so write to a temp file and rename.
function writeAtomic(file, content) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

// Delete one run. `id` is a run folder name, "<project>/<run folder>", or a "#run-<run folder>" fragment.
function discardRun(root, id) {
  const wanted = id.replace(/^#?run-/, '').replace(/\/+$/, '');
  const matches = [];
  for (const project of listDirs(root)) {
    for (const runId of listDirs(path.join(root, project))) {
      if ((runId === wanted || `${project}/${runId}` === wanted) && fs.existsSync(path.join(root, project, runId, 'report.json'))) {
        matches.push({ project, runId });
      }
    }
  }
  if (matches.length !== 1) usage(matches.length ? `"${id}" matches ${matches.length} runs; use <project>/<run id>` : `no run called "${id}"`);
  const { project, runId } = matches[0];
  fs.rmSync(path.join(root, project, runId), { recursive: true, force: true });
  return { project, runId };
}

// Rebuild every project page and the root page from the report.json files on disk.
function buildSite(root) {
  const projects = [];
  for (const project of listDirs(root)) {
    const runs = readRuns(root, project);
    if (!runs.length) {
      // Last run discarded: drop the page, and the folder too when nothing else is in it.
      fs.rmSync(path.join(root, project, 'index.html'), { force: true });
      try { fs.rmdirSync(path.join(root, project)); } catch { /* not empty, or another run is being written */ }
      continue;
    }
    // Older versions wrote a page per run; the project page replaces them.
    for (const r of runs) fs.rmSync(path.join(root, project, r.runId, 'index.html'), { force: true });
    writeAtomic(path.join(root, project, 'index.html'), renderProject(project, runs));
    projects.push({ project, runs });
  }
  projects.sort((a, b) => b.runs[0].createdAt.localeCompare(a.runs[0].createdAt));
  writeAtomic(path.join(root, 'index.html'), renderIndex(projects));
}

// ---- main ----

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.discard) {
    const { project, runId } = discardRun(SHOTS, opts.discard);
    buildSite(SHOTS);
    console.log(`discarded ${project}/${runId}`);
    process.exit(0);
  }
  if (opts.rebuild) {
    fs.mkdirSync(SHOTS, { recursive: true });
    buildSite(SHOTS);
    console.log(`rebuilt pages in ${SHOTS}`);
    process.exit(0);
  }
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
  prune(SHOTS, outDir);
  buildSite(SHOTS);

  console.log(`http://localhost:${PORT}/${project}/#run-${runId}`);
  console.log(`saved ${shots.filter(s => !s.video && !s.missing).length} screenshot(s) to ${outDir}`);
  if (problems.length) console.log(`${problems.length} console/network problem(s) — see report`);
  for (const f of failures) console.log(`FAILED ${f}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch(e => { console.error(`shoot: ${e.stack || e}`); process.exit(1); });
