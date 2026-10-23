// Negative controls for the feel rules, in the shape of controls.mjs: for each rule a page this file owns
// that must trip it and a sibling that must not. `npm run check:feel` runs them first, so a probe that has
// gone blind fails before it is allowed to say a screen is fine.
import { feelProbe, judgeChrome, judgeDensity, judgeEssential, judgePlates, judgePrimary, judgeShift, judgeTaps } from './feel.mjs';

const BASE = '<style>*{box-sizing:border-box}body{margin:0;background:#101820;color:#e8eef5;font:14px/1.3 system-ui}</style>';
const app = (inner, css = '') => `${BASE}<style>${css}</style><div class="app">${inner}</div>`;
const CLAMP = '-webkit-line-clamp:2;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden';
const HOOK = 'A courier is holding the lobby and the only door he trusts is the one he is standing in front of.';
const card = (n, { clamp = false, warn = true } = {}) => `<article class="cl-card" data-call-id="c${n}" style="height:120px;margin:0 0 8px;border:1px solid #567"><p class="cl-card-hook" style="margin:0;width:200px;${clamp ? CLAMP : ''}">${HOOK}</p>${warn ? `<p class="cl-card-warning" role="note">Involves a child in danger.</p>` : ''}</article>`;
const choice = (n, { harm = true, odds = true, clampHarm = false } = {}) => `<button class="callbtn" data-action-id="a${n}" style="display:block;width:300px;margin:4px"><span class="callbtn-title">Take the door</span><span class="callbtn-forecast">${odds ? '<span class="odds-bar" style="display:block;height:6px;background:#3a6"></span>' : ''}<span class="callbtn-forecast-text">${odds ? '<span>62% goes well</span>' : ''}${harm ? `<span class="callbtn-harm" style="${clampHarm ? 'display:block;width:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' : ''}">Harm medium</span>` : ''}</span></span></button>`;
const plate = (css, img = '') => `<div class="plate" style="width:300px;height:80px;${css}">${img}</div>`;

const run = (screen, extra = {}) => ({ screen, inset: { top: 0, bottom: 0 }, ...extra });
const primaryScreen = { primary: [{ css: '#go' }] };

/** { rule, bad, name, html, cfg, judge: (raw) => findings }: `bad` pages must yield a finding for `rule`, good ones none. */
export const FEEL_CONTROLS = [
  { rule: 'F1.primary', bad: true, name: 'a primary button below the first viewport', html: app('<div style="height:900px"></div><button id="go" style="height:48px">Go</button>'), cfg: run(primaryScreen), judge: (r) => judgePrimary(r.primary) },
  { rule: 'F1.primary', bad: true, name: 'a primary button half under a pinned bar', html: app('<button id="go" style="margin-top:700px;height:48px;width:200px">Go</button><div style="position:fixed;left:0;right:0;top:720px;height:60px;background:#222"></div>'), cfg: run(primaryScreen), judge: (r) => judgePrimary(r.primary) },
  { rule: 'F1.primary', bad: true, name: 'a disabled primary button', html: app('<button id="go" disabled style="height:48px">Go</button>'), cfg: run(primaryScreen), judge: (r) => judgePrimary(r.primary) },
  { rule: 'F1.primary', bad: true, name: 'a choices-below affordance that is itself off screen', html: app('<div style="height:900px"></div><button id="go" data-choices-below style="height:48px">Choices below</button>'), cfg: run({ primary: [{ css: '[data-choices-below]' }] }), judge: (r) => judgePrimary(r.primary) },
  { rule: 'F1.primary', bad: false, name: 'a visible, enabled, unobscured primary button', html: app('<button id="go" style="height:48px;width:200px">Go</button>'), cfg: run(primaryScreen), judge: (r) => judgePrimary(r.primary) },
  { rule: 'F1.primary', bad: false, name: 'a data-primary element is preferred to the configured selector', html: app('<button id="go" disabled>Old</button><button data-primary style="height:48px">New</button>'), cfg: run(primaryScreen), judge: (r) => judgePrimary(r.primary) },

  { rule: 'F2.essential', bad: true, name: 'a card hook cut by a two-line clamp', html: app(card(1, { clamp: true })), cfg: run({ essential: 'cards' }), judge: judgeEssential },
  { rule: 'F2.essential', bad: true, name: 'a card with no hook', html: app('<article class="cl-card" data-call-id="c1" style="height:60px"></article>'), cfg: run({ essential: 'cards' }), judge: judgeEssential },
  { rule: 'F2.essential', bad: true, name: 'a board where no card shows its warning with warnings on', html: app(card(1, { warn: false }) + card(2, { warn: false })), cfg: run({ essential: 'cards' }), judge: judgeEssential },
  { rule: 'F2.essential', bad: true, name: 'a choice with no harm line', html: app(choice(1, { harm: false }), '.call-grid{}').replace('class="app"', 'class="app call-grid"'), cfg: run({ essential: 'choices' }), judge: judgeEssential },
  { rule: 'F2.essential', bad: true, name: 'a choice whose harm is cut by an ellipsis', html: app(choice(1, { clampHarm: true })).replace('class="app"', 'class="app call-grid"'), cfg: run({ essential: 'choices' }), judge: judgeEssential },
  { rule: 'F2.essential', bad: true, name: 'a choice with no odds', html: app(choice(1, { odds: false })).replace('class="app"', 'class="app call-grid"'), cfg: run({ essential: 'choices' }), judge: judgeEssential },
  { rule: 'F2.essential', bad: false, name: 'whole hook, warning, odds and harm', html: app(card(1) + choice(1)).replace('class="app"', 'class="app call-grid"'), cfg: run({ essential: 'cards' }), judge: judgeEssential },
  { rule: 'F2.essential', bad: false, name: 'a complete choice', html: app(choice(1)).replace('class="app"', 'class="app call-grid"'), cfg: run({ essential: 'choices' }), judge: judgeEssential },

  { rule: 'F3.chrome', bad: true, name: 'a 70px top bar over a 60px nav (130px)', html: app('<header class="topbar" style="position:sticky;top:0;height:70px"></header><nav class="bottomnav" style="position:fixed;bottom:0;left:0;right:0;height:60px"></nav>'), cfg: run({}), judge: (r) => judgeChrome(r.chrome) },
  { rule: 'F3.chrome', bad: true, name: 'bars of 120px and 80px under a 47px/34px inset, over 108+81', html: app('<header class="topbar" style="position:sticky;top:0;height:120px"></header><nav class="bottomnav" style="position:fixed;bottom:0;left:0;right:0;height:80px"></nav>'), cfg: run({}, { inset: { top: 47, bottom: 34 } }), judge: (r) => judgeChrome(r.chrome) },
  { rule: 'F3.chrome', bad: false, name: 'a 56px top bar over a 52px nav (108px)', html: app('<header class="topbar" style="position:sticky;top:0;height:56px"></header><nav class="bottomnav" style="position:fixed;bottom:0;left:0;right:0;height:52px"></nav>'), cfg: run({}), judge: (r) => judgeChrome(r.chrome) },
  { rule: 'F3.chrome', bad: false, name: 'the same bars padded by the safe-area insets', html: app('<header class="topbar" style="position:sticky;top:0;height:103px"></header><nav class="bottomnav" style="position:fixed;bottom:0;left:0;right:0;height:86px"></nav>'), cfg: run({}, { inset: { top: 47, bottom: 34 } }), judge: (r) => judgeChrome(r.chrome) },

  { rule: 'F4.density', bad: true, name: 'two board cards, only one in the first viewport', html: app(`<div style="height:300px"></div>${card(1).replace('height:120px', 'height:500px')}${card(2)}`), cfg: run({ density: { css: '.cl-card', rule: 'cards', label: 'board cards' } }), judge: (r) => judgeDensity(r.density) },
  { rule: 'F4.density', bad: false, name: 'two compact board cards in the first viewport', html: app(card(1) + card(2)), cfg: run({ density: { css: '.cl-card', rule: 'cards', label: 'board cards' } }), judge: (r) => judgeDensity(r.density) },
  { rule: 'F4.density', bad: false, name: 'one card only: density is judged only when items exist', html: app(card(1).replace('height:120px', 'height:700px')), cfg: run({ density: { css: '.cl-card', rule: 'cards', label: 'board cards' } }), judge: (r) => judgeDensity(r.density) },
  { rule: 'F4.density', bad: false, name: 'at 200% text the density floor is skipped', html: app(`<div style="height:300px"></div>${card(1).replace('height:120px', 'height:500px')}${card(2)}`), cfg: run({ density: { css: '.cl-card', rule: 'cards', label: 'board cards' } }), judge: (r) => judgeDensity(r.density, 2) },

  { rule: 'F5.placeholder', bad: true, name: 'a plate with its art still loading and no tone', html: app(plate('', '<img alt="" src="http://localhost:1/never.webp" width="300" height="80">')), cfg: run({ plates: true }), judge: (r) => judgePlates(r.plates) },
  { rule: 'F5.placeholder', bad: false, name: 'a plate with art loading over a placeholder tone', html: app(plate('background:#1c2a38', '<img alt="" src="http://localhost:1/never.webp" width="300" height="80">')), cfg: run({ plates: true }), judge: (r) => judgePlates(r.plates) },
  { rule: 'F5.placeholder', bad: false, name: 'a plate with a gradient placeholder', html: app(plate('background:linear-gradient(#123,#234)', '<img alt="" src="http://localhost:1/never.webp" width="300" height="80">')), cfg: run({ plates: true }), judge: (r) => judgePlates(r.plates) },
];

/** Layout-shift controls run a script that moves content after paint, then read the observer's total. */
export const SHIFT_CONTROLS = [
  { bad: true, name: 'a block inserted above the copy after first paint', html: app('<p id="copy" style="margin:40px 0">Copy that is already on screen and reading.</p>') + `<script>setTimeout(()=>{const d=document.createElement('div');d.style.height='160px';d.style.background='#345';document.querySelector('.app').prepend(d)},150)</script>` },
  { bad: false, name: 'art that fills a box reserved before it loads', html: app('<div style="height:160px;background:#345"></div><p id="copy" style="margin:40px 0">Copy that is already on screen and reading.</p>') + `<script>setTimeout(()=>{const i=document.createElement('i');i.style.cssText='display:block;height:100%;background:#567';document.querySelector('.app div').append(i)},150)</script>` },
];

const tapControls = [
  ['F6.taps', true, 'four taps from board to a live decision', () => judgeTaps('board-to-decision', ['card', 'Choose team', 'squad', 'Deploy']).length > 0],
  ['F6.taps', false, 'three taps from board to a live decision', () => judgeTaps('board-to-decision', ['card', 'Choose team', 'Deploy']).length === 0],
  ['F6.taps', true, 'two taps from debrief to the board', () => judgeTaps('debrief-to-board', ['Done', 'Calls']).length > 0],
  ['F6.taps', false, 'one tap from debrief to the board', () => judgeTaps('debrief-to-board', ['Done']).length === 0],
  ['F5.shift', true, 'a layout shift of 0.12', () => judgeShift(0.12).length > 0],
  ['F5.shift', false, 'no layout shift', () => judgeShift(0).length === 0],
];

/** Run every control. Returns { failed: string[], ran: number }. */
export async function runFeelControls({ chromium, executablePath }) {
  const browser = await chromium.launch({ executablePath, headless: true });
  const failed = [];
  let ran = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    for (const c of FEEL_CONTROLS) {
      ran++;
      const inset = c.cfg.inset ?? { top: 0, bottom: 0 };
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: inset.top, right: 0, bottom: inset.bottom, left: 0 } });
      await page.setContent(c.html);
      await page.waitForTimeout(40);
      const raw = await page.evaluate(feelProbe, c.cfg);
      const hits = c.judge(raw).filter((f) => f.rule === c.rule);
      if (c.bad && !hits.length) failed.push(`${c.rule} "${c.name}": the check did not catch it`);
      else if (!c.bad && hits.length) failed.push(`${c.rule} "${c.name}": the check flagged a clean page: ${hits.map((h) => h.detail).join('; ')}`);
    }
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, right: 0, bottom: 0, left: 0 } });
    for (const c of SHIFT_CONTROLS) {
      ran++;
      const p = await context.newPage();
      await p.setContent(c.html);
      await p.evaluate(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
      await p.waitForTimeout(700);
      const hits = judgeShift(await p.evaluate(() => window.__cls));
      if (c.bad && !hits.length) failed.push(`F5.shift "${c.name}": the check did not catch it`);
      else if (!c.bad && hits.length) failed.push(`F5.shift "${c.name}": the check flagged a clean page: ${hits[0].detail}`);
      await p.close();
    }
  } finally { await browser.close(); }
  for (const [rule, bad, name, test] of tapControls) { ran++; if (!test()) failed.push(`${rule} "${name}": ${bad ? 'the check did not catch it' : 'the check flagged a clean case'}`); }
  return { failed, ran };
}
