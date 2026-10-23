// The "feel" checks: what the owner meant by flat, oversized and not one experience, measured on the
// slice screens (HQ, Calls board, Brief, Deploy, Live decide beat, Debrief). They sit beside the R-rules
// and reuse the manifest's widths, heights, seed and clock, but they are their own rule list (F1 to F6)
// so each can be switched on per screen, together with the interface change that passes it.
//   F1.primary   the screen's primary action is fully visible, unobscured and enabled in the first viewport
//   F2.essential board card hook and warning, and every choice's odds and harm, are present and unclamped
//   F3.chrome    top bar plus bottom bar is at most 108px plus the safe-area insets
//   F4.density   at least 2 board cards and 2 HQ squad rows in the first viewport when 2 or more exist
//   F5.placeholder / F5.shift   a plate shows a placeholder tone on its first frame; art load shifts nothing
//   F6.taps      board to first live decision is at most 3 taps, debrief to board is 1 (scripts/play-loop.mjs)
// Cold-load paint time is reported by the walk and never gates. Run: npm run check:feel (docs/visual-kit.md).

export const FEEL_RULES = {
  'F1.primary': 'the primary action is not fully visible, unobscured and enabled in the first viewport',
  'F2.essential': 'essential copy (card hook and warning, choice odds and harm) is missing or clamped',
  'F3.chrome': 'top bar plus bottom bar is taller than the chrome budget',
  'F4.density': 'fewer rows in the first viewport than the density floor, with enough items to fill it',
  'F5.placeholder': 'a plate is transparent on its first frame, before its art has loaded',
  'F5.shift': 'art loading shifts the layout',
  'F6.taps': 'a core path takes more taps than its budget',
};

/** Owner-tunable numbers. */
export const FEEL_BUDGETS = {
  chromePx: 108,          // top bar + bottom nav, before the safe-area insets
  minCards: 2,            // board cards in the first viewport (when the board has at least this many)
  minSquadRows: 2,        // HQ squad rows in the first viewport (when HQ lists at least this many)
  shiftMax: 0.001,        // summed layout-shift score caused by art load
  tapsBoardToDecision: 3, // board -> first live decision
  tapsDebriefToBoard: 1,  // debrief -> board
  shortScreenPx: 640,     // below this height density is not judged and the live shortcut stands in for the first choice
};

/**
 * The slice screens and what each is held to. `primary` is a list of candidates tried in order after any
 * element marked `data-primary` on the screen (the slice should mark its own); `name` is a regex source
 * matched against the accessible name. Edit these when the slice renames a control.
 */
export const FEEL_SCREENS = {
  hq: { primary: [{ css: '.hq-move .btn-primary' }], density: { css: '.hq-duty', rule: 'squads', label: 'HQ squad rows' }, plates: true },
  board: { primary: [{ css: '.cl-card-button' }], essential: 'cards', density: { css: '.cl-card', rule: 'cards', label: 'board cards' }, plates: true },
  brief: { primary: [{ css: 'button', name: '^Choose team$' }], plates: true },
  deploy: { primary: [{ css: 'button', name: '^Deploy( [A-Z]|$)' }], plates: true },
  live: { primary: [{ css: '.call-grid .callbtn:not(.callbtn-off)' }], essential: 'choices', plates: true },
  debrief: { primary: [{ css: 'button', name: '^Next call$' }], plates: true },
};

/**
 * Which rules are enforced on which screen. Empty today: the checks report everywhere and fail nowhere,
 * so `npm run check:ui` and `npm run check:feel` stay green on the old UI. The interface slice adds a
 * screen's rules here in the same change that passes them, e.g. `board: ['F1.primary', 'F4.density']`.
 * `'*'` switches a rule on for every screen. F6.taps is a path rule, enforced when listed under `'path'`.
 */
export const FEEL_ON = {
  hq: ['*'], board: ['*'], brief: ['*'], deploy: ['*'], live: ['*'], debrief: ['*'],
  path: ['F6.taps'],
};

/**
 * The page-side probe. Self-contained (page.evaluate serialises it). It measures the first viewport as
 * it stands and returns raw numbers; the verdicts below judge them in node, so the same verdict code
 * runs for the negative controls and the walk. `cfg` is { screen: FEEL_SCREENS[x], inset: {top,bottom} }.
 */
export async function feelProbe(cfg) {
  const vw = innerWidth, vh = innerHeight;
  const screen = cfg.screen ?? {};
  const cs = (el) => getComputedStyle(el);
  const rectOf = (el) => el.getBoundingClientRect();
  const shown = (el) => { const r = rectOf(el); const s = cs(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const sheets = [...document.querySelectorAll('.sheet, [role=dialog][aria-modal=true]')].filter(shown);
  const root = sheets.length ? sheets[sheets.length - 1] : (document.querySelector('.app') ?? document.body);
  const nameOf = (el) => (el.getAttribute('aria-label') ?? el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const isDisabled = (el) => el.disabled === true || el.getAttribute('aria-disabled') === 'true' || !!el.closest('fieldset:disabled');
  const describe = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  const out = { vw, vh, screen: { present: false } };

  // ---- chrome: the pinned bars the player pays for on every screen
  const first = (sels) => [...document.querySelectorAll(sels)].find((el) => shown(el) && (cs(el).position === 'fixed' || cs(el).position === 'sticky' || el.matches('.topbar, .flow-head, .bottomnav, .chrome-head, .chrome-foot')));
  const topEl = first('.topbar, .flow-head, .chrome-head');
  const botEl = first('.bottomnav, .chrome-foot, .prep-foot, .live-continue, .debrief-foot, .sticky-foot');
  out.chrome = { top: topEl ? Math.round(rectOf(topEl).height) : 0, bottom: botEl ? Math.round(rectOf(botEl).height) : 0, topLabel: topEl ? describe(topEl) : null, bottomLabel: botEl ? describe(botEl) : null, inset: cfg.inset ?? { top: 0, bottom: 0 } };
  const bottomEdge = botEl && rectOf(botEl).top > vh / 2 ? rectOf(botEl).top : vh;

  // ---- F1: the primary action
  let el = [...root.querySelectorAll('[data-primary]')].find(shown) ?? null;
  let via = el ? 'data-primary' : null;
  for (const cand of el ? [] : screen.primary ?? []) {
    const rx = cand.name ? new RegExp(cand.name) : null;
    el = [...document.querySelectorAll(cand.css)].find((x) => shown(x) && (!rx || rx.test(nameOf(x)))) ?? null;
    if (el) { via = cand.css + (cand.name ? ` /${cand.name}/` : ''); break; }
  }
  if (el) {
    const r = rectOf(el);
    const inside = r.left >= 0 && r.right <= vw && r.top >= 0 && r.bottom <= vh;
    const pts = [[r.width / 2, r.height / 2], [4, 4], [r.width - 4, 4], [4, r.height - 4], [r.width - 4, r.height - 4]];
    let coveredBy = null;
    for (const [dx, dy] of pts) {
      const x = r.left + dx, y = r.top + dy;
      if (x < 0 || y < 0 || x > vw || y > vh) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(el === hit || el.contains(hit))) { coveredBy = hit ? describe(hit) : 'nothing'; break; }
    }
    out.primary = { found: true, via, label: nameOf(el).slice(0, 40), top: Math.round(r.top), bottom: Math.round(r.bottom), inside, coveredBy, disabled: isDisabled(el) || cs(el).pointerEvents === 'none' };
  } else out.primary = { found: false };
  out.vh = vh;
  // The live call's shortcut to its choices: on a short screen the 4B order and the full hook leave no
  // room for the first choice, so a visible, unobscured, enabled shortcut is how the choice is reached.
  const jump = [...document.querySelectorAll('[data-choices-below]')].find(shown) ?? null;
  if (jump) {
    const r = rectOf(jump); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.jump = { inside: r.top >= 0 && r.bottom <= vh, clear: !!hit && (jump === hit || jump.contains(hit)), disabled: isDisabled(jump) };
  }

  // ---- F2: essential content, present and not clamped
  const clampOf = (node, stop) => {
    for (let n = node; n && n !== stop?.parentElement && n !== document.body; n = n.parentElement) {
      const s = cs(n);
      const lc = s.webkitLineClamp ?? s.getPropertyValue('-webkit-line-clamp');
      if (lc && lc !== 'none') return `line-clamp ${lc} on ${describe(n)}`;
      if (s.textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth + 1) return `ellipsis on ${describe(n)}`;
      if (/hidden|clip/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1 && n.clientHeight > 0) return `${n.scrollHeight - n.clientHeight}px cut by overflow:${s.overflowY} on ${describe(n)}`;
    }
    return null;
  };
  if (screen.essential === 'cards') {
    out.cards = [...document.querySelectorAll('.cl-card')].filter(shown).map((card, i) => {
      const hook = card.querySelector('.cl-card-hook');
      const warn = card.querySelector('.cl-card-warning, .optile-warning');
      const id = card.getAttribute('data-call-id') ?? String(i);
      return {
        id, hook: { present: !!hook && shown(hook) && (hook.textContent ?? '').trim().length > 0, clamp: hook ? clampOf(hook, card) : null },
        warning: { present: !!warn && shown(warn), clamp: warn ? clampOf(warn, card) : null },
      };
    });
    out.warningsOn = (() => { try { return (JSON.parse(localStorage.getItem('ti-settings') ?? '{}').cardWarnings ?? 'all') === 'all'; } catch { return true; } })();
  }
  if (screen.essential === 'choices') {
    out.choices = [...document.querySelectorAll('.call-grid .callbtn:not(.callbtn-off)')].filter(shown).map((btn, i) => {
      const bar = btn.querySelector('.odds-bar');
      const odds = bar ?? btn.querySelector('.callbtn-forecast-text');
      const harm = btn.querySelector('.callbtn-harm');
      return {
        id: btn.getAttribute('data-action-id') ?? String(i),
        odds: { present: !!bar && shown(bar) && /\d+\s*%/.test(btn.innerText ?? ''), clamp: odds ? clampOf(odds, btn) : null },
        harm: { present: !!harm && shown(harm) && (harm.textContent ?? '').trim().length > 0, clamp: harm ? clampOf(harm, btn) : null },
      };
    });
  }

  // ---- F4: density in the first viewport
  if (screen.density) {
    const items = [...document.querySelectorAll(screen.density.css)].filter(shown);
    const topEdge = topEl && rectOf(topEl).bottom > 0 && rectOf(topEl).top < vh / 2 ? rectOf(topEl).bottom : 0;
    out.density = { rule: screen.density.rule, label: screen.density.label, total: items.length, inView: items.filter((x) => { const r = rectOf(x); return r.top >= topEdge - 1 && r.bottom <= bottomEdge + 1; }).length, heights: items.slice(0, 3).map((x) => Math.round(rectOf(x).height)) };
  }

  // ---- F5: plates on their first frame. A plate whose art is still loading must already have a tone.
  if (screen.plates) {
    const flat = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return false; const p = m[1].split(',').map(Number); return (p.length < 4 ? 1 : p[3]) > 0.05; };
    out.plates = [...document.querySelectorAll('.plate')].filter((p) => { if (!shown(p)) return false; const r = rectOf(p); return r.bottom > 0 && r.top < vh; }).map((p, i) => {
      const imgs = [...p.querySelectorAll('img')];
      const pending = imgs.filter((im) => !(im.complete && im.naturalWidth > 0));
      let tone = null;
      for (let n = p; n && n !== document.body; n = n.parentElement) {
        const s = cs(n);
        if (flat(s.backgroundColor)) { tone = `${describe(n)} ${s.backgroundColor}`; break; }
        if (s.backgroundImage && s.backgroundImage !== 'none') { tone = `${describe(n)} background-image`; break; }
      }
      return { id: `${describe(p)}#${i}`, pendingArt: pending.length, imgs: imgs.length, tone, height: Math.round(rectOf(p).height) };
    });
  }
  out.screen.present = true;
  return out;
}

// ---- verdicts: pure, shared by the walk and the negative controls. Each returns [{ rule, id, detail }].

export function judgePrimary(p, { vh, jump } = {}) {
  // Below the short-screen floor a reachable shortcut to the choices stands in for the first choice.
  if (vh && vh < FEEL_BUDGETS.shortScreenPx && jump?.inside && jump.clear && !jump.disabled) return [];
  if (!p?.found) return [{ rule: 'F1.primary', id: 'primary', detail: 'no primary action found on the screen' }];
  const why = [];
  if (!p.inside) why.push(p.top < 0 ? `starts above the viewport (${p.top}px)` : `ends at ${p.bottom}px, below the first viewport`);
  if (p.coveredBy) why.push(`covered by ${p.coveredBy}`);
  if (p.disabled) why.push('disabled');
  return why.length ? [{ rule: 'F1.primary', id: 'primary', detail: `"${p.label}" ${why.join('; ')}` }] : [];
}

const clampDetail = (what, x) => `${what} ${!x.present ? 'is missing' : `is clamped (${x.clamp})`}`;
export function judgeEssential(r) {
  const bad = [];
  for (const c of r.cards ?? []) {
    if (!c.hook.present || c.hook.clamp) bad.push({ rule: 'F2.essential', id: `hook:${c.id}`, detail: clampDetail('card hook', c.hook) });
    if (c.warning.present && c.warning.clamp) bad.push({ rule: 'F2.essential', id: `warning:${c.id}`, detail: clampDetail('card warning', c.warning) });
  }
  if (r.cards?.length && r.warningsOn && !r.cards.some((c) => c.warning.present)) bad.push({ rule: 'F2.essential', id: 'warning:none', detail: `no card shows its warning line with warnings on (${r.cards.length} cards)` });
  for (const c of r.choices ?? []) {
    if (!c.odds.present || c.odds.clamp) bad.push({ rule: 'F2.essential', id: `odds:${c.id}`, detail: clampDetail('choice odds', c.odds) });
    if (!c.harm.present || c.harm.clamp) bad.push({ rule: 'F2.essential', id: `harm:${c.id}`, detail: clampDetail('choice harm', c.harm) });
  }
  return bad;
}

/** `inset` is the safe-area override the probe ran under; the budget grows by it. */
export function judgeChrome(c, budget = FEEL_BUDGETS.chromePx) {
  const allowed = budget + (c.inset?.top ?? 0) + (c.inset?.bottom ?? 0);
  const used = c.top + c.bottom;
  return used > allowed ? [{ rule: 'F3.chrome', id: `chrome@inset${c.inset?.top ?? 0}/${c.inset?.bottom ?? 0}`, detail: `top bar ${c.top}px (${c.topLabel ?? 'none'}) + bottom ${c.bottom}px (${c.bottomLabel ?? 'none'}) = ${used}px, budget ${allowed}px` }] : [];
}

/** `scale` is the text scale of the run; density is skipped at 2 or more and below the short-screen floor. */
export function judgeDensity(d, scale = 1, vh = 0) {
  if (!d || scale >= 2 || (vh && vh < FEEL_BUDGETS.shortScreenPx)) return [];
  const min = d.rule === 'squads' ? FEEL_BUDGETS.minSquadRows : FEEL_BUDGETS.minCards;
  if (d.total < min) return [];
  return d.inView < min ? [{ rule: 'F4.density', id: d.rule, detail: `${d.inView} of ${d.total} ${d.label} fit the first viewport, need ${min} (heights ${d.heights.join(', ')}px)` }] : [];
}

export function judgePlates(plates = []) {
  return plates.filter((p) => p.pendingArt > 0 && !p.tone).map((p) => ({ rule: 'F5.placeholder', id: p.id, detail: `${p.pendingArt} image(s) pending and no background tone or image on the plate (${p.height}px tall)` }));
}

export function judgeShift(score) {
  return score > FEEL_BUDGETS.shiftMax ? [{ rule: 'F5.shift', id: 'art-load', detail: `art load shifted the layout by ${score.toFixed(4)}` }] : [];
}

/** Tap path verdicts. `taps` is the list of described taps a run made between its start and end state. */
export function judgeTaps(path, taps) {
  const budget = path === 'board-to-decision' ? FEEL_BUDGETS.tapsBoardToDecision : FEEL_BUDGETS.tapsDebriefToBoard;
  return taps.length > budget ? [{ rule: 'F6.taps', id: path, detail: `${taps.length} taps, budget ${budget}: ${taps.join(' > ')}` }] : [];
}

/** All the in-screen verdicts for one probe result. */
export function judgeScreen(result, { scale = 1 } = {}) {
  return [
    ...judgePrimary(result.primary, { vh: result.vh, jump: result.jump }),
    ...judgeEssential(result),
    ...judgeChrome(result.chrome),
    ...judgeDensity(result.density, scale, result.vh),
    ...judgePlates(result.plates),
  ];
}

/** Is `rule` enforced on `screen` under FEEL_ON (or the override from the command line)? */
export function enforced(rule, screen, on = FEEL_ON) {
  const list = on[screen] ?? [];
  return list.includes('*') || list.includes(rule) || (on['*'] ?? []).includes(rule);
}
