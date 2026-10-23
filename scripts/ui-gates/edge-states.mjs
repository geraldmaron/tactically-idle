// States the harness has no action for, reached the way a player's device reaches them. Shared by the
// R-rule walk (docs/captures/ui-ux-audit/tools/capture.mjs) and the feel walk (feel-walk.mjs).
//   long squad names   the longest name the roster accepts (ROSTER_TUNING.nameMax, 20), set through the real
//                      `renameSquad` action. Officer names are generated and cannot be renamed, so a long
//                      officer name is not covered.
//   empty board        the Calls board hides calls past their expiry, so the page clock jumps a month ahead
//                      while the sim's own 5s tick is held; with the tick running it would deal a new board.
import { FIXED_TIME } from './manifest.mjs';

/** Wide and long, both at the 20-character limit. */
export const LONG_SQUAD_NAMES = ['Westmoreland Heights', 'Northgate Rapid Resp'];

const TICK_MS = 5000; // src/ui/store.ts

/** Context init script: the sim's tick interval does nothing while `window.__holdTicks` is true. */
export const holdTicksScript = (tickMs) => {
  const real = window.setInterval.bind(window);
  window.setInterval = (callback, ms, ...rest) => real(typeof callback === 'function' && ms === tickMs ? (...a) => { if (!window.__holdTicks) callback(...a); } : callback, ms, ...rest);
};
export const installTickHold = (context) => context.addInitScript(holdTicksScript, TICK_MS);

/** Renames every squad to a 20-character name. Throws when the sim refuses, so a rule change cannot pass silently. */
export async function seedLongNames(page) {
  const refused = await page.evaluate((names) => {
    const ti = window.__ti;
    return ti.getState().squads.map((s, i) => ti.send({ type: 'renameSquad', squadId: s.id, name: names[i % names.length] })).filter((r) => !r.ok).map((r) => r.reason);
  }, LONG_SQUAD_NAMES);
  if (refused.length) throw new Error(`could not seed long squad names: ${refused[0]}`);
}

/** Empties the Calls board and waits for the empty state. Call `restoreBoard` before continuing the walk. */
export async function emptyBoard(page) {
  await page.evaluate(() => { window.__holdTicks = true; });
  await page.clock.setFixedTime(new Date(new Date(FIXED_TIME).getTime() + 30 * 24 * 3600 * 1000));
  await page.waitForFunction(() => /^No calls waiting/.test(document.querySelector('.cl-board-count')?.textContent ?? ''), null, { timeout: 8000 });
}

export async function restoreBoard(page) {
  await page.clock.setFixedTime(new Date(FIXED_TIME));
  await page.evaluate(() => { window.__holdTicks = false; });
}
