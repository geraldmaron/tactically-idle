// Turns the walk's frames into the rendered rules' counts: one violation per distinct element id in a
// state at a width (R2, R4, R6, R7, R9, R12, R13, R14, R15, R18), plus the two rules that judge a whole
// frame or the whole walk: R16 (the first choice is reachable) and R17 (every state was captured).
import { FIRST_CHOICE_BUDGET, STATES } from './manifest.mjs';

export const RENDERED_RULES = {
  'R2.gutter': 'content blocks that miss the surface gutter',
  'R2.flush': 'content flush against the border of its card',
  'R4.rendered': 'headings that open with text, not a picture',
  'R6': 'interactive targets with an effective hit region under 44px',
  'R7.floor': 'rendered text under 12px',
  'R7.control': 'rendered text under 14px inside a control',
  'R9.rendered': 'icons drawn at a size other than 16, 20 or 24',
  'R12.document': 'the page scrolls sideways',
  'R12.surface': 'the sheet or screen scrolls sideways',
  'R12.clipped': 'text or controls cut off sideways',
  'R12.truncated': 'essential copy cut off by a clamp, an ellipsis or a clip',
  'R13': 'content inside a safe-area inset (bottom and side fixtures)',
  'R14': 'text under its contrast threshold on a flat fill',
  'R14.painted': 'text under its threshold over its fill with art behind it (unverified against the art)',
  'R15': 'chips with under 4px between text and border',
  'R16': 'live stages whose first choice is out of reach in the first viewport',
  'R17': 'registered surfaces or states the walk did not capture',
  'R18': 'images not decoded',
};

/** { rule: { 'state@width': Map(id -> detail) } } from the walk's frames. */
export function aggregate(frames) {
  const out = {};
  const put = (rule, key, id, detail) => { ((out[rule] ??= {})[key] ??= new Map()).set(id, detail); };
  // A target a pinned bar covers at every scroll position cannot be tapped there: it never clears the bar.
  const tested = new Map(), covered = new Map();
  for (const f of frames) {
    const key = `${f.name}@${f.width}`;
    if (!tested.has(key)) { tested.set(key, new Set()); covered.set(key, new Map()); }
    for (const id of f.probe.tested ?? []) tested.get(key).add(id);
    for (const id of f.probe.pinned ?? []) covered.get(key).set(id, 'covered by a pinned bar at every scroll position');
    for (const x of f.probe.findings) put(x.rule, key, x.id, x.detail);
    for (const [fixture, list] of Object.entries(f.insets ?? {})) for (const x of list) put('R13', `${key}`, `${fixture}|${x.id}`, x.detail);
  }
  for (const [key, ids] of covered) for (const [id, detail] of ids) if (!tested.get(key).has(id)) put('R6', key, id, detail);
  return out;
}

/** R16: does the first choice show its title (or, where the budget allows, point to the choices below)? */
export function firstChoiceVerdict(width, decision) {
  const budget = FIRST_CHOICE_BUDGET[width] ?? 'title';
  if (!decision?.present) return { ok: false, why: 'no choice on the stage' };
  if (decision.titleVisible) return { ok: true, why: 'title visible' };
  if (budget === 'title-or-affordance' && decision.affordance) return { ok: true, why: 'a "choices below" affordance is visible' };
  return { ok: false, why: `first choice title ${decision.titleTop === null ? 'is missing' : `starts at ${decision.titleTop}px`} of ${decision.viewportHeight}px, ${decision.chromeHeight}px of it pinned bars${budget === 'title-or-affordance' ? ', and no [data-choices-below] is shown' : ''}` };
}

/** R17: the walk covered every registered state at every width it ran. */
export function coverage(report, widths, failures = []) {
  const bad = new Map();
  for (const width of widths) {
    const r = report[width] ?? {};
    for (const s of STATES) {
      const e = r[s.id];
      if (!e?.segments?.length) bad.set(`${s.id}@${width}`, 'no frames captured');
      else if (e.scrollHeight && e.clientHeight && e.scrollHeight - e.clientHeight > 4 && !e.segments.some((seg) => seg.atEnd)) bad.set(`${s.id}@${width}`, 'the walk never reached the end of the scroll');
      for (const seg of e?.segments ?? []) for (const msg of seg.probe.errors) bad.set(`${s.id}@${width}|probe`, `the probe failed: ${msg}`);
    }
    for (const msg of r.errors ?? []) bad.set(`page-error@${width}|${String(msg).slice(0, 60)}`, String(msg).slice(0, 160));
  }
  for (const f of failures) bad.set(`step ${f}`, 'a walk step failed');
  return bad;
}

/** Collapse an aggregate to { rule: { key: count } }, counting each state key once per element id. */
export function countsOf(agg, extra = {}) {
  const counts = {};
  for (const [rule, byKey] of Object.entries(agg)) counts[rule] = Object.fromEntries(Object.entries(byKey).map(([k, m]) => [k, m.size]));
  for (const [rule, byKey] of Object.entries(extra)) counts[rule] = { ...(counts[rule] ?? {}), ...byKey };
  return counts;
}
