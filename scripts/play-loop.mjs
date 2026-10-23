import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FEEL_BUDGETS, FEEL_ON, judgeTaps } from './ui-gates/feel.mjs';
import { serve } from './ui-gates/serve.mjs';

/** Automatic patrol funding on the live HQ surface, then the real hire and boost purchase flows.
 * Proves authoritative accrual, HQ-only bounded motion, navigation reconciliation and reduced motion. */
export async function playPatrolEconomy(page, { baseURL, width = 390, height = 844, captureDir } = {}) {
  const fixed = new Date();
  await page.clock.setFixedTime(fixed);
  await page.setViewportSize({ width, height });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.accept());
  const capture = async (name, target = null, activePage = page) => {
    if (!captureDir) return;
    await mkdir(captureDir, { recursive: true });
    if (target) { await target.scrollIntoViewIfNeeded(); await target.screenshot({ path: `${captureDir}/${name}-${width}.png` }); }
    else await activePage.screenshot({ path: `${captureDir}/${name}-${width}.png` });
  };
  const onboard = async (activePage) => {
    await activePage.goto(baseURL);
    const firstRun = activePage.locator('.first-run');
    await firstRun.waitFor();
    await firstRun.getByRole('button', { name: 'Continue to headquarters', exact: true }).click();
    await activePage.locator('.hq-patrol').waitFor();
  };
  const state = async (activePage) => activePage.evaluate(() => window.__ti.getState());
  const walletMatches = async (activePage) => activePage.waitForFunction(() => {
    const wallet = Number((document.querySelector('.stat-cash-value')?.textContent ?? '').replace(/[^\d-]/g, ''));
    const actual = Math.round(window.__ti.getState().department.funding);
    return Number.isFinite(wallet) && Math.abs(wallet - actual) <= 1;
  });
  await onboard(page);

  const initial = await state(page);
  assert.equal(initial.patrol.personnel.filter(person => person.dismissedAt === null).length, 4, 'a new department starts with four patrol employees');
  assert.equal(await page.locator('.hq-patrol-rate strong').innerText(), '+$620/h', 'the starting department net is preserved');
  assert.equal(await page.locator('.tap-earn-target').count(), 0, 'paid-detail tapping is absent');
  await capture('patrol-hq-initial', page.locator('.hq-patrol'));

  const before = initial.department.funding;
  await page.clock.setFixedTime(new Date(fixed.getTime() + 60 * 60_000));
  await page.waitForFunction(initialFunding => window.__ti.getState().department.funding >= initialFunding + 620, before, { timeout: 8000 });
  // Patrol income settles without a cash flight (owner, 2026-10-23); the balance must still match.
  assert.equal(await page.locator('.funding-flight-layer .cash-sprite').count(), 0, 'patrol settlement draws no flying cash');
  assert.equal(Math.round((await state(page)).department.funding - before), 620, 'one hour credits the authoritative starting net');
  await walletMatches(page);

  // The canonical Team flow hires a fifth employee and exposes the now-positive Store boost.
  await page.locator('nav').getByRole('button', { name: 'Team', exact: true }).click();
  await page.getByRole('button', { name: 'Patrol', exact: true }).click();
  await page.getByRole('button', { name: 'Hire patrol', exact: true }).click();
  await page.locator('.patrol-candidates').getByRole('button', { name: /Review hire/ }).first().click();
  await page.getByRole('button', { name: /Confirm hire/ }).click();
  await page.locator('.patrol-receipt').waitFor();
  assert.equal((await state(page)).patrol.personnel.filter(person => person.dismissedAt === null).length, 5, 'the hire receipt leaves five employed patrol staff');
  await capture('patrol-hire-receipt', page.locator('.patrol-receipt'));
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('nav').getByRole('button', { name: 'Store', exact: true }).click();
  await page.getByRole('button', { name: 'Boosts', exact: true }).click();
  const grant = page.getByRole('button', { name: 'Review grant', exact: true });
  assert.equal(await grant.isEnabled(), true, 'five productive staff make the four-hour grant return more than its price');
  await grant.click();
  await page.getByRole('button', { name: /Activate grant/ }).click();
  await page.locator('.patrol-receipt').waitFor();
  assert.equal((await state(page)).patrol.boosts.length, 1, 'the Store purchase activates one patrol boost');
  await capture('patrol-boost-receipt', page.locator('.patrol-receipt'));
  assert.deepEqual(errors, [], 'uncaught errors during patrol economy flow');

  // A second, fresh context tests reduced motion without changing the normal-motion walk above.
  const browser = page.context().browser();
  assert.ok(browser, 'the paid-details page belongs to a launched browser');
  const reducedContext = await browser.newContext({ viewport: { width, height }, hasTouch: true });
  const reducedErrors = [];
  try {
    const reducedPage = await reducedContext.newPage();
    await reducedPage.emulateMedia({ reducedMotion: 'reduce' });
    await reducedPage.clock.setFixedTime(fixed);
    reducedPage.on('pageerror', error => reducedErrors.push(String(error)));
    await onboard(reducedPage);
    const reducedBefore = (await state(reducedPage)).department.funding;
    await reducedPage.clock.setFixedTime(new Date(fixed.getTime() + 60 * 60_000));
    await reducedPage.waitForFunction(initialFunding => window.__ti.getState().department.funding >= initialFunding + 620, reducedBefore, { timeout: 8000 });
    const reducedSprites = reducedPage.locator('.cash-sprite');
    assert.equal(await reducedSprites.count(), 0, 'reduced motion skips cash particles');
    assert.equal(Math.round((await state(reducedPage)).department.funding - reducedBefore), 620, 'reduced motion preserves authoritative patrol accrual');
    await walletMatches(reducedPage);
    await capture('patrol-reduced-motion', null, reducedPage);
    assert.deepEqual(reducedErrors, [], 'uncaught errors with reduced motion');
  } finally { await reducedContext.close(); }

  return { width, height, initialNet: 620, hired: 1, boost: 'community-grant', reducedMotion: true };
}

/** Real UI, isolated browser context, no injected game state or stubbed requests.
 * A fresh department opens the Ops board and:
 * 1. checks the casebook shows a locked framework as its requirement, with no call content;
 * 2. takes every starting board call live (each a "New kind of call"), which discovers its recipe
 *    in the casebook and earns department service;
 * 3. checks the emptied board offers no standing assignments, only the wait for the next call-out.
 * Each call sends as many ready squads as its Prepare screen says it takes, so a call that takes
 * two sends two; radios a squad lacks are bought through the Prepare screen's own purchase
 * button, never injected. */
export async function playLiveCalls(page, { baseURL, width = 390, height = 844, captureDir } = {}) {
  await page.clock.setFixedTime(new Date());
  await page.setViewportSize({ width, height });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(baseURL);
  const state = () => page.evaluate(() => window.__ti.getState());
  const overflow = async (where) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow: ${where}`);
  const capture = async (name, locator) => {
    if (!captureDir) return;
    await mkdir(captureDir, { recursive: true });
    if (locator) { await locator.scrollIntoViewIfNeeded(); await locator.screenshot({ path: `${captureDir}/${name}-${width}.png` }); }
    else await page.screenshot({ path: `${captureDir}/${name}-${width}.png` });
  };
  // A fresh browser opens on the launch advisory; the player keeps the default settings and continues.
  const firstRun = page.locator('.first-run');
  await firstRun.waitFor();
  assert.match(await firstRun.innerText(), /We don.t check your age/);
  await overflow('launch advisory');
  await capture('first-run');
  const proceed = firstRun.getByRole('button', { name: 'Continue to headquarters', exact: true });
  assert.equal(await proceed.isEnabled(), true, 'the advisory has one Continue button');
  await proceed.click();
  await page.locator('nav').waitFor();
  const results = [];
  // The calls tab: its accessible name contains "Calls" (the desk's four tabs; "Ops" before them).
  const callsTab = page.locator('nav').getByRole('button', { name: /Calls|Ops/ }).first();
  await callsTab.click();
  const casebook = page.locator('.casebook-card');
  await casebook.waitFor();
  const row = (type) => casebook.locator(`.casebook-row[data-type="${type}"]`);
  // Every operation on the board is live: no daily featured card and no launcher in the casebook.
  assert.equal(await page.locator('.featured-card, .casebook-row button').count(), 0, 'the Ops board offers live operations only');

  // 1. A locked framework shows the requirement, never the content. Only the hostage call is live
  // since the other three were retired (da5c109), so a fresh department may have none locked.
  const locked = casebook.locator('.casebook-row[data-status="locked"]');
  if (await locked.count() > 0) {
    const lockedText = await locked.first().innerText();
    assert.match(lockedText, /Not yet dispatched to your department/);
    assert.match(lockedText, /Department level \d|An officer certified in \w|in stock$/m);
    assert.equal(await locked.first().locator('h3, button').count(), 0, 'locked rows carry no call content');
  }
  // Protected rescue, while it is in the casebook, waits for a vehicle-trained officer.
  if (await row('protected_rescue').count()) {
    const rescue = await row('protected_rescue').innerText();
    assert.match(rescue, /An officer certified in \w/);
    assert.doesNotMatch(rescue, /Department level/);
  }
  const before0 = await state();
  assert.equal(Object.keys(before0.casebook?.recipes ?? {}).length, 0, 'nothing discovered yet');
  for (const unfound of await casebook.locator('.casebook-row[data-status="unfound"]').all()) {
    assert.match(await unfound.innerText(), /Not taken yet · \d situations? to find/);
    assert.equal(await unfound.locator('h3, button').count(), 0, 'undiscovered rows show counts only');
  }
  await overflow('casebook with locked row');
  if (await locked.count() > 0) await capture('casebook-locked', locked.first());

  // Open the call -> brief -> Choose team -> Deploy -> choices until the debrief -> Done.
  const play = async (label, { stepOut = false } = {}) => {
    const before = await state();
    await page.locator('.cl-flow-body[data-step="brief"]').waitFor();
    // The brief leads with the orders; the map is one tap away, in the head.
    assert.equal(await page.locator('.cl-flow-body .pb-orders-panel').count(), 1, `${label}: the brief opens on the orders`);
    assert.equal(await page.locator('.prepare .toggle input[type="checkbox"]').count(), 0, `${label}: preparation has no mode switch`);
    await page.locator('.flow-head').getByRole('button', { name: 'Map', exact: true }).click();
    const upperTab = page.locator('.cl-map-sheet').getByRole('tab', { name: /^Upper floor/ });
    await page.locator('.cl-map-sheet').waitFor();
    const floors = await upperTab.count() ? 2 : 1;
    if (floors === 2) {
      await upperTab.click();
      assert.equal(await upperTab.getAttribute('aria-selected'), 'true');
      await overflow(`${label} brief map upper floor`);
      await page.locator('.cl-map-sheet').getByRole('tab', { name: /^Ground floor/ }).click();
    }
    await page.keyboard.press('Escape');
    if (await page.locator('.cl-map-sheet').count()) await page.locator('.cl-map-sheet').getByRole('button', { name: /close/i }).first().click();
    // Choose team, then Back keeps the draft: the step and the squads survive the head's Back and Forward.
    await page.getByRole('button', { name: 'Choose team', exact: true }).click();
    await page.locator('.cl-flow-body[data-step="deploy"]').waitFor();
    // The squad range is read from the screen, as the player reads it: "Takes 1 squad" or "Takes 1 to 2 squads".
    const takes = (await page.locator('.cl-section-aside').first().innerText()).match(/Takes (\d+)(?: to (\d+))?/);
    const range = { min: Number(takes[1]), max: Number(takes[2] ?? takes[1]) };
    // A squad deploys with the officers who are fit and the rest stay home (short-squad-deploys), so
    // any card not marked "not deployable" will do; the squads with the most officers ready go first,
    // as a player would after an injury ("Squad B, Bravo, 3 of 4 ready").
    const cards = await page.locator('.cl-squads button.cl-squad').evaluateAll(buttons => buttons.map((button, index) => ({ index, label: button.getAttribute('aria-label') ?? '' })));
    const readyOf = card => Number(/, (\d+) of \d+ ready/.exec(card.label)?.[1] ?? 0);
    const fit = cards.filter(card => readyOf(card) >= 1 && !card.label.includes('not deployable')).sort((x, y) => readyOf(y) - readyOf(x));
    const pick = Math.min(range.max, fit.length);
    assert.ok(pick >= range.min, `${label}: ${range.min} squad${range.min > 1 ? 's' : ''} able to deploy; the cards read ${cards.map(card => `"${card.label}"`).join(', ')}`);
    // Deploy preselects the best-fit ready squad, so tap only the cards whose state differs from the pick.
    const want = new Set(fit.slice(0, pick).map(card => card.index));
    const pressed = await page.locator('.cl-squads button.cl-squad').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-pressed') === 'true'));
    for (const [index, on] of pressed.entries()) if (on !== want.has(index)) await page.locator('.cl-squads button.cl-squad').nth(index).click();
    assert.equal(await page.locator('.cl-squads button[aria-pressed="true"]').count(), pick, `${label}: ${pick} squad${pick > 1 ? 's' : ''} chosen`);
    // Back to the brief and Forward again: the chosen squads are still chosen (the exit table).
    await page.locator('.flow-back').click();
    await page.locator('.cl-flow-body[data-step="brief"]').waitFor();
    await page.goForward();
    await page.locator('.cl-flow-body[data-step="deploy"]').waitFor();
    assert.equal(await page.locator('.cl-squads button[aria-pressed="true"]').count(), pick, `${label}: the draft survives Back and Forward`);
    // Each chosen squad's kit is a summary with Adjust; Deploy names the squads by name. Every officer
    // carries basic kit; pooled gear comes from Adjust, here through Auto-equip as a player would.
    assert.equal(await page.locator('.cl-squad-plan').count(), pick, `${label}: a kit summary per chosen squad`);
    await page.locator('.cl-squad-plan .cl-link', { hasText: 'Adjust' }).first().click();
    await page.locator('.cl-kit-workspace').getByRole('button', { name: /^Auto-equip / }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('.cl-kit-workspace').waitFor({ state: 'detached' });
    const carried = await page.locator('.cl-kit-on, .cl-kit-warn').count();
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
    const deploy = page.getByRole('button', { name: /^Deploy [A-Z]/ });
    // Wait for the screen to settle before judging Deploy (a slow render under load is not a refusal),
    // and when it stays off, say what the Prepare screen says.
    let enabled = false;
    for (const until = Date.now() + 5000; !(enabled = await deploy.isEnabled()) && Date.now() < until;) await page.waitForTimeout(100);
    assert.equal(enabled, true, `${label}: the chosen squads can deploy; the screen says: ${(await page.locator('.prepcheck .note-warn').allInnerTexts()).join(' | ') || 'nothing'}`);
    await deploy.click();
    await page.locator('.call-grid').waitFor(); await overflow(`${label} live`);
    const started = await state();
    assert.equal(started.activeRun.reservationIds.length > 0, carried > 0, `${label}: a live run reserves the pooled gear its kit summary showed`);
    const used = started.activeRun.squadIds.length;
    if (stepOut) {
      // Step out leaves the call without cancelling it: the decision pauses and only the call resumes it.
      await page.getByRole('button', { name: 'Step out', exact: true }).click();
      await page.waitForFunction(() => window.__ti.getState().activeRun?.decisionPausedAt !== undefined);
      assert.equal(await page.locator('.live').count(), 0, `${label}: Step out leaves the call`);
      assert.equal((await state()).activeRun?.status, 'active', `${label}: Step out never cancels`);
      await callsTab.click();
      await page.locator('.call-grid').waitFor();
      await page.waitForFunction(() => window.__ti.getState().activeRun?.decisionPausedAt === undefined);
    }
    if (floors === 2) {
      // People and markers upstairs are only drawn on the upper floor; the tab must reach them.
      // The map sits on the one-screen live call, above the story.
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
      // After a confirm the result has its own beat; Continue reveals the next decision.
      const proceed = page.locator('.live-continue button');
      if (await proceed.count()) {
        await proceed.click();
        await page.locator('.call-grid').waitFor();
        continue;
      }
      if (await available.count()) {
        // A weighed choice opens for reading when its text is tapped; its own Review button selects it.
        const card = available.first(), review = card.locator('.callbtn-review');
        await (await review.count() ? review : card).click();
        const confirm = page.getByRole('button', { name: /^Confirm / });
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
    assert.equal(await page.locator('.flow-title').innerText(), 'Debrief', `${label}: the debrief is a live result`);
    assert.equal(await page.locator('button.flow-back').count(), 0, `${label}: the debrief has no Back`);
    assert.equal(await page.locator('nav.bottomnav').count(), 0, `${label}: a flow hides the tabs`);
    assert.equal(await page.locator('.result-rewards').count(), 1, `${label}: the debrief lists its rewards`);
    await overflow(`${label} debrief`);
    await page.getByRole('button', { name: 'Next call', exact: true }).click();
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

  // 2. Take every starting call live. The first of each framework carries the badge; dispatching it
  // discovers its recipe in the casebook. The first call taken also steps out and back.
  const discovered = [];
  let taken = 0;
  const start = await state();
  for (const card of [...start.incidents]) {
    const now = await state();
    const index = now.incidents.filter(c => c.expiresAt > Date.now()).findIndex(c => c.id === card.id);
    if (index < 0) continue;
    const first = !discovered.includes(card.type);
    const view = page.locator('.cl-card').nth(index);
    // A new kind of call says so on its card, and only then.
    if (card.newKind) assert.match(await view.innerText(), /New kind of call/, `${card.type}: board card shows the badge`);
    else assert.doesNotMatch(await view.innerText(), /New kind of call/, `${card.type}: only the new kind carries the badge`);
    if (taken === 0) await capture('board-new-kind', view);
    // The page clock is fixed, so the welcome-back sheet stays armed and opens on the first shift
    // report; a player reads it and taps Continue.
    const welcome = page.locator('.welcome-sheet');
    if (await welcome.count()) await welcome.getByRole('button', { name: 'Continue', exact: true }).click();
    await view.locator('.cl-card-button').click();
    const { after, result } = await play(`${card.type} live`, { stepOut: taken++ === 0 });
    Object.assign(result, { type: card.type, kind: 'incident' });
    const keys = Object.keys(after.casebook.recipes).filter(key => key.startsWith(`${card.type}/`));
    assert.ok(first ? keys.length === 1 : keys.length >= 1, `${card.type}: dispatch discovered its recipe`);
    const found = await row(card.type).innerText();
    const [, got, all] = found.match(/(\d+) of (\d+)/) ?? [];
    assert.ok(Number(got) >= 1 && Number(got) <= Number(all), `${card.type}: casebook counts the situations found`);
    assert.match(found, /Best: /);
    if (Number(got) < Number(all)) assert.match(found, /\d more situations? to find/);
    assert.equal(await row(card.type).locator('button').count(), 0, `${card.type}: the casebook is a record, not a launcher`);
    if (first) discovered.push(card.type);
    await overflow(`${card.type} casebook after discovery`);
  }
  assert.ok(discovered.length > 0, 'at least one starting call was taken live');
  for (const type of discovered) assert.equal(start.incidents.filter(c => c.type === type && c.newKind).length, 1, `${type}: one starting call is marked a new kind`);
  await capture('casebook-found', row(discovered[0]));
  await capture('casebook', casebook);

  // 3. With the incidents taken the board is empty: no standing assignments, only the next arrival.
  assert.match(await page.locator('.cl-board-count').innerText(), /No calls waiting/);
  assert.equal(await page.getByText('Standing assignments').count(), 0, 'the board has no standing assignments');
  assert.equal(await page.locator('.cl-card-button').count(), 0, 'nothing left to open');
  await overflow('empty board');
  await page.evaluate(() => scrollTo(0, 0));
  await capture('board-empty');

  assert.deepEqual(errors, [], 'uncaught browser errors');
  return results;
}

/** Tap budget (F6.taps, scripts/ui-gates/feel.mjs). Counts the real taps a player makes on two fixed paths:
 *   board -> first live decision   start: Calls tab with a card open to tap, welcome sheet dismissed
 *                                  end:   a choice is on screen in `.call-grid`
 *   debrief -> board               start: the Debrief with its Done button
 *                                  end:   the Calls board is back (`.cl-board-count`)
 * A tap is any trusted click, recorded in the page, so a Deploy that needs a squad picked first costs the
 * extra tap. Squad picks and radio purchases are made as a player would, only when the screen needs them.
 * Returns { boardToDecision, debriefToBoard } as lists of the taps made. */
export async function measureTapBudget(page, { baseURL, width = 390, height = 844 } = {}) {
  await page.clock.setFixedTime(new Date());
  await page.setViewportSize({ width, height });
  page.on('dialog', dialog => dialog.accept());
  await page.addInitScript(() => {
    window.__taps = [];
    document.addEventListener('click', event => {
      if (!event.isTrusted) return;
      const target = event.target instanceof Element ? event.target.closest('button, a, [role="button"], [role="tab"], label, summary') ?? event.target : null;
      window.__taps.push(((target?.getAttribute('aria-label') ?? target?.textContent ?? '').replace(/\s+/g, ' ').trim() || target?.tagName || 'tap').slice(0, 32));
    }, true);
  });
  const taps = () => page.evaluate(() => window.__taps.slice());
  const reset = () => page.evaluate(() => { window.__taps = []; });
  await page.goto(baseURL);
  await page.locator('.first-run').waitFor();
  await page.getByRole('button', { name: 'Continue to headquarters', exact: true }).click();
  await page.locator('nav').getByRole('button', { name: /Calls|Ops/ }).first().click();
  await page.locator('.cl-card-button').first().waitFor();
  const welcome = page.locator('.welcome-sheet');
  if (await welcome.count()) await welcome.getByRole('button', { name: 'Continue', exact: true }).click();
  await reset();
  await page.locator('.cl-card-button').first().click();
  for (let n = 0; n < 12 && !(await page.locator('.call-grid .callbtn').count()); n++) {
    const choose = page.getByRole('button', { name: 'Choose team', exact: true });
    if (await choose.count()) { await choose.click(); continue; }
    const deploy = page.getByRole('button', { name: /^Deploy [A-Z]/ });
    if (await deploy.count() && await deploy.isEnabled()) { await deploy.click(); await page.locator('.call-grid').waitFor(); break; }
    if (await page.locator('.cl-squads button[aria-pressed="true"]').count() === 0) { await page.locator('.cl-squads button.cl-squad:not([aria-label*="not deployable"]):not([aria-label*=" 0 of "])').first().click(); continue; }
    const buy = page.getByRole('button', { name: /^Buy \d+ radios? · / });
    if (await buy.count()) { await buy.first().click(); await page.waitForTimeout(400); continue; }
    await page.waitForTimeout(150);
  }
  await page.locator('.call-grid .callbtn').first().waitFor({ timeout: 8000 });
  const boardToDecision = await taps();
  for (let n = 0; n < 60 && (await page.evaluate(() => window.__ti.getState().activeRun?.status)) === 'active'; n++) {
    const proceed = page.locator('.live-continue button');
    if (await proceed.count()) { await proceed.click(); await page.locator('.call-grid').waitFor(); continue; }
    const card = page.locator('.call-grid .callbtn:not(.callbtn-off)').first();
    if (await card.count()) { const review = card.locator('.callbtn-review'); await (await review.count() ? review : card).click(); await page.getByRole('button', { name: /^Confirm / }).click(); await page.waitForTimeout(250); continue; }
    const cont = page.locator('.operation-continuations button'); if (await cont.count()) { await cont.first().click(); continue; }
    break;
  }
  const done = page.getByRole('button', { name: 'Next call', exact: true });
  await done.waitFor({ timeout: 8000 });
  await reset();
  await done.click();
  await page.locator('.cl-board-count').waitFor({ timeout: 8000 });
  return { boardToDecision, debriefToBoard: await taps() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const results = [];
  // With no URL it starts this worktree's own dev server on a free port (scripts/ui-gates/serve.mjs). A URL
  // (first argument, then TI_BASE_URL) is reused only if it serves this worktree's code byte for byte.
  const server = await serve({ root: fileURLToPath(new URL('..', import.meta.url)), given: process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? process.env.TI_BASE_URL });
  const baseURL = server.url;
  try {
    // `--taps` runs only the tap budget. It reports always, and exits 1 only when F6.taps is switched on
    // in FEEL_ON.path (scripts/ui-gates/feel.mjs) or `--enforce` is given.
    if (process.argv.includes('--taps')) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      try {
        const { boardToDecision, debriefToBoard } = await measureTapBudget(await context.newPage(), { baseURL });
        console.log(`board -> first live decision: ${boardToDecision.length} taps (budget ${FEEL_BUDGETS.tapsBoardToDecision}): ${boardToDecision.join(' > ')}`);
        console.log(`debrief -> board: ${debriefToBoard.length} taps (budget ${FEEL_BUDGETS.tapsDebriefToBoard}): ${debriefToBoard.join(' > ')}`);
        const over = [...judgeTaps('board-to-decision', boardToDecision), ...judgeTaps('debrief-to-board', debriefToBoard)];
        for (const f of over) console.error(`F6.taps ${f.id}: ${f.detail}`);
        if (over.length && (process.argv.includes('--enforce') || FEEL_ON.path.includes('F6.taps'))) { await context.close(); await browser.close(); server.stop(); process.exit(1); }
      } finally { await context.close(); await browser.close(); server.stop(); }
      process.exit(0);
    }
    const paidContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    try {
      const patrol = await playPatrolEconomy(await paidContext.newPage(), { width: 390, height: 844, baseURL, captureDir: process.env.TI_CAPTURE_DIR });
      console.log(`Passed patrol economy at ${patrol.width}x${patrol.height}: $${patrol.initialNet}/h initial net, ${patrol.hired} hire, ${patrol.boost} activated, HQ-only motion and reduced motion honored.`);
    } finally { await paidContext.close(); }
    for (const [width, height] of [[390, 844], [320, 568]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
      try { results.push(...await playLiveCalls(await context.newPage(), { width, height, baseURL, captureDir: process.env.TI_CAPTURE_DIR })); }
      finally { await context.close(); }
    }
    if (process.env.TI_E2E_REPORT) await writeFile(process.env.TI_E2E_REPORT, JSON.stringify(results, null, 2) + '\n');
    console.log(`Passed ${results.length} live board calls at 390x844 and 320x568: ${new Set(results.map(result => result.type)).size} frameworks discovered, ${results.filter(result => result.squads > 1).length} two-squad deployments (${results.reduce((total, result) => total + result.boughtRadios, 0)} radios bought on Prepare), ${results.filter(result => result.floors > 1).length} with an upper floor, then an empty board.`);
  } finally { await browser.close(); server.stop(); }
}
