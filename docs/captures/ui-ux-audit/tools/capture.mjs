// Walks every player-facing screen in an isolated browser context, records viewport captures through the
// bottom of each scroll owner, and runs the measurement probe (scripts/ui-gates/probe.mjs) on every
// scroll segment. The probe measures the active surface only (the open sheet, else the screen), so text
// behind a sheet is not counted; it hit-tests targets, follows ancestor clipping, and gives each element
// a stable id. The walk also covers the states a first pass cannot reach: the tools after their unlock
// and a save error. Exits 2 if any step failed.
//   node capture.mjs <repo> <outDir> <baseURL> [widths]
// scripts/check-ui.mjs imports walk() to gate the same frames without writing images.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { CAMPAIGN_SEED, FIXED_TIME, HEIGHTS, INSET_FIXTURES, PROBE_CFG, WIDTHS, stateIds, STATES } from '../../../../scripts/ui-gates/manifest.mjs';
import { probe } from '../../../../scripts/ui-gates/probe.mjs';
import { measurePainted } from '../../../../scripts/ui-gates/png.mjs';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Locate the scroll owner of the active surface and mark it. */
const scroller = (page) => page.evaluate(() => {
  const sheets = [...document.querySelectorAll('.sheet, [role=dialog][aria-modal=true]')];
  const scope = sheets.length ? sheets[sheets.length - 1] : document;
  const cands = [...scope.querySelectorAll('.sheet-body, .sheet, .debrief, .debrief-layout, main.screen, main, .app')].concat(sheets.length ? [scope] : []).filter((el) => el.scrollHeight - el.clientHeight > 4 && getComputedStyle(el).overflowY !== 'visible');
  const el = sheets.length ? cands.find((c) => c.matches('.sheet-body')) ?? cands[0] : cands.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0];
  if (!el) return null;
  el.dataset.capScroll = '1';
  return { scroll: el.scrollHeight, client: el.clientHeight };
});

/**
 * @param {{ repo: string, baseURL: string, widths?: number[], outDir?: string | null, onFrame?: (frame: object) => void, log?: (...a: unknown[]) => void }} options
 * @returns {Promise<{ report: Record<string, Record<string, unknown>>, failures: string[] }>}
 */
export async function walk({ repo, baseURL, widths = WIDTHS, outDir = null, onFrame = () => {}, log = () => {} }) {
  const require = createRequire(path.join(repo, 'package.json'));
  const { chromium } = require('playwright-core');
  const known = new Set(stateIds());
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const report = {}, failures = [];
  try {
    for (const width of widths) {
      const height = HEIGHTS[width];
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 2 });
      await context.addInitScript((seed) => {
        Object.defineProperty(Crypto.prototype, 'getRandomValues', { configurable: true, writable: true, value(array) { array.fill(seed); return array; } });
      }, CAMPAIGN_SEED);
      // Motion settles to its final frame, so a shot never catches a transition or pulse mid-way.
      await context.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}';
          document.head.append(style);
        });
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      const setInsets = (i) => cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: i });
      await page.clock.setFixedTime(new Date(FIXED_TIME));
      page.on('dialog', (d) => d.accept());
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
      const dir = outDir ? path.join(outDir, String(width)) : null;
      if (dir) await mkdir(dir, { recursive: true });
      report[width] = { errors };
      const seen = new Set();
      const shot = async (name, { segments = 3 } = {}) => {
        if (!known.has(name)) throw new Error(`${name} is not in the manifest (scripts/ui-gates/manifest.mjs)`);
        if (seen.has(name)) throw new Error(`${name} was captured twice`);
        seen.add(name);
        const decision = !!STATES.find((s) => s.id === name)?.decision;
        await page.waitForTimeout(350);
        // Wait for the copy to stop changing (radio lines and timers settle), so two runs measure the same frame.
        for (let last = null, n = 0; n < 20; n++) {
          const hash = await page.evaluate(() => { let h = 2166136261; for (const ch of document.body.innerText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; });
          if (hash === last) break;
          last = hash; await page.waitForTimeout(150);
        }
        await page.evaluate(() => document.querySelectorAll('[data-cap-scroll]').forEach((el) => delete el.dataset.capScroll));
        const s = await scroller(page);
        const step = s ? Math.max(1, Math.round(s.client * 0.85)) : 0;
        const pages = s ? Math.min(Math.max(segments, 12), Math.ceil(Math.max(0, s.scroll - s.client) / step) + 1) : 1;
        const entry = { scrollHeight: s?.scroll ?? null, clientHeight: s?.client ?? null, segments: [] };
        // The planned segments, and more if the content grew since it was measured, until the scroll owner's end is on screen.
        for (let i = 0; i < pages + 16; i++) {
          let scrollTop = 0, atEnd = true;
          if (s) {
            ({ scrollTop, atEnd } = await page.evaluate((y) => { const el = document.querySelector('[data-cap-scroll]'); if (!el) return { scrollTop: 0, atEnd: true }; el.scrollTop = y; return { scrollTop: el.scrollTop, atEnd: el.scrollTop >= el.scrollHeight - el.clientHeight - 1 }; }, i * step));
            await page.waitForTimeout(200);
          }
          const file = `${name}-s${i}.jpg`;
          if (dir) await page.screenshot({ path: path.join(dir, file), type: 'jpeg', quality: 80 });
          const base = await page.evaluate(probe, { ...PROBE_CFG, decision: decision && i === 0 });
          // Text over art: hide the text, photograph what is behind its box, and measure against that.
          if (process.env.UI_GATES_SAMPLE_ART) base.findings.push(...await measurePainted(page, base.paintedTexts, { debugDir: process.env.UI_GATES_DEBUG_DIR }));
          const insets = {};
          for (const [fixture, inset] of Object.entries(INSET_FIXTURES)) {
            await setInsets(inset); await page.waitForTimeout(60);
            insets[fixture] = (await page.evaluate(probe, { ...PROBE_CFG, only: 'R13', insets: inset, atStart: scrollTop <= 1, atEnd })).findings;
          }
          await setInsets({ top: 0, right: 0, bottom: 0, left: 0 });
          const frame = { width, name, segment: i, scrollTop, atEnd, probe: base, insets };
          // The id lists feed R6's pinned-bar check in memory; they are too long to keep in probe.json.
          const { tested, pinned, paintedTexts, ...slim } = base;
          entry.segments.push({ file, scrollTop, atEnd, probe: slim, insets });
          onFrame(frame);
          if (i >= pages - 1 && atEnd) break;
        }
        if (s) await page.evaluate(() => { const el = document.querySelector('[data-cap-scroll]'); if (el) el.scrollTop = 0; });
        report[width][name] = entry;
        log(width, name, pages);
      };
      const closeSheet = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(250); };
      page.setDefaultTimeout(8000);
      const step = async (name, fn) => {
        try { await fn(); } catch (e) {
          report[width][`${name}-error`] = String(e).slice(0, 300); log(width, name, 'ERROR', String(e).slice(0, 160)); failures.push(`${width} ${name}`);
          for (let i = 0; i < 3 && await page.locator('.sheet').count(); i++) await closeSheet();
        }
      };
      const tab = (t) => page.locator('nav.bottomnav').getByText(t, { exact: true }).click();
      const teamSection = (section) => page.locator('.team-page [aria-label="Team sections"]').getByRole('button', { name: section, exact: true }).click();

      await page.goto(baseURL);
      await step('first-run', async () => { await page.locator('.first-run').waitFor(); await shot('01-first-run', { segments: 4 });
        await page.getByRole('button', { name: 'Continue to headquarters', exact: true }).click(); await page.locator('nav.bottomnav').waitFor(); });
      await step('hq', async () => { await tab('HQ'); await shot('02-hq', { segments: 5 }); });
      await step('finance', async () => { await page.locator('.topbar .stats button').first().click(); await shot('03-finance-sheet', { segments: 2 }); await closeSheet(); });
      await step('level', async () => { await page.locator('.resource-bar .stat-level').click(); await shot('03b-level-sheet', { segments: 1 }); await closeSheet(); });
      await step('staff', async () => { await tab('Team'); await teamSection('Command'); await page.locator('.team-command .command-room-post').first().click(); await shot('04-command-staff-sheet', { segments: 2 }); await closeSheet(); });
      await step('squad', async () => { await tab('Team'); await teamSection('SWAT'); await shot('05-squad', { segments: 6 }); });
      await step('officer', async () => { await page.locator('.officer-character-grid .ocard').first().click(); await shot('06-officer-sheet', { segments: 3 });
        for (const t of ['Career', 'Care']) { const b = page.locator('.sheet').getByRole('tab', { name: t, exact: true }).first(); if (await b.count()) { await b.click(); await shot(`06-officer-sheet-${t.toLowerCase()}`, { segments: 1 }); } }
        await closeSheet(); });
      await step('arrange', async () => { const b = page.getByRole('button', { name: /Arrange/ }).first(); await b.click(); await shot('07-arrange-sheet', { segments: 2 }); await closeSheet(); });
      await step('hire', async () => { await page.locator('.team-page [aria-label="SWAT sections"]').getByRole('button', { name: 'Hire', exact: true }).click(); await shot('08-hire', { segments: 2 }); const b = page.getByRole('button', { name: /Review hire/ }).first(); await b.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
        await shot('08-recruit-card', { segments: 1 }); await b.click(); await shot('08-hire-contract-sheet', { segments: 2 }); await closeSheet(); });
      await step('training', async () => { await page.locator('.team-page [aria-label="SWAT sections"]').getByRole('button', { name: 'Training', exact: true }).click(); await shot('09-training', { segments: 3 }); });
      await step('develop', async () => { await tab('Build'); await shot('10-develop', { segments: 6 }); });
      await step('develop-sheet', async () => { await page.locator('.facility-plan [data-facility-branch]').first().click(); await shot('11-develop-sheet', { segments: 2 }); await closeSheet(); });
      await step('gear', async () => { await tab('Store'); await page.locator('.store-screen-head').waitFor(); await shot('12-store', { segments: 6 });
        await page.locator('.store-screen-head [aria-label="Store sections"]').getByRole('button', { name: 'Boosts', exact: true }).click(); await shot('12-store-boosts', { segments: 3 });
        await page.locator('.store-screen-head [aria-label="Store sections"]').getByRole('button', { name: 'Equipment', exact: true }).click(); });
      await step('gear-item', async () => { await page.locator('main .inv-tile').first().click(); await shot('13-gear-item-sheet', { segments: 3 }); await closeSheet(); });
      for (const [n, name] of [['14-restock-sheet', 'Restock rules'], ['15-presets-sheet', 'Loadout presets']]) await step(n, async () => { const tools = page.locator('[data-disclosure="armory-tools"]'); if (!await tools.evaluate((el) => el.open)) await tools.locator('summary').click(); await page.getByRole('button', { name: new RegExp(name) }).first().click(); await shot(n, { segments: 2 }); await closeSheet(); });
      await step('menu', async () => { await page.locator('.resource-bar .menu-btn').click(); await shot('16-menu-sheet', { segments: 2 });
        await page.locator('.menu-sheet').getByRole('button', { name: /Themes to avoid/ }).click(); await page.waitForTimeout(300); await shot('17-themes-page', { segments: 2 }); await closeSheet(); });
      await step('saves', async () => { await page.locator('.resource-bar .menu-btn').click(); await page.waitForTimeout(300); await page.locator('.menu-sheet .menu-link').click(); await page.waitForTimeout(400); await shot('16b-saves-sheet', { segments: 3 }); await closeSheet(); });
      await step('team-patrol', async () => {
        await tab('Team'); await teamSection('Patrol'); await page.locator('.patrol-page').waitFor(); await shot('05-patrol', { segments: 6 });
        await page.locator('.team-page').getByRole('button', { name: 'Hire patrol', exact: true }).click(); await shot('05-patrol-hiring', { segments: 3 });
        const offer = page.locator('[data-patrol-candidate]').first().getByRole('button', { name: /^Review hire for / });
        if (await offer.count()) {
          await offer.click(); await shot('05-patrol-hire-review', { segments: 2 });
          const confirm = page.getByRole('button', { name: /^Confirm hire/ });
          if (await confirm.count() && await confirm.isEnabled()) { await confirm.click(); await page.locator('.patrol-receipt[role="status"]').waitFor(); await shot('05-patrol-hire-confirmed', { segments: 2 }); await page.getByRole('button', { name: 'Done', exact: true }).click(); }
        }
        const trainee = page.locator('[data-patrol-employee]').first().getByRole('button', { name: /^Review training for / });
        if (await trainee.count()) { await trainee.click(); await shot('05-patrol-training-review', { segments: 2 }); await closeSheet(); }
        const dismiss = page.locator('[data-patrol-employee]').first().getByRole('button', { name: /^Review dismissal for / });
        if (await dismiss.count()) { await dismiss.click(); await shot('05-patrol-dismissal-review', { segments: 2 }); await closeSheet(); }
      });
      await step('team-command', async () => { await tab('Team'); await teamSection('Command'); await page.locator('.team-command .command-room').waitFor(); await shot('05-team-command', { segments: 4 }); });
      await step('board', async () => { await tab('Calls'); await page.locator('.cl-card').first().waitFor(); await shot('18-board', { segments: 5 }); });
      // A call card opens its brief directly (no Prepare button); the first call on a fresh board may bring the welcome sheet.
      await step('brief', async () => { const welcome = page.locator('.welcome-sheet'); if (await welcome.count()) await welcome.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.locator('.cl-card-button').first().click(); await page.locator('.cl-flow-body[data-step="brief"]').waitFor(); await shot('19-prepare-brief', { segments: 5 });
        await page.locator('.cl-map-chip').click(); await page.locator('.cl-map-sheet').waitFor(); await shot('19b-brief-map-sheet', { segments: 2 }); await closeSheet(); });
      await step('team', async () => { await page.getByRole('button', { name: 'Choose team', exact: true }).click(); await shot('20-prepare-team-empty', { segments: 2 });
        // Deploy preselects the best-fit ready squad; pick one only when nothing is preselected.
        if (!(await page.locator('.cl-squads button[aria-pressed="true"]').count())) await page.locator('.cl-squads button.cl-squad:not([aria-label*="not deployable"]):not([aria-label*=" 0 of "])').first().click();
        await shot('21-prepare-team-picked', { segments: 6 });
        const buy = page.getByRole('button', { name: /^Buy \d+ radios? · / }); if (await buy.count()) { await buy.first().click(); await page.waitForTimeout(400); } });
      await step('live', async () => { await page.getByRole('button', { name: /^Deploy [A-Z]/ }).click(); await page.locator('.call-grid').waitFor(); await shot('22-live-decide-1', { segments: 4 });
        const choiceJump = page.locator('.live-choice-access');
        if (await choiceJump.isVisible()) {
          await choiceJump.click();
          const choiceVisible = await page.evaluate(() => {
            const screen = document.querySelector('main.screen');
            const choice = document.querySelector('.operation-choices .callbtn');
            if (!screen || !choice) return false;
            const view = screen.getBoundingClientRect(), item = choice.getBoundingClientRect();
            return item.top >= view.top && item.bottom <= view.bottom;
          });
          if (!choiceVisible) throw new Error('Your call did not bring a full choice into view');
          await page.evaluate(() => { const screen = document.querySelector('main.screen'); if (screen) screen.scrollTop = 0; });
        }
        await page.getByRole('button', { name: 'Full map', exact: true }).click(); await page.locator('.live-map-full').waitFor(); await shot('22b-live-full-map', { segments: 1 });
        await page.getByRole('button', { name: 'Close the map' }).click(); await page.waitForTimeout(300);
        const card = page.locator('.call-grid .callbtn:not(.callbtn-off)').first(); const review = card.locator('.callbtn-review');
        await (await review.count() ? review : card).click(); await shot('23-review-sheet', { segments: 3 });
        await page.getByRole('button', { name: /^Confirm / }).click(); await shot('24-result-beat', { segments: 3 }); });
      await step('live-rest', async () => {
        let n = 0, stage = 2;
        for (; n < 40; n++) {
          const run = await page.evaluate(() => window.__ti.getState().activeRun?.status);
          if (run !== 'active') break;
          const proceed = page.locator('.live-continue button');
          if (await proceed.count()) { await proceed.click(); await page.locator('.call-grid').waitFor(); if (stage <= 3) await shot(`25-live-decide-${stage++}`, { segments: 3 }); continue; }
          const card = page.locator('.call-grid .callbtn:not(.callbtn-off)').first();
          if (await card.count()) { const review = card.locator('.callbtn-review'); await (await review.count() ? review : card).click(); await page.getByRole('button', { name: /^Confirm / }).click(); await page.waitForTimeout(300); continue; }
          const cont = page.locator('.operation-continuations button'); if (await cont.count()) { await cont.first().click(); continue; }
          break;
        }
        await page.getByRole('button', { name: 'Next call', exact: true }).waitFor({ timeout: 8000 });
        await shot('26-debrief', { segments: 6 });
        await page.getByRole('button', { name: 'Next call', exact: true }).click(); await page.waitForTimeout(400);
        await shot('27-board-after', { segments: 3 }); });
      await step('hq-after', async () => { await tab('HQ'); await shot('28-hq-after-call', { segments: 5 }); });
      // The states the first pass could not see. They come last, so unlocking spends no funds the earlier frames show.
      await step('unlocked-tools', async () => {
        const unlocked = await page.evaluate(() => ['logistics_presets', 'logistics_restock'].map((nodeId) => window.__ti.send({ type: 'unlockNode', nodeId }).ok));
        if (!unlocked.every(Boolean)) throw new Error(`could not unlock the restock and presets nodes: ${unlocked}`);
        await tab('Store'); await page.waitForTimeout(300);
        for (const [n, name] of [['29-restock-unlocked-sheet', 'Restock rules'], ['30-presets-unlocked-sheet', 'Loadout presets']]) { const tools = page.locator('[data-disclosure="armory-tools"]'); if (!await tools.evaluate((el) => el.open)) await tools.locator('summary').click(); await page.getByRole('button', { name: new RegExp(name) }).first().click(); await shot(n, { segments: 2 }); await closeSheet(); }
      });
      await step('save-error', async () => {
        await page.locator('.resource-bar .menu-btn').click(); await page.waitForTimeout(300); await page.locator('.menu-sheet .menu-link').click(); await page.waitForTimeout(400);
        // Storage refuses the write, as a full or blocked browser does, so "Save now" fails and says why.
        await page.evaluate(() => { window.__realSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); }; });
        try {
          await page.getByRole('button', { name: 'Save now', exact: true }).click(); await page.waitForTimeout(500);
          if (!await page.locator('.sheet [role=alert]').count()) throw new Error('the save error did not show');
          // Storage keeps refusing until the shot is taken, or the next autosave would clear the message mid-walk.
          await shot('31-saves-error', { segments: 2 });
        } finally {
          await page.evaluate(() => { Storage.prototype.setItem = window.__realSetItem; });
        }
        await closeSheet(); });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return { report, failures };
}

async function main() {
  const [repo, outDir, baseURL, widthsArg] = process.argv.slice(2);
  const widths = (widthsArg ?? '390,320,430').split(',').map(Number);
  const { report, failures } = await walk({ repo, baseURL, widths, outDir, log: console.log });
  await writeFile(path.join(outDir, 'probe.json'), JSON.stringify(report, null, 1));
  if (failures.length) { console.error('Steps failed:', failures.join(', ')); process.exit(2); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(e); process.exit(1); });
