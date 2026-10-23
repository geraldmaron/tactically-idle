// The layout gates from the owner's component contract (docs/game-ux-direction.md, "Component contract",
// item 9): variable-count collections are lists, never grids, and the resource bar's pills are uniform.
//   F7.list    two direct item children of a `data-ui-list` container share a row
//   F7.marker  a surface the registry knows has 2 or more items but no `data-ui-list` around them
//   F8.pill    the bar's `data-ui-pill` pills differ in height, value type, or carry an oversized image
// Both are opt-in (see OPT_IN_RULES in feel.mjs): `FEEL_ON` lists them per screen when the slice that
// passes them lands. The page-side probe measures; the verdicts below judge boxes, so unit tests can
// feed them fixtures (src/ui/ui-gates-feel.test.ts).

/** Surfaces that must carry a marked list when they have two or more items. `screen` is the walk's name for it. */
export const LAYOUT_REGISTRY = [
  { key: 'hq-squads', screen: 'hq', label: 'HQ squads', items: '.hq-duty' },
  { key: 'hq-patrol', screen: 'hq', label: 'HQ patrol', items: '.hq-patrol-lines > div' },
  { key: 'hq-timers', screen: 'hq', label: 'HQ timers ("On the clock")', items: '.hq-timer' },
  { key: 'team-patrol', screen: 'team-patrol', label: 'the Patrol roster', items: '.patrol-roster > *' },
  { key: 'calls-board', screen: 'board', label: 'the Calls board', items: '.cl-board-list .cl-card' },
  { key: 'command-staff', screen: 'team-command', label: 'Command Staff', items: '.team-command .command-room-post, .team-command .staff-row' },
];

/** Collections that are exempt from the list rules, and why. A `data-ui-list` that matches `container` is not overlap-checked. */
export const LAYOUT_EXEMPT = [
  { key: 'officer-tiles', label: 'officer tiles', container: '.officer-character-grid', reason: 'a fixed even set that stays 2-up (owner decision, 2026-10-23)' },
];

/** Screens the layout probe runs on, in walk order: the registry's screens plus the ones that carry the bar. */
export const LAYOUT_SCREENS = ['hq', 'board', 'team-patrol', 'team-command'];

/** The resource bar's numbers (contract item 5). */
export const PILL_BUDGET = { height: 32, heightTol: 1, equalTol: 0.5, minPills: 3, iconWell: 24 };

/** Sample points sharing a row: a later item whose top is above an earlier item's bottom minus 1px. */
export function rowOverlaps(items, tol = 1) {
  const pairs = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (items[j].top < items[i].bottom - tol) pairs.push([items[i], items[j]]);
  }
  return pairs;
}

/** `lists`: [{ id, items: [{ label, top, bottom }] }] from the probe. One finding per list, naming the first pair. */
export function judgeLists(lists = []) {
  const bad = [];
  for (const list of lists) {
    const pairs = rowOverlaps(list.items);
    if (!pairs.length) continue;
    const [a, b] = pairs[0];
    bad.push({ rule: 'F7.list', id: list.id, detail: `"${a.label}" (${a.top} to ${a.bottom}px) and "${b.label}" (${b.top} to ${b.bottom}px) share a row${pairs.length > 1 ? `, and ${pairs.length - 1} more pair(s)` : ''}` });
  }
  return bad;
}

/** `entries`: [{ key, label, count, marked }]. A surface with 2+ items and no marker around them fails. */
export function judgeMarkers(entries = []) {
  return entries.filter((e) => e.count >= 2 && !e.marked).map((e) => ({ rule: 'F7.marker', id: e.key, detail: `${e.label} shows ${e.count} items with no data-ui-list around them` }));
}

/** `bar`: { pills: [{ id, h, fontSize, fontWeight, images: [{ w, h, wellW, wellH }] }], menu: { h } | null }. */
export function judgePills(bar) {
  const bad = [];
  const fail = (id, detail) => bad.push({ rule: 'F8.pill', id, detail });
  const pills = bar?.pills ?? [];
  if (pills.length < PILL_BUDGET.minPills) { fail('count', `${pills.length} pill(s) carry data-ui-pill, need at least ${PILL_BUDGET.minPills} (cash, trust, level)`); return bad; }
  const hs = pills.map((p) => p.h);
  if (Math.max(...hs) - Math.min(...hs) > PILL_BUDGET.equalTol) fail('height', `pill heights differ: ${pills.map((p) => `${p.id} ${p.h}px`).join(', ')}`);
  const off = pills.filter((p) => Math.abs(p.h - PILL_BUDGET.height) > PILL_BUDGET.heightTol);
  if (off.length) fail('height-32', `${off.map((p) => `${p.id} ${p.h}px`).join(', ')} not ${PILL_BUDGET.height}px ±${PILL_BUDGET.heightTol}`);
  if (!bar.menu) fail('menu', 'no menu button in the bar to compare with the pills');
  else if (Math.abs(bar.menu.h - pills[0].h) > PILL_BUDGET.equalTol) fail('menu', `the menu button is ${bar.menu.h}px, the pills ${pills[0].h}px`);
  const type = new Set(pills.map((p) => `${p.fontSize} ${p.fontWeight}`));
  if (type.size > 1) fail('type', `value type differs: ${pills.map((p) => `${p.id} ${p.fontSize} / ${p.fontWeight}`).join(', ')}`);
  for (const p of pills) for (const im of p.images ?? []) {
    const wellW = im.wellW ?? PILL_BUDGET.iconWell, wellH = im.wellH ?? PILL_BUDGET.iconWell;
    if (im.w > wellW + 0.5 || im.h > wellH + 0.5) fail(`image:${p.id}`, `${p.id} holds a ${im.w}x${im.h}px image, larger than its ${wellW}x${wellH}px icon well`);
  }
  return bad;
}

/**
 * Page-side. `cfg`: { registry: [{ key, label, items }] for this screen, exempt: [{ container }], pills: boolean }.
 * Measures every visible `[data-ui-list]` (direct item children), each registry entry's items and whether
 * they sit inside a marked list, and the resource bar.
 */
export async function layoutProbe(cfg) {
  const rectOf = (el) => el.getBoundingClientRect();
  const shown = (el) => { const r = rectOf(el); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const describe = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  const labelOf = (el) => (el.getAttribute('aria-label') ?? el.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 28) || describe(el);
  const out = { lists: [], registry: [], bar: null };
  const exempt = (cfg.exempt ?? []).map((e) => e.container);
  // A container with no box of its own (display: contents, uncleared floats) is still measured through its children.
  [...document.querySelectorAll('[data-ui-list]')].forEach((list, n) => {
    if (exempt.some((sel) => list.matches(sel))) return;
    // Unrounded, so the 1px tolerance is the only slack.
    const items = [...list.children].filter(shown).map((el) => { const r = rectOf(el); return { label: labelOf(el), top: r.top + scrollY, bottom: r.bottom + scrollY }; });
    if (!items.length && !list.children.length) return;
    out.lists.push({ id: `${describe(list)}#${n}`, items });
  });
  for (const e of cfg.registry ?? []) {
    const items = [...document.querySelectorAll(e.items)].filter(shown);
    const lists = new Set(items.map((x) => x.closest('[data-ui-list]')));
    // Marked means one list holds them all and each of its direct children holds at most one: a wrapper
    // around an unmarked grid does not count, because the wrapper's single child is all the list gate sees.
    const list = lists.size === 1 && !lists.has(null) ? [...lists][0] : null;
    const oneEach = !!list && [...list.children].every((child) => items.filter((x) => child === x || child.contains(x)).length <= 1);
    out.registry.push({ key: e.key, label: e.label, count: items.length, marked: items.length > 0 && oneEach });
  }
  if (cfg.pills) {
    const bar = document.querySelector('.resource-bar');
    if (bar) {
      const pills = [...bar.querySelectorAll('[data-ui-pill]')].filter(shown).map((el, i) => {
        // The value is the largest numeric text in the pill: a smaller suffix (the hourly rate) never stands for it.
        const numeric = [el, ...el.querySelectorAll('*')].filter((x) => [...x.childNodes].some((c) => c.nodeType === 3 && /\d/.test(c.textContent ?? '')));
        const valueEl = numeric.sort((a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize))[0] ?? el;
        const s = getComputedStyle(valueEl);
        const well = el.querySelector('[data-ui-pill-icon], .pill-icon, .res-well');
        const wr = well ? rectOf(well) : null;
        return {
          id: el.className && typeof el.className === 'string' ? (el.className.match(/stat-[a-z]+/)?.[0] ?? `pill${i}`) : `pill${i}`,
          h: Math.round(rectOf(el).height * 10) / 10, fontSize: s.fontSize, fontWeight: s.fontWeight,
          images: [...el.querySelectorAll('img')].filter(shown).map((im) => { const r = rectOf(im); return { w: Math.round(r.width), h: Math.round(r.height), wellW: wr ? Math.round(wr.width) : null, wellH: wr ? Math.round(wr.height) : null }; }),
        };
      });
      const menu = bar.querySelector('.menu-btn');
      out.bar = { pills, menu: menu && shown(menu) ? { h: Math.round(rectOf(menu).height * 10) / 10 } : null };
    }
  }
  return out;
}
