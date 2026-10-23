// Negative controls for the rendered gates: for each rule, a page this file owns that must trip the probe,
// and a sibling page that must not. `npm run check:ui` runs them first, so a probe that has gone blind
// fails before it is allowed to say the UI is clean.
import { PROBE_CFG } from './manifest.mjs';
import { aggregate, compareRendered, countsOf, coverage, firstChoiceVerdict } from './evaluate.mjs';
import { probe } from './probe.mjs';

const BASE = `<style>*{box-sizing:border-box}body{margin:0;background:#101820;color:#e8eef5;font:14px/1.3 system-ui}</style>`;
const app = (inner, css = '') => `${BASE}<style>${css}</style><div class="app">${inner}</div>`;
const ICON = '<svg class="icon" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor"/></svg>';
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** { rule, name, html, cfg?, insets?, bad: true|false } : `bad` pages must report `rule`, good ones must not. */
export const CONTROLS = [
  { rule: 'R2.gutter', bad: true, name: 'a block 12px in where the gutter is 16px', html: app('<div class="page"><div style="margin-left:-4px">Misaligned block</div></div>', '.page{padding:0 16px}') },
  { rule: 'R2.gutter', bad: false, name: 'aligned and full-bleed blocks', html: app('<div class="page"><div>Aligned block</div><div style="margin:0 -16px">Full bleed</div></div>', '.page{padding:0 16px}') },
  { rule: 'R2.flush', bad: true, name: 'a glyph against its card border', html: app(`<div class="card" style="margin:16px;border:1px solid #567;border-radius:8px">${ICON}<span>Watch Commander</span></div>`) },
  { rule: 'R2.flush', bad: false, name: 'a glyph inset in its card', html: app(`<div class="card" style="margin:16px;padding:12px;border:1px solid #567;border-radius:8px">${ICON}<span>Watch Commander</span></div>`) },
  { rule: 'R2.flush', bad: true, name: 'a full-width paragraph with no padding in a bordered card', html: app('<div class="card" style="margin:16px;border:1px solid #567;border-radius:8px"><p style="margin:0">Words that run straight up to the border of the card they sit in and wrap to another line.</p></div>') },
  { rule: 'R16', decision: true, bad: true, name: 'an offscreen choices affordance', html: app('<div class="call-grid" style="position:absolute;top:700px"><button class="callbtn"><span class="callbtn-title">First choice</span></button></div><button data-choices-below style="position:fixed;left:20px;bottom:-60px;width:140px;height:44px">Your call</button>') },
  { rule: 'R16', decision: true, bad: false, name: 'a visible and tappable choices affordance', html: app('<div class="call-grid" style="position:absolute;top:700px"><button class="callbtn"><span class="callbtn-title">First choice</span></button></div><button data-choices-below style="position:fixed;left:20px;bottom:10px;width:140px;height:44px">Your call</button>') },
  { rule: 'R16', decision: true, bad: true, name: 'a visible choices affordance covered by another control', html: app('<div class="call-grid" style="position:absolute;top:700px"><button class="callbtn"><span class="callbtn-title">First choice</span></button></div><button data-choices-below style="position:fixed;left:20px;bottom:10px;width:140px;height:44px">Your call</button><div style="position:fixed;z-index:2;left:20px;bottom:10px;width:140px;height:44px"></div>') },
  { rule: 'R6', bad: true, name: 'a 30px button', html: app('<button style="width:30px;height:30px">x</button>') },
  { rule: 'R6', bad: true, name: 'a 44px button covered along one side', html: app('<button style="width:60px;height:44px;margin:20px">Go</button><div style="position:fixed;left:0;top:0;width:100%;height:30px;background:#222"></div>') },
  { rule: 'R6', bad: true, name: 'a button a pinned bar covers at every scroll position', html: app('<button style="width:120px;height:44px;margin:20px 20px 0">Go</button><div style="position:fixed;left:0;top:0;width:100%;height:60px;background:#222" class="sheet-foot"></div>') },
  { rule: 'R6', bad: false, name: 'a 24px checkbox inside a 48px label', html: app('<label style="display:flex;align-items:center;min-height:48px;min-width:48px;padding:12px"><input type="checkbox" style="margin:0"></label>') },
  { rule: 'R6', bad: false, name: 'a rounded 44px button', html: app('<button style="width:44px;height:44px;border-radius:12px">x</button>') },
  { rule: 'R7.floor', bad: true, name: 'text at 11px', html: app('<p style="font-size:11px">Tiny</p>') },
  { rule: 'R7.floor', bad: false, name: 'text at 12px', html: app('<p style="font-size:12px">Meta</p>') },
  { rule: 'R7.control', bad: true, name: 'a 12px button label', html: app('<button style="font-size:12px;min-height:44px">Buy</button>') },
  { rule: 'R7.control', bad: false, name: 'a 14px button label', html: app('<button style="font-size:14px;min-height:44px">Buy</button>') },
  { rule: 'R9.rendered', bad: true, name: 'an 18px icon', html: app('<svg class="icon" width="18" height="18"></svg>') },
  { rule: 'R9.rendered', bad: false, name: 'a 20px icon', html: app('<svg class="icon" width="20" height="20"></svg>') },
  { rule: 'R12.document', bad: true, name: 'a page wider than the screen', html: app('<div style="width:700px;height:20px;background:#333"></div>') },
  { rule: 'R12.document', bad: false, name: 'a page that fits', html: app('<div style="width:100%;height:20px;background:#333"></div>') },
  { rule: 'R12.clipped', bad: true, name: 'a label cut off by a hidden-overflow box', html: app('<div style="width:100px;overflow:hidden"><button style="width:160px;min-height:44px;margin-left:30px">Long label here</button></div>') },
  { rule: 'R12.clipped', bad: false, name: 'a rail that scrolls sideways', html: app('<div style="width:200px;overflow-x:auto;display:flex"><button style="flex:none;width:160px;min-height:44px">One</button><button style="flex:none;width:160px;min-height:44px">Two</button></div>') },
  { rule: 'R12.truncated', bad: true, name: 'copy cut by a three-line clamp', html: app('<p style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;width:200px">A long hook that needs more than three lines at this width because it keeps going about the courier and the building and the door and the stairs and the lights.</p>') },
  { rule: 'R12.truncated', bad: true, name: 'copy cut by a fixed-height parent that does not scroll', html: app('<div style="height:20px;overflow:hidden"><p style="margin:0">One line of copy that fits.<br>A second line that the parent hides.<br>A third line that the parent hides too.</p></div>') },
  { rule: 'R12.truncated', bad: false, name: 'copy inside a scrolling parent', html: app('<div style="height:20px;overflow-y:auto"><p style="margin:0">One line of copy that fits.<br>A second line.<br>A third line.</p></div>') },
  { rule: 'R12.truncated', bad: false, name: 'copy that fits its box', html: app('<p style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;width:300px">Short hook.</p>') },
  { rule: 'R13', bad: true, name: 'text under a side inset', insets: { top: 0, right: 44, bottom: 0, left: 44 }, html: app('<p style="margin:0">Under the notch</p>') },
  { rule: 'R13', bad: false, name: 'text inside a side inset', insets: { top: 0, right: 44, bottom: 0, left: 44 }, html: app('<p style="margin:0;padding:0 env(safe-area-inset-right) 0 env(safe-area-inset-left)">Clear of the notch</p>') },
  { rule: 'R13', bad: true, name: 'a pinned footer under the home indicator', insets: { top: 0, right: 0, bottom: 34, left: 0 }, html: app('<footer style="position:fixed;left:0;right:0;bottom:0;padding:8px 16px">Save</footer>') },
  { rule: 'R13', bad: false, name: 'a pinned footer above the home indicator', insets: { top: 0, right: 0, bottom: 34, left: 0 }, html: app('<footer style="position:fixed;left:0;right:0;bottom:0;padding:8px 16px calc(8px + env(safe-area-inset-bottom))">Save</footer>') },
  { rule: 'R14', bad: true, name: 'grey text at 3:1 on the panel', html: app('<p style="color:#6d7680;background:#101820;margin:0">Muted</p>') },
  { rule: 'R14', bad: true, name: 'text on a translucent fill, composited', html: app('<div style="background:rgba(255,255,255,.6)"><p style="color:#fff;margin:0">White on a light veil</p></div>') },
  { rule: 'R14', bad: false, name: 'light text on the panel', html: app('<p style="color:#e8eef5;margin:0">Readable</p>') },
  { rule: 'R15', bad: true, name: 'a wrapped chip with no vertical padding', html: app('<span class="chip" style="display:inline-block;width:90px;padding:0 10px;border:1px solid #567;border-radius:12px;line-height:1.1">Earn Advanced first aid</span>') },
  { rule: 'R15', bad: false, name: 'a wrapped chip with 6px padding', html: app('<span class="chip" style="display:inline-block;width:90px;padding:6px 10px;border:1px solid #567;border-radius:12px;line-height:1.1">Earn Advanced first aid</span>') },
  { rule: 'R18', bad: true, name: 'an image that never loads', html: app('<img alt="" width="40" height="40" src="http://localhost:1/never.webp">') },
  { rule: 'R18', bad: false, name: 'an image that decodes', html: app(`<img alt="" width="40" height="40" src="${PIXEL}">`) },
];

const pure = [
  ['R16', true, 'first choice title beyond the fold at 390', () => !firstChoiceVerdict(390, { present: true, titleVisible: false, titleTop: 700, viewportHeight: 844, chromeHeight: 100 }).ok],
  ['R16', false, 'first choice title visible at 390', () => firstChoiceVerdict(390, { present: true, titleVisible: true, titleTop: 500, viewportHeight: 844, chromeHeight: 100 }).ok],
  ['R16', false, 'a visible, tappable affordance stands in for the title at 320', () => firstChoiceVerdict(320, { present: true, titleVisible: false, titleTop: 700, affordanceVisible: true, affordanceHitTestable: true, viewportHeight: 568, chromeHeight: 100 }).ok],
  ['R16', true, 'an offscreen affordance cannot stand in for the title at 320', () => !firstChoiceVerdict(320, { present: true, titleVisible: false, titleTop: 700, affordanceVisible: false, affordanceHitTestable: false, viewportHeight: 568, chromeHeight: 100 }).ok],
  ['R16', true, 'a covered affordance cannot stand in for the title at 320', () => !firstChoiceVerdict(320, { present: true, titleVisible: false, titleTop: 700, affordanceVisible: true, affordanceHitTestable: false, viewportHeight: 568, chromeHeight: 100 }).ok],
  ['R16', true, 'no affordance at 320', () => !firstChoiceVerdict(320, { present: true, titleVisible: false, titleTop: 700, affordance: false, viewportHeight: 568, chromeHeight: 100 }).ok],
  ['R6', true, 'a button a pinned bar covers at every scroll position', () => aggregate([{ name: 's', width: 390, probe: { findings: [], pinned: ['b'], tested: [] }, insets: {} }, { name: 's', width: 390, probe: { findings: [], pinned: ['b'], tested: [] }, insets: {} }]).R6?.['s@390']?.size === 1],
  ['R6', false, 'a button a pinned bar covers until the page scrolls', () => aggregate([{ name: 's', width: 390, probe: { findings: [], pinned: ['b'], tested: [] }, insets: {} }, { name: 's', width: 390, probe: { findings: [], pinned: [], tested: ['b'] }, insets: {} }]).R6 === undefined],
  ['R17', true, 'a registered state that was not captured', () => coverage({ 390: { errors: [] } }, [390]).size > 0],
  ['R17', true, 'a scrollable state never scrolled to its end', () => coverage({ 390: { '02-hq': { scrollHeight: 2000, clientHeight: 700, segments: [{ atEnd: false, probe: { errors: [] } }] }, errors: [] } }, [390]).has('02-hq@390')],
  ['R17', true, 'a failed walk step survives the width filter', () => {
    const bad = coverage({ 390: { errors: [] } }, [390], ['390 board']);
    return compareRendered(countsOf({}, { R17: Object.fromEntries([...bad.keys()].map((k) => [k, 1])) }), { rendered: {} }, [390]).some((p) => p.rule === 'R17' && p.lines.some((l) => l.startsWith('step board@390')));
  }],
];

/** Run every control. Returns { failed: string[], ran: number }. */
export async function runControls({ chromium, executablePath }) {
  const browser = await chromium.launch({ executablePath, headless: true });
  const failed = [];
  let ran = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    for (const c of CONTROLS) {
      ran++;
      await page.setViewportSize(c.rule === 'R16' ? { width: 320, height: 568 } : { width: 390, height: 844 });
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: c.insets ?? { top: 0, right: 0, bottom: 0, left: 0 } });
      await page.setContent(c.html);
      await page.waitForTimeout(40);
      const result = await page.evaluate(probe, { ...PROBE_CFG, ...(c.rule === 'R13' ? { only: 'R13', insets: c.insets, atStart: true, atEnd: true } : {}), ...(c.decision ? { decision: true } : {}) });
      if (c.rule === 'R16') {
        const verdict = firstChoiceVerdict(320, result.decision);
        if (result.errors.length) failed.push(`${c.rule} "${c.name}": the probe failed: ${result.errors.join('; ')}`);
        else if (c.bad === verdict.ok) failed.push(`${c.rule} "${c.name}": ${c.bad ? 'the check did not catch it' : 'the check flagged a clean page'} (${verdict.why})`);
        continue;
      }
      // The verdict goes through the same aggregation the walk uses, so a blind spot there fails a control too.
      const frame = c.rule === 'R13' ? { name: 'control', width: 390, probe: { findings: [], tested: [], pinned: [] }, insets: { fixture: result.findings } } : { name: 'control', width: 390, probe: result, insets: {} };
      const hits = [...(aggregate([frame])[c.rule]?.['control@390']?.entries() ?? [])].map(([, detail]) => ({ detail }));
      if (result.errors.length) failed.push(`${c.rule} "${c.name}": the probe failed: ${result.errors.join('; ')}`);
      else if (c.bad && !hits.length) failed.push(`${c.rule} "${c.name}": the probe did not catch it`);
      else if (!c.bad && hits.length) failed.push(`${c.rule} "${c.name}": the probe flagged a clean page: ${hits.map((h) => h.detail).join('; ')}`);
    }
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  } finally {
    await browser.close();
  }
  for (const [rule, bad, name, test] of pure) {
    ran++;
    if (!test()) failed.push(`${rule} "${name}": ${bad ? 'the check did not catch it' : 'the check flagged a clean case'}`);
  }
  return { failed, ran };
}
