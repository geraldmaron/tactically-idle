import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Real UI, isolated browser context, no injected game state or stubbed requests.
 * Every framework is played once on its first fixed building. With `generated`, each
 * framework that can use generated buildings is also played on one of them, rotating
 * through the types by `rotation` so different phone sizes see different buildings. */
export async function playLibrary(page, { baseURL = 'http://127.0.0.1:5174', width = 390, height = 844, squads = 1, captureDir, generated = true, rotation = 0 } = {}) {
  await page.clock.setFixedTime(new Date());
  await page.setViewportSize({ width, height });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(baseURL); await page.locator('nav').waitFor();
  const state = () => page.evaluate(() => window.__ti.getState());
  const overflow = async (where) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow: ${where}`);
  const results = [];
  await page.locator('nav').getByText('Ops', { exact: true }).click();
  const framework = page.getByLabel('Story framework'), building = page.getByLabel('Building');
  const types = await framework.locator('option').evaluateAll(options => options.map(option => option.value));
  assert.equal(types.length, 14);
  const journeys = types.map(type => ({ type, familyId: null }));
  if (generated) {
    let offset = rotation;
    for (const type of types) {
      await framework.selectOption(type);
      const choices = await building.locator('optgroup[label="Generated layouts"] option').evaluateAll(options => options.map(option => ({ id: option.value, text: option.textContent })));
      if (!choices.length) continue;
      journeys.push({ type, familyId: choices[offset++ % choices.length].id, choices });
    }
    assert.ok(journeys.length > types.length, 'some frameworks offer generated buildings');
  }
  let variationChecked = false, upperChecked = 0;
  for (const { type, familyId } of journeys) {
    const label = familyId ? `${type} on ${familyId}` : type;
    await framework.selectOption(type);
    if (familyId) await building.selectOption(familyId);
    if (!familyId && type === types[0]) {
      await page.getByRole('button', {name:'New variation',exact:true}).click();
      assert.match(await page.locator('main').innerText(), /Variation 2/);
    }
    const card = page.locator('.scenario-library-card');
    const where = await card.locator('.scenario-library-where').innerText();
    if (familyId && !variationChecked) {
      // A new variation of a generated type is a different layout of the same type.
      await page.getByRole('button', {name:'New variation',exact:true}).click();
      assert.match(await card.innerText(), /Variation 2/);
      assert.equal(await card.locator('.scenario-library-where').innerText(), where, `${label}: variation keeps the building type`);
      variationChecked = true;
    }
    assert.match(await card.innerText(), /Situation [1-3] of 3/, `${label}: situations are named by number only`);
    await overflow(`${label} library`);
    const before = await state();
    await page.getByRole('button', { name:'Practice this scenario', exact:true }).click();
    const upperTab = page.getByRole('tab', { name:/^Upper floor/ });
    const floors = await upperTab.count() ? 2 : 1;
    assert.equal(/\b2 floors\b/.test(where), floors === 2, `${label}: library floor chip matches the map (${where})`);
    if (floors === 2) {
      assert.match(await page.locator('.prep-kicker').innerText(), /2\sfloors/, `${label}: preparation names the floors`);
      await upperTab.click();
      assert.equal(await upperTab.getAttribute('aria-selected'), 'true');
      await overflow(`${label} prepare upper floor`);
      await page.getByRole('tab', { name:/^Ground floor/ }).click();
    }
    await page.getByRole('button', { name:/Alpha/ }).click();
    if (squads > 1) await page.getByRole('button', { name:/Bravo/ }).click();
    await page.getByRole('button', { name:'Start practice', exact:true }).click();
    await page.locator('.call-grid').waitFor(); await overflow(`${label} live`);
    const started = await state();
    if (familyId) assert.ok(started.activeRun.locationFamilyId.startsWith(familyId), `${label}: practice runs in the chosen building (${started.activeRun.locationFamilyId})`);
    if (floors === 2) {
      // People and markers upstairs are only drawn on the upper floor; the tab must reach them.
      const tab = page.getByRole('tab', { name:/^Upper floor/ });
      const known = /known (person|people)/.test(await tab.getAttribute('aria-label'));
      await tab.click();
      assert.equal(await tab.getAttribute('aria-selected'), 'true', `${label}: upper floor tab selects`);
      if (known) assert.ok(await page.locator('main [data-silhouette]').count() > 0, `${label}: people upstairs are drawn on the upper floor`);
      await overflow(`${label} live upper floor`);
      if (captureDir) { await mkdir(captureDir, {recursive:true}); await page.screenshot({path:`${captureDir}/${type}-${familyId}-${width}-live-upper.png`}); }
      await page.getByRole('tab', { name:/^Ground floor/ }).click();
      upperChecked++;
    }
    if (captureDir && ['missing_vulnerable','hostage_crisis'].includes(type) && !familyId) {
      await mkdir(captureDir, {recursive:true});
      await page.screenshot({path:`${captureDir}/${type}-${width}-live.png`});
    }
    let steps = 0;
    for (; steps < 60; steps++) {
      const current = await state(); if (current.activeRun?.status !== 'active') break;
      const available = page.locator('.call-grid .callbtn:not(.callbtn-off)');
      if (await available.count()) {
        await available.first().click();
        const confirm = page.getByRole('button', { name:/^Confirm:/ });
        assert.equal(await confirm.isEnabled(), true, `${label}: selected available action must be confirmable`);
        await confirm.click();
      } else if (await page.locator('.operation-continuations button').count()) {
        await page.locator('.operation-continuations button').first().click();
      } else {
        const failed = page.getByRole('button', {name:'Review failed response', exact:true});
        assert.equal(await failed.count(), 1, `${label}: no usable choice or honest failure control`);
        await failed.click();
        await page.getByRole('button', {name:'Confirm failed response', exact:true}).click();
      }
      await page.waitForFunction(previous => {
        const run = window.__ti.getState().activeRun;
        return run?.revision !== previous.revision || run?.stage !== previous.stage || run?.status !== previous.status;
      }, {revision:current.activeRun.revision, stage:current.activeRun.stage, status:current.activeRun.status});
      await overflow(`${label} live step ${steps}`);
    }
    const ended = await state(); assert.equal(ended.activeRun?.status, 'debrief', `${label}: bounded ending`);
    const transcript = await page.locator('main').innerText(); assert.match(transcript, /Practice/);
    await overflow(`${label} debrief`);
    if (captureDir && (type === 'missing_vulnerable' || (familyId && floors === 2 && width === 320))) await page.screenshot({path:`${captureDir}/${type}-${familyId ?? 'fixed'}-${width}-debrief.png`});
    await page.getByRole('button', {name:'Close debrief',exact:true}).click();
    await framework.waitFor();
    const after = await state(); assert.equal(after.activeRun, null);
    assert.deepEqual(after.units, before.units, `${label}: practice must not consume owned equipment`);
    assert.equal(after.department.trust, before.department.trust);
    assert.equal(after.debriefs[0].fundingReward, 0); assert.equal(after.debriefs[0].devPointReward, 0);
    console.log(`Completed ${label} at ${width}px (${floors} floor${floors > 1 ? 's' : ''}, ${squads} squad${squads > 1 ? 's' : ''}) in ${steps} steps: ${ended.activeRun.endingId}`);
    results.push({type,familyId,location:started.activeRun.locationFamilyId,floors,width,height,squads,steps,ending:ended.activeRun.endingId,scenarioId:ended.activeRun.scenarioId});
  }
  if (generated) assert.ok(upperChecked > 0, 'at least one journey used an upper floor');
  assert.deepEqual(errors, [], 'uncaught browser errors');
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const results = [];
  try {
    for (const [index, [width,height]] of [[390,844],[320,568]].entries()) {
      const context = await browser.newContext({viewport:{width,height},hasTouch:true});
      try { results.push(...await playLibrary(await context.newPage(), {width,height,squads:width===320?2:1,rotation:index,baseURL:process.env.TI_BASE_URL,captureDir:process.env.TI_CAPTURE_DIR})); }
      finally { await context.close(); }
    }
    if (process.env.TI_E2E_REPORT) await writeFile(process.env.TI_E2E_REPORT, JSON.stringify(results,null,2)+'\n');
    const generatedRuns = results.filter(result => result.familyId);
    console.log(`Passed ${results.length} real browser journeys across 14 frameworks, both phone sizes, and one/two squads, including ${generatedRuns.length} on ${new Set(generatedRuns.map(result => result.familyId)).size} generated building types (${generatedRuns.filter(result => result.floors > 1).length} with an upper floor).`);
  } finally { await browser.close(); }
}
