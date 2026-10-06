import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Real UI, isolated browser context, no injected game state or stubbed requests.
 * A fresh department opens the Ops board and:
 * 1. checks the casebook shows a locked framework as its requirement, with no call content;
 * 2. takes every starting board call live (each a "New kind of call"), which discovers its recipe;
 * 3. replays each discovered recipe from the casebook as practice on fresh buildings: its first
 *    fixed building, and with `generated` one generated building type per framework, rotating by
 *    `rotation` so different phone sizes see different types, preferring an upper floor once;
 * 4. launches today's featured operation as practice and sees its best result remembered. */
export async function playCasebook(page, { baseURL = 'http://127.0.0.1:5174', width = 390, height = 844, squads = 1, captureDir, generated = true, rotation = 0 } = {}) {
  await page.clock.setFixedTime(new Date());
  await page.setViewportSize({ width, height });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(baseURL); await page.locator('nav').waitFor();
  const state = () => page.evaluate(() => window.__ti.getState());
  const overflow = async (where) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow: ${where}`);
  const capture = async (name, locator) => {
    if (!captureDir) return;
    await mkdir(captureDir, { recursive: true });
    if (locator) { await locator.scrollIntoViewIfNeeded(); await locator.screenshot({ path: `${captureDir}/${name}-${width}.png` }); }
    else await page.screenshot({ path: `${captureDir}/${name}-${width}.png` });
  };
  const results = [];
  await page.locator('nav').getByText('Ops', { exact: true }).click();
  const casebook = page.locator('.casebook-card');
  await casebook.waitFor();
  const row = (type) => casebook.locator(`.casebook-row[data-type="${type}"]`);

  // 1. Locked framework: the requirement, never the content.
  const locked = casebook.locator('.casebook-row[data-status="locked"]');
  assert.ok(await locked.count() > 0, 'a new department has a locked framework');
  const lockedText = await locked.first().innerText();
  assert.match(lockedText, /Not yet dispatched to your department/);
  assert.match(lockedText, /An officer certified in \w/);
  assert.equal(await locked.first().locator('h3, button, .casebook-where').count(), 0, 'locked rows carry no call content or practice');
  const before0 = await state();
  assert.equal(Object.keys(before0.casebook?.recipes ?? {}).length, 0, 'nothing discovered yet');
  for (const unfound of await casebook.locator('.casebook-row[data-status="unfound"]').all()) {
    assert.match(await unfound.innerText(), /Not taken yet · \d situations? to find/);
    assert.equal(await unfound.locator('h3, button').count(), 0, 'undiscovered rows show counts only');
  }
  await overflow('casebook with locked row');
  await capture('casebook-locked', locked.first());

  // Prepare -> squads -> start -> choices until the debrief -> close. Shared by live and practice runs.
  const play = async (label, { practice }) => {
    const upperTab = page.getByRole('tab', { name: /^Upper floor/ });
    await page.locator('.prep-kicker').waitFor();
    const floors = await upperTab.count() ? 2 : 1;
    if (floors === 2) {
      assert.match(await page.locator('.prep-kicker').innerText(), /2\sfloors/, `${label}: preparation names the floors`);
      await upperTab.click();
      assert.equal(await upperTab.getAttribute('aria-selected'), 'true');
      await overflow(`${label} prepare upper floor`);
      await page.getByRole('tab', { name: /^Ground floor/ }).click();
    }
    await page.getByRole('button', { name: /Alpha/ }).click();
    // Live calls draw radios from owned stock (six, one per officer), so they send one squad; practice uses virtual gear.
    const used = practice ? squads : 1;
    if (used > 1) await page.getByRole('button', { name: /Bravo/ }).click();
    await page.getByRole('button', { name: practice ? 'Start practice' : 'Deploy', exact: true }).click();
    await page.locator('.call-grid').waitFor(); await overflow(`${label} live`);
    const started = await state();
    assert.equal(started.activeRun.practice, practice, `${label}: ${practice ? 'practice' : 'live'} run`);
    if (floors === 2) {
      // People and markers upstairs are only drawn on the upper floor; the tab must reach them.
      const tab = page.getByRole('tab', { name: /^Upper floor/ });
      const known = /known (person|people)/.test(await tab.getAttribute('aria-label'));
      await tab.click();
      assert.equal(await tab.getAttribute('aria-selected'), 'true', `${label}: upper floor tab selects`);
      if (known) assert.ok(await page.locator('main [data-silhouette]').count() > 0, `${label}: people upstairs are drawn on the upper floor`);
      await overflow(`${label} live upper floor`);
      await capture(`${label.replace(/\W+/g, '-')}-live-upper`);
      await page.getByRole('tab', { name: /^Ground floor/ }).click();
    }
    let steps = 0;
    for (; steps < 60; steps++) {
      const current = await state(); if (current.activeRun?.status !== 'active') break;
      const available = page.locator('.call-grid .callbtn:not(.callbtn-off)');
      if (await available.count()) {
        await available.first().click();
        const confirm = page.getByRole('button', { name: /^Confirm:/ });
        assert.equal(await confirm.isEnabled(), true, `${label}: selected available action must be confirmable`);
        await confirm.click();
      } else if (await page.locator('.operation-continuations button').count()) {
        await page.locator('.operation-continuations button').first().click();
      } else {
        const failed = page.getByRole('button', { name: 'Review failed response', exact: true });
        assert.equal(await failed.count(), 1, `${label}: no usable choice or honest failure control`);
        await failed.click();
        await page.getByRole('button', { name: 'Confirm failed response', exact: true }).click();
      }
      await page.waitForFunction(previous => {
        const run = window.__ti.getState().activeRun;
        return run?.revision !== previous.revision || run?.stage !== previous.stage || run?.status !== previous.status;
      }, { revision: current.activeRun.revision, stage: current.activeRun.stage, status: current.activeRun.status });
      await overflow(`${label} live step ${steps}`);
    }
    const ended = await state(); assert.equal(ended.activeRun?.status, 'debrief', `${label}: bounded ending`);
    if (practice) assert.match(await page.locator('main').innerText(), /Practice/);
    await overflow(`${label} debrief`);
    await page.getByRole('button', { name: 'Close debrief', exact: true }).click();
    await casebook.waitFor();
    const after = await state(); assert.equal(after.activeRun, null);
    console.log(`Completed ${label} at ${width}px (${floors} floor${floors > 1 ? 's' : ''}, ${used} squad${used > 1 ? 's' : ''}) in ${steps} steps: ${ended.activeRun.endingId}`);
    const result = { label, practice, location: started.activeRun.locationFamilyId, floors, width, height, squads: used, steps, ending: ended.activeRun.endingId, scenarioId: ended.activeRun.scenarioId };
    results.push(result);
    return { result, started, after };
  };

  // 2. Take every starting call live. Each is the first of its framework, so it carries the badge;
  // dispatching it discovers its recipe in the casebook.
  const discovered = [];
  const start = await state();
  for (const card of [...start.incidents]) {
    const now = await state();
    const index = now.incidents.filter(c => c.expiresAt > Date.now()).findIndex(c => c.id === card.id);
    if (index < 0) continue;
    assert.equal(card.newKind, true, `${card.type}: first call of its framework is marked new`);
    const view = page.locator('.opboard', { has: page.getByRole('button', { name: 'Prepare', exact: true }) }).nth(index);
    assert.match(await view.innerText(), /New kind of call/, `${card.type}: board card shows the badge`);
    if (discovered.length === 0) await capture('board-new-kind', view);
    await view.getByRole('button', { name: 'Prepare', exact: true }).click();
    const { after } = await play(`${card.type} live`, { practice: false });
    const keys = Object.keys(after.casebook.recipes).filter(key => key.startsWith(`${card.type}/`));
    assert.equal(keys.length, 1, `${card.type}: dispatch discovered one recipe`);
    assert.equal(after.debriefs[0].practice, false);
    const found = await row(card.type).innerText();
    assert.match(found, /1 of 3/, `${card.type}: casebook counts the situation found`);
    assert.match(found, /Best: /);
    assert.match(found, /2 more situations to find/);
    discovered.push(card.type);
    await overflow(`${card.type} casebook after discovery`);
  }
  assert.ok(discovered.length > 0, 'at least one starting call was taken live');
  await capture('casebook-found', row(discovered[0]));
  await capture('casebook', casebook);

  // 3. Replay each discovered recipe from the casebook on fresh buildings.
  let offset = rotation, upperChecked = 0, layoutChecked = false;
  for (const type of discovered) {
    await row(type).getByRole('button', { name: 'Practice', exact: true }).click();
    const panel = row(type).locator('.casebook-practice');
    const building = panel.getByLabel('Building');
    const fixed = await building.locator('optgroup[label="Fixed layouts"] option, > option').evaluateAll(options => options.map(option => option.value));
    const generatedChoices = await building.locator('optgroup[label="Generated layouts"] option').evaluateAll(options => options.map(option => ({ id: option.value, text: option.textContent })));
    const choices = [{ familyId: fixed[0], kind: 'fixed' }];
    if (generated && generatedChoices.length) {
      // Two generated types per framework, rotating; the first framework starts with a two-floor type.
      const picks = new Set();
      const upper = upperChecked === 0 ? generatedChoices.find(choice => /2 floors/.test(choice.text)) : null;
      if (upper) picks.add(upper.id);
      while (picks.size < Math.min(2, generatedChoices.length)) picks.add(generatedChoices[offset++ % generatedChoices.length].id);
      for (const familyId of picks) choices.push({ familyId, kind: 'generated' });
    }
    for (const { familyId, kind } of choices) {
      const label = `${type} practice on ${familyId}`;
      if (!(await row(type).locator('.casebook-practice').count())) await row(type).getByRole('button', { name: 'Practice', exact: true }).click();
      await building.selectOption(familyId);
      assert.match(await panel.getByLabel('Situation').locator('option:checked').innerText(), /^Situation [1-3]/, `${label}: situations are named by number only`);
      const where = await panel.locator('.casebook-where').innerText();
      if (kind === 'generated' && !layoutChecked) {
        // A new layout of a generated type is a different building of the same type.
        await panel.getByRole('button', { name: 'New layout', exact: true }).click();
        assert.match(await panel.innerText(), /Layout 2/);
        assert.equal(await panel.locator('.casebook-where').innerText(), where, `${label}: new layout keeps the building type`);
        layoutChecked = true;
      }
      await overflow(`${label} casebook practice`);
      if (kind === 'generated') await capture(`casebook-practice-${type}`, panel);
      const before = await state();
      await panel.getByRole('button', { name: 'Practice this call', exact: true }).click();
      const { result, started, after } = await play(label, { practice: true });
      assert.equal(/\b2 floors\b/.test(where), result.floors === 2, `${label}: casebook floor chip matches the map (${where})`);
      assert.ok(started.activeRun.locationFamilyId.startsWith(familyId), `${label}: practice runs in the chosen building (${started.activeRun.locationFamilyId})`);
      assert.deepEqual(after.units, before.units, `${label}: practice must not consume owned equipment`);
      assert.equal(after.department.trust, before.department.trust);
      assert.equal(after.department.funding, before.department.funding);
      assert.equal(after.debriefs[0].fundingReward, 0); assert.equal(after.debriefs[0].devPointReward, 0);
      // Practice can improve a best result (marked as practice) and add a building type met only
      // in practice, but never discovers a framework or a situation.
      assert.deepEqual(after.casebook.frameworksSeen, before.casebook.frameworksSeen, `${label}: practice discovers no framework`);
      const situations = (book) => new Set(Object.entries(book.recipes).filter(([, entry]) => !entry.practiceOnly).map(([key]) => key.split('/').filter((_, i) => i !== 1 && i !== 3).join('/')));
      assert.deepEqual(situations(after.casebook), situations(before.casebook), `${label}: practice discovers no situation`);
      for (const [key, entry] of Object.entries(after.casebook.recipes)) if (!before.casebook.recipes[key]) assert.equal(entry.practiceOnly, true, `${label}: ${key} is marked practice-only`);
      Object.assign(result, { type, familyId });
      if (result.floors === 2) upperChecked++;
    }
  }
  if (generated) assert.ok(upperChecked > 0, 'at least one journey used an upper floor');

  // 4. Today's featured operation: practice only, best result remembered on this device.
  const featured = page.locator('.featured-card');
  assert.match(await featured.innerText(), /No result today yet/);
  await overflow('featured operation');
  await capture('featured-before', featured);
  const beforeFeatured = await state();
  await featured.getByRole('button', { name: 'Practice featured operation', exact: true }).click();
  const { after: afterFeatured } = await play('featured operation', { practice: true });
  assert.equal(afterFeatured.department.funding, beforeFeatured.department.funding, 'featured operation pays nothing');
  assert.deepEqual(afterFeatured.units, beforeFeatured.units, 'featured operation uses virtual gear');
  assert.match(await featured.innerText(), /Your best today: \w/);
  assert.ok(await page.evaluate(() => localStorage.getItem('tactically-idle/featured-best')), 'best result stored locally');
  await capture('featured-after', featured);

  assert.deepEqual(errors, [], 'uncaught browser errors');
  return results;
}

/** Earlier name, kept for scripts that import it. */
export const playLibrary = playCasebook;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const results = [];
  try {
    for (const [index, [width, height]] of [[390, 844], [320, 568]].entries()) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
      try { results.push(...await playCasebook(await context.newPage(), { width, height, squads: width === 320 ? 2 : 1, rotation: index, baseURL: process.env.TI_BASE_URL, captureDir: process.env.TI_CAPTURE_DIR })); }
      finally { await context.close(); }
    }
    if (process.env.TI_E2E_REPORT) await writeFile(process.env.TI_E2E_REPORT, JSON.stringify(results, null, 2) + '\n');
    const live = results.filter(result => !result.practice);
    const generatedRuns = results.filter(result => result.familyId && /_g\d+$/.test(result.familyId));
    console.log(`Passed ${results.length} real browser journeys at both phone sizes with one and two squads: a locked casebook row, ${live.length} live calls discovering ${new Set(live.map(result => result.label)).size} frameworks, ${results.filter(result => result.familyId).length} casebook replays (${generatedRuns.length} on ${new Set(generatedRuns.map(result => result.familyId)).size} generated building types, ${results.filter(result => result.floors > 1).length} with an upper floor), and the featured operation.`);
  } finally { await browser.close(); }
}
