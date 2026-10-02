import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5173/');
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(600);
const S = () => page.evaluate(() => window.__ti.getState());
await page.locator('nav').getByText('Ops', { exact: true }).click();
await page.getByRole('button', { name: 'Prepare' }).nth(1).click(); // OP 0142 urgent
await page.locator('button', { hasText: 'Alpha' }).first().click();
await page.locator('button', { hasText: 'Bravo' }).first().click();
// Bravo starts at east side
const east = page.locator('button', { hasText: 'East side' });
console.log('east side buttons', await east.count());
if (await east.count() > 1) await east.nth(1).click();
const more = (name, i = 0) => page.getByRole('button', { name }).nth(i).click();
await more('More Radio headset', 0); await more('More Radio headset', 1);
await more('More Trauma kit', 0); await more('More Door ram', 1);
const prepText = await page.locator('main').innerText();
console.log('prep notes:', prepText.slice(prepText.indexOf('MODE')).replace(/\n+/g,' | ').slice(0,400));
await page.getByRole('button', { name: 'Deploy' }).click(); await page.waitForTimeout(500);
const st = await S();
console.log('run squads', st.activeRun?.squadIds, 'tasks', JSON.stringify(st.activeRun?.squadTasks));
const dims = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, main: document.querySelector('main').scrollHeight }));
console.log('320 dims', JSON.stringify(dims));
await page.screenshot({ path: '320-live.png' });
await page.locator('.call').scrollIntoViewIfNeeded();
await page.screenshot({ path: '320-call.png' });
const small = await page.evaluate(() => [...document.querySelectorAll('button,[role=button]')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); }).map(b => `${(b.getAttribute('aria-label') || b.textContent).trim().slice(0,24)} ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`));
console.log('targets under 44px:', JSON.stringify(small));
// advance through urgent stages with the second-squad support check
for (let i = 0; i < 6; i++) {
  const s = await S(); if (s.activeRun?.status !== 'active') break;
  const views = await page.evaluate(() => [...document.querySelectorAll('.call button:not(.call-details)')].map(b => b.innerText.replace(/\n/g,' / ')));
  console.log(`[${s.activeRun.stage}] options:`, JSON.stringify(views));
  const btns = page.locator('.call button:not(.call-details)');
  await btns.first().click(); await page.waitForTimeout(250);
  const confirm = page.locator('button', { hasText: /^Confirm/i }).first();
  if (await confirm.isDisabled()) { await btns.nth(1).click(); await page.waitForTimeout(250); }
  const label = await confirm.textContent();
  await confirm.click(); await page.waitForTimeout(300);
  const r = (await S()).activeRun.history.at(-1);
  console.log(`  -> ${label.trim()} : ${r.actionId} ${r.band}; acting ${r.actingSquadIds} support ${r.supportSquadIds}; officers ${r.officerIds.length}`);
}
const end = await S();
console.log('end', end.activeRun?.status, end.activeRun?.endingId, 'civ', end.activeRun?.civilianSafety, 'pressure', end.activeRun?.pressure, 'clock', end.activeRun?.clock);
console.log('errors', JSON.stringify(errors));
await browser.close();
