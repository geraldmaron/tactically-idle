import { chromium } from 'playwright-core';
const OUT = process.cwd();
const [w, h] = (process.argv[2] ?? '390x844').split('x').map(Number);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(600);
const S = () => page.evaluate(() => window.__ti.getState());
const before = await S();
const shot = (n) => page.screenshot({ path: `${OUT}/${w}-${n}.png` });
await page.locator('nav').getByText('Ops', { exact: true }).click();
await page.getByRole('button', { name: 'Prepare' }).first().click();
await page.locator('button', { hasText: 'Alpha' }).first().click();
for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'More Radio headset' }).click();
await page.getByRole('button', { name: 'More Throw phone' }).click();
await page.getByRole('button', { name: 'More Ballistic shield' }).click();
await page.getByRole('button', { name: 'Deploy' }).click();
await page.waitForTimeout(400);
const reservedAtDeploy = (await S()).reservations.length;
const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
console.log(`deployed; reservations=${reservedAtDeploy}; scrollW=${m.sw} scrollH=${m.sh} viewport=${w}x${h}`);
await shot('live');
for (let step = 0; step < 8; step++) {
  const st = await S();
  if (!st.activeRun || st.activeRun.status !== 'active') break;
  // pick the first eligible decision button in YOUR CALL
  const names = await page.evaluate(() => [...document.querySelectorAll('.decision, [class*="decision"] button, button')].map((b) => b.textContent.trim()).filter(Boolean));
  const actions = (await page.evaluate(() => {
    const st = window.__ti.getState();
    return st.activeRun.stage;
  }));
  const confirm = page.locator('button', { hasText: /^Confirm/i });
  if (!(await confirm.count())) {
    // open the first decision button
    const btns = page.locator('.call button:not(.call-details)');
    const n = await btns.count();
    for (let i = 0; i < n; i++) { const t = await btns.nth(i).textContent(); if (!/needs|no |blocked|can't|cannot/i.test(t)) { await btns.nth(i).click(); break; } }
    await page.waitForTimeout(300);
  }
  if (!(await confirm.count())) { console.log('no confirm visible at stage', actions, names.slice(-8)); break; }
  const label = (await confirm.first().textContent()).trim();
  const disabled = await confirm.first().isDisabled();
  if (disabled) { console.log('confirm disabled', label); break; }
  await confirm.first().click();
  await page.waitForTimeout(500);
  const after = await S();
  const res = after.activeRun?.history.at(-1);
  console.log(`stage ${actions}: ${label} -> ${res?.actionId} ${res?.band} sample=${res?.sample?.toFixed(3)} | ${res?.explanation?.[0] ?? ''}`);
  await shot(`step${step}`);
}
let st = await S();
console.log('run status', st.activeRun?.status, 'ending', st.activeRun?.endingId);
await shot('debrief');
const debriefText = await page.locator('main').innerText();
console.log('DEBRIEF TEXT:\n' + debriefText.slice(0, 1400));
await page.getByRole('button', { name: /^close/i }).first().click().catch((e) => console.log('close btn missing', e.message));
await page.waitForTimeout(400);
st = await S();
console.log(`after close: activeRun=${st.activeRun} funding ${before.department.funding.toFixed(0)}->${st.department.funding.toFixed(0)} dp ${before.department.devPoints.toFixed(2)}->${st.department.devPoints.toFixed(2)} trust ${before.department.trust}->${st.department.trust} reservations=${st.reservations.length} debriefs=${st.debriefs.length}`);
console.log('officers', Object.values(st.officers).filter(o=>o.squadId==='A').map(o=>`${o.surname} stress ${before.officers[o.id].stress.toFixed(0)}->${o.stress.toFixed(0)} xp ${o.xp} assign=${o.assignment?.kind ?? '-'}`).join('; '));
console.log('inventory', JSON.stringify(Object.fromEntries(Object.entries(st.inventory).map(([k,v])=>[k,`${v.owned}/${v.reserved}r/${v.maintenance}m`]))));
console.log('errors', JSON.stringify(errors));
await browser.close();
