import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Real UI, isolated browser context, no injected game state or stubbed requests. */
export async function playLibrary(page, { baseURL = 'http://127.0.0.1:5174', width = 390, height = 844, squads = 1, captureDir } = {}) {
  await page.clock.setFixedTime(new Date());
  await page.setViewportSize({ width, height });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(baseURL); await page.locator('nav').waitFor();
  const state = () => page.evaluate(() => window.__ti.getState());
  const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow');
  const results = [];
  await page.locator('nav').getByText('Ops', { exact: true }).click();
  const types = await page.getByLabel('Story framework').locator('option').evaluateAll(options => options.map(option => option.value));
  assert.equal(types.length, 14);
  for (const type of types) {
    await page.getByLabel('Story framework').selectOption(type);
    if (type === types[0]) {
      await page.getByRole('button', {name:'New variation',exact:true}).click();
      assert.match(await page.locator('main').innerText(), /Variation 2/);
    }
    await overflow();
    const before = await state();
    await page.getByRole('button', { name:'Practice this scenario', exact:true }).click();
    await page.getByRole('button', { name:/Alpha/ }).click();
    if (squads > 1) await page.getByRole('button', { name:/Bravo/ }).click();
    await page.getByRole('button', { name:'Start practice', exact:true }).click();
    await page.locator('.call-grid').waitFor(); await overflow();
    if (captureDir && ['missing_vulnerable','hostage_crisis'].includes(type)) {
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
        assert.equal(await confirm.isEnabled(), true, `${type}: selected available action must be confirmable`);
        await confirm.click();
      } else if (await page.locator('.operation-continuations button').count()) {
        await page.locator('.operation-continuations button').first().click();
      } else {
        const failed = page.getByRole('button', {name:'Review failed response', exact:true});
        assert.equal(await failed.count(), 1, `${type}: no usable choice or honest failure control`);
        await failed.click();
        await page.getByRole('button', {name:'Confirm failed response', exact:true}).click();
      }
      await page.waitForFunction(previous => {
        const run = window.__ti.getState().activeRun;
        return run?.revision !== previous.revision || run?.stage !== previous.stage || run?.status !== previous.status;
      }, {revision:current.activeRun.revision, stage:current.activeRun.stage, status:current.activeRun.status});
      await overflow();
    }
    const ended = await state(); assert.equal(ended.activeRun?.status, 'debrief', `${type}: bounded ending`);
    const transcript = await page.locator('main').innerText(); assert.match(transcript, /Practice/);
    if (captureDir && type === 'missing_vulnerable') await page.screenshot({path:`${captureDir}/${type}-${width}-debrief.png`});
    await page.getByRole('button', {name:'Close debrief',exact:true}).click();
    await page.getByLabel('Story framework').waitFor();
    const after = await state(); assert.equal(after.activeRun, null);
    assert.deepEqual(after.units, before.units, `${type}: practice must not consume owned equipment`);
    assert.equal(after.department.trust, before.department.trust);
    assert.equal(after.debriefs[0].fundingReward, 0); assert.equal(after.debriefs[0].devPointReward, 0);
    console.log(`Completed ${type} at ${width}px in ${steps} steps: ${ended.activeRun.endingId}`);
    results.push({type,width,height,squads,steps,ending:ended.activeRun.endingId,scenarioId:ended.activeRun.scenarioId});
  }
  assert.deepEqual(errors, [], 'uncaught browser errors');
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const results = [];
  try {
    for (const [width,height] of [[390,844],[320,568]]) {
      const context = await browser.newContext({viewport:{width,height},hasTouch:true});
      try { results.push(...await playLibrary(await context.newPage(), {width,height,squads:width===320?2:1,baseURL:process.env.TI_BASE_URL,captureDir:process.env.TI_CAPTURE_DIR})); }
      finally { await context.close(); }
    }
    if (process.env.TI_E2E_REPORT) await writeFile(process.env.TI_E2E_REPORT, JSON.stringify(results,null,2)+'\n');
    console.log(`Passed ${results.length} real browser journeys across 14 frameworks, both phone sizes, and one/two squads.`);
  } finally { await browser.close(); }
}
