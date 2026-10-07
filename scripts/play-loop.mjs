import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Real UI, isolated browser context, no injected game state or stubbed requests.
 * A fresh department opens the Ops board and:
 * 1. checks the casebook shows a locked framework as its requirement, with no call content;
 * 2. takes every starting board call live (each a "New kind of call"), which discovers its recipe
 *    in the casebook and earns department service;
 * 3. takes each standing assignment live once the incidents are gone.
 * With `squads: 2` every call that takes two squads sends both; the radios the second squad
 * needs are bought through the Prepare screen's own purchase button, never injected. */
export async function playLiveCalls(page, { baseURL = 'http://127.0.0.1:5174', width = 390, height = 844, squads = 1, captureDir } = {}) {
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
  // Every operation on the board is live: no daily featured card and no launcher in the casebook.
  assert.equal(await page.locator('.featured-card, .casebook-row button').count(), 0, 'the Ops board offers live operations only');

  // 1. Locked framework: the requirement, never the content.
  const locked = casebook.locator('.casebook-row[data-status="locked"]');
  assert.ok(await locked.count() > 0, 'a new department has a locked framework');
  const lockedText = await locked.first().innerText();
  assert.match(lockedText, /Not yet dispatched to your department/);
  assert.match(lockedText, /Department level \d|An officer certified in \w/);
  // Tactical calls open at level 1; protected rescue still waits for a vehicle-trained officer.
  const rescue = await row('protected_rescue').innerText();
  assert.match(rescue, /An officer certified in \w/);
  assert.doesNotMatch(rescue, /Department level/);
  assert.equal(await locked.first().locator('h3, button').count(), 0, 'locked rows carry no call content');
  const before0 = await state();
  assert.equal(Object.keys(before0.casebook?.recipes ?? {}).length, 0, 'nothing discovered yet');
  for (const unfound of await casebook.locator('.casebook-row[data-status="unfound"]').all()) {
    assert.match(await unfound.innerText(), /Not taken yet · \d situations? to find/);
    assert.equal(await unfound.locator('h3, button').count(), 0, 'undiscovered rows show counts only');
  }
  await overflow('casebook with locked row');
  await capture('casebook-locked', locked.first());

  // Prepare -> squads -> deploy -> choices until the debrief -> close.
  const play = async (label) => {
    const before = await state();
    const upperTab = page.getByRole('tab', { name: /^Upper floor/ });
    await page.locator('.prep-kicker').waitFor();
    assert.equal(await page.locator('.prepare .toggle input[type="checkbox"]').count(), 0, `${label}: preparation has no mode switch`);
    const floors = await upperTab.count() ? 2 : 1;
    if (floors === 2) {
      assert.match(await page.locator('.prep-kicker').innerText(), /2\sfloors/, `${label}: preparation names the floors`);
      await upperTab.click();
      assert.equal(await upperTab.getAttribute('aria-selected'), 'true');
      await overflow(`${label} prepare upper floor`);
      await page.getByRole('tab', { name: /^Ground floor/ }).click();
    }
    await page.getByRole('button', { name: /Alpha/ }).click();
    if (squads > 1) await page.getByRole('button', { name: /Bravo/ }).click();
    // Standard radios come from owned stock, one per officer. A short squad is equipped by
    // buying the missing radios on this screen, as a player would.
    const buyRadios = page.getByRole('button', { name: /^Buy \d+ radios? · / });
    let boughtRadios = 0;
    if (await buyRadios.count()) {
      boughtRadios = Number((await buyRadios.first().textContent()).match(/Buy (\d+)/i)[1]);
      await buyRadios.first().click();
      await page.waitForFunction(count => Object.values(window.__ti.getState().units).filter(unit => unit.itemId === 'radio_kit').length >= count,
        Object.values(before.units).filter(unit => unit.itemId === 'radio_kit').length + boughtRadios);
      await overflow(`${label} prepare after buying radios`);
    }
    const deploy = page.getByRole('button', { name: 'Deploy', exact: true });
    assert.equal(await deploy.isEnabled(), true, `${label}: the chosen squads can deploy`);
    await deploy.click();
    await page.locator('.call-grid').waitFor(); await overflow(`${label} live`);
    const started = await state();
    assert.ok(started.activeRun.reservationIds.length > 0, `${label}: a live run reserves owned equipment`);
    const used = started.activeRun.squadIds.length;
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
    assert.equal(await page.locator('.debrief-hero .kicker').innerText(), 'DEBRIEF', `${label}: the debrief is a live result`);
    assert.equal(await page.locator('.result-rewards').count(), 1, `${label}: the debrief lists its rewards`);
    await overflow(`${label} debrief`);
    await page.getByRole('button', { name: 'Close debrief', exact: true }).click();
    await casebook.waitFor();
    const after = await state(); assert.equal(after.activeRun, null);
    // Every operation is live: it earns department service and settles its equipment.
    assert.ok(after.department.service > before.department.service, `${label}: a live call earns service`);
    assert.equal(after.debriefs[0].runId, started.activeRun.id, `${label}: the debrief is on record`);
    assert.equal(after.reservations.length, 0, `${label}: equipment returns after the debrief`);
    console.log(`Completed ${label} at ${width}px (${floors} floor${floors > 1 ? 's' : ''}, ${used} squad${used > 1 ? 's' : ''}${boughtRadios ? `, ${boughtRadios} radios bought` : ''}) in ${steps} steps: ${ended.activeRun.endingId}`);
    const result = { label, location: started.activeRun.locationFamilyId, floors, width, height, squads: used, boughtRadios, steps, ending: ended.activeRun.endingId, scenarioId: ended.activeRun.scenarioId };
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
    const { after, result } = await play(`${card.type} live`);
    Object.assign(result, { type: card.type, kind: 'incident' });
    const keys = Object.keys(after.casebook.recipes).filter(key => key.startsWith(`${card.type}/`));
    assert.equal(keys.length, 1, `${card.type}: dispatch discovered one recipe`);
    const found = await row(card.type).innerText();
    assert.match(found, /1 of 3/, `${card.type}: casebook counts the situation found`);
    assert.match(found, /Best: /);
    assert.match(found, /2 more situations to find/);
    assert.equal(await row(card.type).locator('button').count(), 0, `${card.type}: the casebook is a record, not a launcher`);
    discovered.push(card.type);
    await overflow(`${card.type} casebook after discovery`);
  }
  assert.ok(discovered.length > 0, 'at least one starting call was taken live');
  await capture('casebook-found', row(discovered[0]));
  await capture('casebook', casebook);

  // 3. With the incidents taken, the standing assignments fill the open places. Each is live too.
  const divider = page.locator('.opboard-divider');
  assert.match(await divider.innerText(), /^Standing assignments$/);
  await capture('board-standing', divider);
  const codes = await page.locator('.opboard-divider ~ .opboard .opboard-code').allInnerTexts();
  assert.ok(codes.length > 0, 'standing assignments fill the open places');
  for (const code of codes) {
    const card = page.locator('.opboard', { has: page.locator('.opboard-code', { hasText: code }) });
    await card.getByRole('button', { name: 'Prepare', exact: true }).click();
    const { result } = await play(`${code} standing`);
    Object.assign(result, { kind: 'standing' });
  }

  if (squads > 1) assert.ok(results.some(result => result.squads > 1), 'at least one live call sent two squads');
  assert.deepEqual(errors, [], 'uncaught browser errors');
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const results = [];
  try {
    for (const [width, height] of [[390, 844], [320, 568]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
      try { results.push(...await playLiveCalls(await context.newPage(), { width, height, squads: width === 320 ? 2 : 1, baseURL: process.env.TI_BASE_URL, captureDir: process.env.TI_CAPTURE_DIR })); }
      finally { await context.close(); }
    }
    if (process.env.TI_E2E_REPORT) await writeFile(process.env.TI_E2E_REPORT, JSON.stringify(results, null, 2) + '\n');
    const incidents = results.filter(result => result.kind === 'incident');
    console.log(`Passed ${results.length} live browser journeys at both phone sizes with one and two squads: a locked casebook row, ${incidents.length} board calls discovering ${new Set(incidents.map(result => result.type)).size} frameworks, ${results.filter(result => result.kind === 'standing').length} standing assignments, ${results.filter(result => result.squads > 1).length} two-squad deployments (${results.reduce((total, result) => total + result.boughtRadios, 0)} radios bought on Prepare), ${results.filter(result => result.floors > 1).length} with an upper floor.`);
  } finally { await browser.close(); }
}
