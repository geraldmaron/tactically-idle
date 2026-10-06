// Captures the /locations.html contact sheet for every building family and writes a JSON summary.
// Starts no server: run `npx vite --port 5174` (or any port) first and point TI_BASE_URL at it.
//
//   TI_BASE_URL=http://127.0.0.1:5174   dev server origin (default)
//   TI_CAPTURE_DIR=<dir>                output directory (default: <os tmp>/ti-location-captures)
//   TI_FAMILIES=bungalow_g1,warehouse_g1  subset (default: every generated + authored family)
//   TI_SEEDS=1-24                       seed spec passed to the sheet
//   TI_CELL_WIDTH=360                   px per plan; 360 is close to the in-game phone map
//   TI_CAPTURE_CELLS=1                  also save one PNG per seed and floor (2x) for close review
//   CHROME_PATH=<binary>                Chrome executable (default: macOS Google Chrome)
//
// Re-runnable: each run overwrites the files for the families it captures.
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseURL = (process.env.TI_BASE_URL ?? 'http://127.0.0.1:5174').replace(/\/$/, '');
const outDir = process.env.TI_CAPTURE_DIR ?? join(tmpdir(), 'ti-location-captures');
const seeds = process.env.TI_SEEDS ?? '1-24';
const cellWidth = Number(process.env.TI_CELL_WIDTH ?? 360);
const captureCells = process.env.TI_CAPTURE_CELLS === '1';
const columns = 4;

const { chromium } = await import('playwright-core');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

async function loadSheet(page, family, floor) {
  const url = `${baseURL}/locations.html?family=${encodeURIComponent(family)}&seeds=${encodeURIComponent(seeds)}&floor=${floor}&w=${cellWidth}`;
  const errors = [];
  const onError = (e) => errors.push(String(e));
  page.on('pageerror', onError);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__locationSheet?.ready === true, null, { timeout: 180_000 });
  await page.evaluate(() => document.fonts.ready);
  page.off('pageerror', onError);
  const state = await page.evaluate(() => window.__locationSheet);
  return { url, state, errors };
}

function range(values) {
  return values.length ? [Math.min(...values), Math.max(...values)] : null;
}

function summarise(family, state, pageErrors, files) {
  const cells = Object.values(state.cells).sort((a, b) => a.seed - b.seed);
  const ok = cells.filter((c) => c.ok);
  const floors = {};
  for (const c of ok) floors[c.floors] = (floors[c.floors] ?? 0) + 1;
  const issues = cells.flatMap((c) => c.issues.map((i) => ({ seed: c.seed, ...i })));
  const scores = ok.filter((c) => c.plausibility).map((c) => c.plausibility.score);
  return {
    family,
    seeds: cells.map((c) => c.seed),
    floorsHistogram: floors,
    roomCountRange: range(ok.map((c) => c.rooms)),
    entriesRange: range(ok.map((c) => c.entries.length)),
    exteriorDoorsRange: range(ok.map((c) => c.exteriorDoors)),
    interiorLoopsRange: range(ok.map((c) => c.interiorLoops)),
    loopsViaOutsideRange: range(ok.map((c) => c.loopsViaOutside)),
    plausibilityRange: range(scores),
    issueCount: issues.length,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    buildFailures: cells.filter((c) => !c.ok).map((c) => ({ seed: c.seed, error: c.error })),
    unreachable: ok.filter((c) => c.unreachable.length).map((c) => ({ seed: c.seed, rooms: c.unreachable })),
    detached: ok.filter((c) => c.detached.length).map((c) => ({ seed: c.seed, rooms: c.detached })),
    issues,
    pageErrors,
    files,
    perSeed: cells.map((c) => ({
      seed: c.seed, floors: c.floors, rooms: c.rooms, roomsByFloor: c.roomsByFloor, entries: c.entries,
      exteriorDoors: c.exteriorDoors, interiorLoops: c.interiorLoops, loopsViaOutside: c.loopsViaOutside,
      detached: c.detached, objects: c.objects, plausibility: c.plausibility?.score ?? null,
      plausibilityFails: (c.plausibility?.notes ?? []).filter((n) => n.startsWith('FAIL')), issues: c.issues.length,
    })),
  };
}

try {
  await mkdir(outDir, { recursive: true });
  // Cells are saved at 2x for close review; full sheets stay at 1 CSS px per pixel.
  const page = await browser.newPage({ viewport: { width: 32 + columns * (cellWidth + 14), height: 900 }, deviceScaleFactor: captureCells ? 2 : 1 });
  // The page's picker lists every family; read it so the script never drifts from the registry.
  await page.goto(`${baseURL}/locations.html?seeds=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__locationSheet?.ready === true, null, { timeout: 60_000 });
  const allFamilies = await page.$$eval('select[name=family] option', (os) => os.map((o) => o.value));
  const wanted = process.env.TI_FAMILIES ? process.env.TI_FAMILIES.split(',').map((s) => s.trim()) : allFamilies;
  const unknown = wanted.filter((f) => !allFamilies.includes(f));
  if (unknown.length) throw new Error(`Unknown families: ${unknown.join(', ')} (known: ${allFamilies.join(', ')})`);

  const summary = { capturedAt: new Date().toISOString(), baseURL, seeds, cellWidth, outDir, families: [] };
  for (const family of wanted) {
    const started = Date.now();
    const ground = await loadSheet(page, family, 0);
    const files = [];
    const sheet0 = join(outDir, `${family}-floor0.png`);
    await page.screenshot({ path: sheet0, fullPage: true, scale: 'css' });
    files.push(sheet0);
    if (captureCells) files.push(...(await captureCellPngs(page, family, 0)));
    const twoFloor = Object.values(ground.state.cells).some((c) => c.floors > 1);
    let errors = ground.errors;
    if (twoFloor) {
      const upper = await loadSheet(page, family, 1);
      const sheet1 = join(outDir, `${family}-floor1.png`);
      await page.screenshot({ path: sheet1, fullPage: true, scale: 'css' });
      files.push(sheet1);
      if (captureCells) files.push(...(await captureCellPngs(page, family, 1)));
      errors = [...errors, ...upper.errors];
    }
    const s = summarise(family, ground.state, errors, files);
    summary.families.push(s);
    console.log(
      `${family.padEnd(26)} floors ${JSON.stringify(s.floorsHistogram).padEnd(12)} rooms ${String(s.roomCountRange).padEnd(6)} entries ${String(s.entriesRange).padEnd(5)} issues ${s.issueCount} (${s.errorCount} err) ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
  const jsonPath = join(outDir, 'summary.json');
  await writeFile(jsonPath, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${summary.families.length} families to ${outDir}\nSummary: ${jsonPath}`);
} finally {
  await browser.close();
}

async function captureCellPngs(page, family, floor) {
  const dir = join(outDir, 'cells', family);
  await mkdir(dir, { recursive: true });
  const out = [];
  const cells = page.locator('.ls-cell');
  const n = await cells.count();
  for (let i = 0; i < n; i++) {
    const cell = cells.nth(i);
    const seed = await cell.getAttribute('data-seed');
    const floors = Number(await cell.getAttribute('data-floors'));
    if (floor >= floors) continue;
    const path = join(dir, `seed${String(seed).padStart(2, '0')}-floor${floor}.png`);
    await cell.screenshot({ path, scale: 'device' });
    out.push(path);
  }
  return out;
}
