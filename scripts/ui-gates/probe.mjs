// The page-side probe. `probe(cfg)` runs inside the game's page (page.evaluate serialises it, so it is
// self-contained) and measures the active surface, the open sheet or else the screen with its chrome,
// not the screens hidden behind it. It reports findings for the rendered rules:
//   R2 gutters and flush content, R6 effective 44px hit regions, R7 rendered type floors, R9 rendered
//   icon size, R12 overflow and clipped copy, R13 safe areas, R14 composited contrast, R15 chip
//   padding, R16 the first decision, R18 decoded art.
// Every finding is { rule, id, detail }, with a stable id built from the element's place in the surface,
// so one element seen in several scroll segments counts once. See docs/visual-kit.md, "UI gates".

/** @typedef {{ rule: string, id: string, detail: string }} Finding */

export async function probe(cfg) {
  const vw = innerWidth, vh = innerHeight;
  const findings = [];
  const errors = [];
  const stats = { texts: 0, targets: 0, targetsTested: 0, targetsPartial: 0, chips: 0, images: 0 };
  const add = (rule, id, detail) => findings.push({ rule, id, detail });
  const guard = (name, fn) => { if (cfg.only && cfg.only !== name) return; try { return fn(); } catch (e) { errors.push(`${name}: ${String(e).slice(0, 120)}`); } };

  // ---- the active surface
  const cache = new Map();
  const cs = (el) => { let s = cache.get(el); if (!s) { s = getComputedStyle(el); cache.set(el, s); } return s; };
  const rectOf = (el) => el.getBoundingClientRect();
  const sheets = [...document.querySelectorAll('.sheet')].filter((s) => { const r = rectOf(s); return r.width > 0 && r.height > 0 && cs(s).visibility !== 'hidden' && cs(s).display !== 'none'; });
  const app = document.querySelector('.app') ?? document.body;
  const root = sheets.length ? sheets[sheets.length - 1] : app;
  const surface = sheets.length ? 'sheet' : 'screen';
  // Dev-only controls (the reading-face switch, Open in lab) are not part of the shipped UI.
  const SKIP = '.toast-layer, .sr-only, .visually-hidden, .candidate-switch, .open-in-lab, [data-ui-gates-skip]';

  // ---- geometry
  const opacityOf = (el) => { let o = 1; for (let a = el; a && a !== document.documentElement; a = a.parentElement) o *= Number(cs(a).opacity); return o; };
  const clips = (s, axis) => (axis === 'x' ? s.overflowX : s.overflowY) !== 'visible';
  /** The part of an element's box that is on screen: inside the viewport and every clipping ancestor. */
  const visibleRect = (el) => {
    const r = rectOf(el);
    let l = r.left, t = r.top, rr = r.right, b = r.bottom;
    let needPositioned = cs(el).position === 'absolute', needTransform = cs(el).position === 'fixed';
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const s = cs(a);
      const bypass = (needPositioned && s.position === 'static' && s.transform === 'none') || (needTransform && s.transform === 'none' && s.contain === 'none' && s.filter === 'none');
      if (!bypass) {
        needPositioned = false; needTransform = false;
        if (clips(s, 'x') || clips(s, 'y')) {
          const ar = rectOf(a);
          if (clips(s, 'x')) { l = Math.max(l, ar.left + parseFloat(s.borderLeftWidth)); rr = Math.min(rr, ar.right - parseFloat(s.borderRightWidth)); }
          if (clips(s, 'y')) { t = Math.max(t, ar.top + parseFloat(s.borderTopWidth)); b = Math.min(b, ar.bottom - parseFloat(s.borderBottomWidth)); }
        }
      }
      if (s.position === 'absolute') needPositioned = true;
      if (s.position === 'fixed') needTransform = true;
    }
    l = Math.max(l, 0); t = Math.max(t, 0); rr = Math.min(rr, vw); b = Math.min(b, vh);
    return rr - l > 0 && b - t > 0 ? { left: l, top: t, right: rr, bottom: b, width: rr - l, height: b - t } : null;
  };
  const shown = (el) => {
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    if (opacityOf(el) < 0.05) return false;
    // The body of a closed <details> is not shown; only its summary is.
    const closed = el.closest('details:not([open])');
    if (closed && !(el.closest('summary') && el.closest('summary').parentElement === closed)) return false;
    const r = rectOf(el);
    return r.width > 0 && r.height > 0 && !el.closest(SKIP) && !(r.width <= 1 && r.height <= 1);
  };
  /** The box of an element's own words, so padding around them does not count as text. */
  const wordsRect = (el) => {
    const range = document.createRange(); let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      range.selectNodeContents(node);
      for (const q of range.getClientRects()) if (q.width > 0 && q.height > 0) { l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
    }
    return isFinite(l) ? { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t } : null;
  };
  const fully = (el) => { const r = rectOf(el), v = visibleRect(el); return !!v && Math.abs(v.width - r.width) < 1.5 && Math.abs(v.height - r.height) < 1.5; };
  const inSvg = (el) => !!el.closest('svg');

  // ---- stable ids
  const cls = (el) => [...el.classList].filter((c) => !/-(on|off|active|open|selected|current)$/.test(c)).slice(0, 2).map((c) => `.${c}`).join('');
  const nth = (el) => { let n = 0; for (let s = el.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === el.tagName) n++; return n; };
  const nameOf = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28);
  const idOf = (el) => {
    const path = [];
    for (let a = el, n = 0; a && a !== root && a !== document.body && n < 4; a = a.parentElement, n++) path.unshift(a.tagName.toLowerCase() + cls(a) + (n < 2 ? `:${nth(a)}` : ''));
    // Live copy (the social ticker draws random handles) would give one element a different id on each run.
    const label = el.closest('.source-ticker') ? '' : nameOf(el);
    return `${path.join('>')}${label ? ` "${label}"` : ''}`;
  };

  // ---- colour
  const parseColor = (str) => {
    if (!str || str === 'transparent') return [0, 0, 0, 0];
    let m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(str);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4])];
    m = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+%?))?\s*\)$/.exec(str);
    if (m) return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255, m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4])];
    return null;
  };
  const over = (top, under) => { const a = top[3] + under[3] * (1 - top[3]); return a === 0 ? [0, 0, 0, 0] : [0, 1, 2].map((i) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a); };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const luminance = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

  const INTERACTIVE = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=radio], [role=switch], [role=checkbox], [role=menuitem], [role=link], [role=option]';
  const isDisabled = (el) => el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true' || !!el.closest('[inert], fieldset:disabled');
  const BLUEPRINT_SVG = (el) => !!el.closest('svg');

  const all = [...root.querySelectorAll('*')].filter((el) => !SKIP || !el.matches(SKIP));
  // Text elements: each element that directly holds a non-empty text node, drawn on screen.
  const textEls = [];
  {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent.trim() || inSvg(el) || el.closest('script, style, noscript')) continue;
      seen.add(el);
      if (shown(el) && visibleRect(el)) textEls.push(el);
    }
  }
  stats.texts = textEls.length;
  const interactive = [...root.querySelectorAll(INTERACTIVE)].filter((el) => shown(el) && !isDisabled(el) && !BLUEPRINT_SVG(el));
  stats.targets = interactive.length;

  // ---- R7 rendered type floors
  guard('R7', () => {
    for (const el of textEls) {
      const px = parseFloat(cs(el).fontSize);
      if (px < cfg.floorPx) add('R7.floor', idOf(el), `${px}px`);
      else if (px < cfg.controlPx && el.closest(INTERACTIVE)) add('R7.control', idOf(el), `${px}px in a control`);
    }
  });

  // ---- R6 effective hit regions
  guard('R6', () => {
    for (const el of interactive) {
      const r = rectOf(el);
      if (!fully(el)) { stats.targetsPartial++; continue; }
      stats.targetsTested++;
      const labels = el.labels ? [...el.labels] : [];
      const own = (hit) => !!hit && (hit === el || el.contains(hit) || labels.some((l) => l === hit || l.contains(hit)));
      const hitAt = (x, y) => { const h = document.elementFromPoint(x, y); return own(h); };
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (!hitAt(cx, cy)) {
        // Scrolling content that sits under a bar fixed to the screen is not lost: it clears the bar at
        // another scroll position, where it is tested. Anything else covering the centre is a finding.
        const top = document.elementFromPoint(cx, cy);
        const pinned = top && (['fixed', 'sticky'].includes(cs(top).position) || top.closest('.chrome-foot, .chrome-head, .sheet-foot, .live-continue, .sticky-foot'));
        if (pinned && !el.closest('.chrome-foot, .chrome-head, .sheet-foot')) { stats.targetsPartial++; continue; }
        add('R6', idOf(el), `covered at its centre (${Math.round(r.width)}x${Math.round(r.height)})`); continue;
      }
      let ew = r.width, eh = r.height;
      // Five points (the centre and four corners pulled in past a rounded radius) prove the whole box is
      // the control's; when one is not, or the box is under 44px, measure how far the control reaches.
      const inset = Math.min(6, r.width / 4, r.height / 4);
      const solid = [[r.left + inset, r.top + inset], [r.right - inset, r.top + inset], [r.left + inset, r.bottom - inset], [r.right - inset, r.bottom - inset]].every(([x, y]) => hitAt(x, y));
      if (!solid || r.width < cfg.touch || r.height < cfg.touch) {
        const run = (axis) => {
          const from = axis === 'x' ? Math.floor(r.left - cfg.touch) : Math.floor(r.top - cfg.touch);
          const to = axis === 'x' ? Math.ceil(r.right + cfg.touch) : Math.ceil(r.bottom + cfg.touch);
          const mid = Math.round(axis === 'x' ? cx : cy);
          let lo = mid, hi = mid;
          while (lo - 1 >= from && (axis === 'x' ? hitAt(lo - 1, cy) : hitAt(cx, lo - 1))) lo--;
          while (hi + 1 <= to && (axis === 'x' ? hitAt(hi + 1, cy) : hitAt(cx, hi + 1))) hi++;
          return hi - lo + 1;
        };
        ew = run('x'); eh = run('y');
      }
      if (ew < cfg.touch - 0.5 || eh < cfg.touch - 0.5) add('R6', idOf(el), `${Math.round(ew)}x${Math.round(eh)} effective (${Math.round(r.width)}x${Math.round(r.height)} drawn)`);
    }
  });

  // ---- R9 rendered icon size
  guard('R9', () => {
    for (const svg of root.querySelectorAll('svg.icon')) {
      if (!shown(svg)) continue;
      const r = rectOf(svg);
      if (!cfg.iconSizes.some((s) => Math.abs(r.width - s) < 0.6 && Math.abs(r.height - s) < 0.6)) add('R9.rendered', idOf(svg.parentElement ?? svg), `${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10} icon`);
    }
  });

  // ---- R12 overflow and clipped copy
  guard('R12', () => {
    if (document.documentElement.scrollWidth > vw + 1) add('R12.document', 'document', `scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    if (root.scrollWidth > root.clientWidth + 1) add('R12.surface', idOf(root), `scrollWidth ${root.scrollWidth} > clientWidth ${root.clientWidth}`);
    const painted = [...textEls, ...interactive];
    const seen = new Set();
    for (const el of painted) {
      if (seen.has(el)) continue; seen.add(el);
      const r = rectOf(el);
      // Cut off sideways by a clip that does not scroll, or by the screen edge. A horizontal scroller
      // (a rail) keeps its items reachable, so an item past its edge is fine there.
      const outside = r.left < -1 || r.right > vw + 1;
      let cut = null, reachable = false;
      let needPositioned = cs(el).position === 'absolute';
      for (let a = el.parentElement; a && a !== document.documentElement && !cut && !reachable; a = a.parentElement) {
        const s = cs(a);
        if (needPositioned && s.position === 'static') continue;
        needPositioned = s.position === 'absolute';
        if (!clips(s, 'x')) continue;
        const scrollable = s.overflowX === 'auto' || s.overflowX === 'scroll';
        const ar = rectOf(a);
        if (scrollable && a.scrollWidth > a.clientWidth) { reachable = true; break; }
        if ((r.right > ar.right + 1.5 || r.left < ar.left - 1.5) && ar.width > 0) cut = `${cls(a) || a.tagName.toLowerCase()} (overflow ${s.overflowX})`;
      }
      if (!cut && !reachable && outside) cut = 'the screen edge';
      if (cut) add('R12.clipped', idOf(el), `cut off sideways by ${cut}`);
    }
    for (const el of textEls) {
      const s = cs(el);
      const clamp = s.getPropertyValue('-webkit-line-clamp');
      const clipsY = s.overflowY !== 'visible', clipsX = s.overflowX !== 'visible';
      if (clamp && clamp !== 'none' && el.scrollHeight > el.clientHeight + 1) add('R12.truncated', idOf(el), `line clamp ${clamp} hides ${el.scrollHeight - el.clientHeight}px of copy`);
      else if (clipsY && el.scrollHeight > el.clientHeight + 1 && s.overflowY !== 'auto' && s.overflowY !== 'scroll') add('R12.truncated', idOf(el), `overflow ${s.overflowY} hides ${el.scrollHeight - el.clientHeight}px of copy`);
      else if (s.textOverflow === 'ellipsis' && clipsX && el.scrollWidth > el.clientWidth + 1) add('R12.truncated', idOf(el), 'ellipsis hides copy');
    }
  });

  // ---- R15 chip padding
  guard('R15', () => {
    const CHIP = /(^|[\s_-])(chip|pill|badge|tag|xp)([\s_-]|$)|(^|\s)(stat|inv-count|navbadge)(\s|$)/;
    const isChip = (e) => typeof e.className === 'string' && CHIP.test(e.className);
    // Only the outer chip: a label inside one is measured by the chip around it.
    const hasChipAncestor = (e) => { for (let a = e.parentElement; a && a !== root; a = a.parentElement) if (isChip(a)) return true; return false; };
    for (const el of all) {
      if (!isChip(el) || hasChipAncestor(el) || !shown(el) || inSvg(el) || el.closest('.sheet-grip')) continue;
      if (!el.textContent.trim()) continue;
      const r = rectOf(el), s = cs(el);
      if (s.display === 'contents') continue;
      const range = document.createRange(); range.selectNodeContents(el);
      let top = Infinity, bottom = -Infinity, lines = new Set();
      for (const q of range.getClientRects()) { if (q.width < 1 || q.height < 1) continue; top = Math.min(top, q.top); bottom = Math.max(bottom, q.bottom); lines.add(Math.round(q.top / Math.max(6, q.height * 0.5))); }
      if (!isFinite(top)) continue;
      stats.chips++;
      const above = top - (r.top + parseFloat(s.borderTopWidth)), below = r.bottom - parseFloat(s.borderBottomWidth) - bottom;
      if (Math.min(above, below) < cfg.chipInset - 0.01) add('R15', idOf(el), `${Math.round(above * 10) / 10}px above and ${Math.round(below * 10) / 10}px below the text${lines.size > 1 ? ' (wrapped)' : ''}`);
    }
  });

  // ---- R14 composited contrast
  const paintedTexts = [];
  guard('R14', () => {
    const backdrop = (el) => {
      const chain = [];
      for (let a = el; a; a = a.parentElement) chain.unshift(a);
      let bg = [8, 12, 20, 1], painted = false, unknown = false;
      bg = parseColor(cs(document.documentElement).backgroundColor) ?? bg;
      if (bg[3] < 1) bg = over(bg, [0, 0, 0, 1]);
      for (const a of chain) {
        const s = cs(a);
        const c = parseColor(s.backgroundColor);
        if (!c) unknown = true;
        else if (c[3] > 0) bg = over([c[0], c[1], c[2], c[3] * (a === el ? 1 : Number(s.opacity))], bg);
        if (s.backgroundImage !== 'none') painted = true;
      }
      return { bg, painted, unknown };
    };
    const largeText = (px, weight) => px >= 24 || (px >= 18.66 && Number(weight) >= 700);
    const check = (el, label, glyph) => {
      const s = cs(el);
      if (isDisabled(el) || el.closest('[aria-disabled=true], [disabled]')) return;
      let fg = parseColor(glyph ? s.color : s.color);
      const { bg, painted, unknown } = backdrop(el);
      if (!fg || unknown) return;
      fg = over([fg[0], fg[1], fg[2], fg[3] * opacityOf(el)], bg);
      const ratio = contrast(fg, bg);
      const px = parseFloat(s.fontSize);
      const need = glyph || largeText(px, s.fontWeight) ? cfg.largeContrast : cfg.textContrast;
      if (painted) {
        // Art sits behind this text. The flat fill is all the page can measure, so a pass here is not proof;
        // UI_GATES_SAMPLE_ART=1 has the walk photograph the pixels behind the words (R14.sampled, not gated).
        stats.paintedText = (stats.paintedText ?? 0) + 1;
        if (ratio < need) add('R14.painted', idOf(el), `${ratio.toFixed(2)}:1 needs ${need}:1 on the base fill, ${label}; art sits behind it`);
        const v = visibleRect(el);
        const fgRaw = parseColor(s.color);
        // The lines the words occupy, clipped to what is on screen: decorations around them (dots, rules) are not text.
        const lines = [];
        const range = document.createRange();
        for (const node of el.childNodes) {
          if (node.nodeType !== 3 || !node.textContent.trim()) continue;
          range.selectNodeContents(node);
          for (const q of range.getClientRects()) {
            const l = Math.max(q.left, v ? v.left : 0), t = Math.max(q.top, v ? v.top : 0), r = Math.min(q.right, v ? v.right : 0), b = Math.min(q.bottom, v ? v.bottom : 0);
            if (r - l >= 2 && b - t >= 2) lines.push({ x: l, y: t, w: r - l, h: b - t });
          }
        }
        if (v && fgRaw && lines.length) paintedTexts.push({ id: idOf(el), lines, need, fg: [fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * opacityOf(el)], label });
        return;
      }
      if (ratio < need) add('R14', idOf(el), `${ratio.toFixed(2)}:1 needs ${need}:1, ${label}`);
    };
    for (const el of textEls) check(el, `${parseFloat(cs(el).fontSize)}px text`, false);
    for (const el of interactive) if (!el.textContent.trim() && el.querySelector('svg') && shown(el)) check(el, 'icon-only control', true);
  });

  // ---- R2 gutters and flush content
  guard('R2', () => {
    const owners = [...root.querySelectorAll('.page, .sheet-body, .cl-flow-body, .first-run')].concat(root.matches('.sheet-body, .page, .first-run') ? [root] : []);
    for (const owner of owners) {
      if (!shown(owner)) continue;
      const s = cs(owner), r = rectOf(owner);
      const gutter = r.left + parseFloat(s.paddingLeft), rightEdge = r.right - parseFloat(s.paddingRight);
      for (const child of owner.children) {
        if (!shown(child) || !visibleRect(child)) continue;
        const cstyle = cs(child);
        if (cstyle.position === 'absolute' || cstyle.position === 'fixed' || cstyle.display === 'inline') continue;
        const cr = rectOf(child);
        const bleed = Math.abs(cr.left - r.left) < 1.5 && Math.abs(cr.right - r.right) < 1.5;
        const aligned = Math.abs(cr.left - gutter) < 1.5 && Math.abs(cr.right - rightEdge) < 1.5;
        if (!bleed && !aligned && cr.width > 8) add('R2.gutter', idOf(child), `edges ${Math.round(cr.left - r.left)}px/${Math.round(r.right - cr.right)}px, the gutter is ${Math.round(gutter - r.left)}px`);
      }
    }
    // Content that touches the border of the card around it.
    const cardLike = (el) => {
      const s = cs(el);
      const border = parseFloat(s.borderLeftWidth) >= 1 && s.borderLeftStyle !== 'none' && (parseColor(s.borderLeftColor) ?? [0, 0, 0, 1])[3] > 0.02;
      const fill = (parseColor(s.backgroundColor) ?? [0, 0, 0, 0])[3] > 0.02;
      return (border || fill) && (parseFloat(s.borderTopLeftRadius) > 0 || border) && rectOf(el).width > 40 && rectOf(el).width < vw - 2;
    };
    const leaves = [...textEls, ...[...root.querySelectorAll('svg.icon, img, [data-portrait]')].filter(shown)];
    for (const leaf of leaves) {
      let card = null;
      for (let a = leaf.parentElement; a && a !== root; a = a.parentElement) if (cardLike(a)) { card = a; break; }
      if (!card) continue;
      const cr = rectOf(card), s = cs(card), lr = rectOf(leaf);
      const inner = cr.left + parseFloat(s.borderLeftWidth), innerRight = cr.right - parseFloat(s.borderRightWidth);
      const full = lr.width >= innerRight - inner - 4;
      if (full) continue;
      if (lr.left - inner < cfg.flushInset - 0.01 && lr.left - inner > -1) add('R2.flush', idOf(card), `${leaf.tagName.toLowerCase()} starts ${Math.round((lr.left - inner) * 10) / 10}px from the left edge of its card`);
      else if (innerRight - lr.right < cfg.flushInset - 0.01 && innerRight - lr.right > -1 && lr.width > 12) add('R2.flush', idOf(card), `${leaf.tagName.toLowerCase()} ends ${Math.round((innerRight - lr.right) * 10) / 10}px from the right edge of its card`);
    }
  });

  // ---- R4 rendered: a heading opens with a picture
  guard('R4', () => {
    for (const h of root.querySelectorAll('h2, h3, h4, h5')) {
      if (!shown(h) || /sheet-title|flow-title|screen-banner-title|cl-card-title|debrief-title|first-run-title|squad-block-name|cl-board-count|operation-choice-count/.test(h.className)) continue;
      let lead = null;
      const walk = (n) => { for (const c of n.childNodes) { if (lead) return; if (c.nodeType === 3) { if (c.textContent.trim()) lead = 'text'; } else if (c.nodeType === 1) { if (c.matches('svg, img, [data-portrait]')) lead = 'visual'; else if (c.classList.contains('sr-only')) continue; else walk(c); } } };
      walk(h);
      if (lead !== 'visual') add('R4.rendered', idOf(h), `heading opens with ${lead ?? 'nothing'}`);
    }
  });

  // ---- R18 decoded art
  const imageJobs = [];
  guard('R18', () => {
    for (const img of root.querySelectorAll('img')) {
      if (!shown(img)) continue;
      stats.images++;
      if (!img.complete || img.naturalWidth === 0) add('R18', idOf(img), `${img.currentSrc || img.src || 'no src'} not decoded`);
    }
    const urls = new Map();
    for (const el of all) {
      if (!shown(el)) continue;
      for (const m of cs(el).backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)) if (!m[1].startsWith('data:')) urls.set(m[1], el);
    }
    for (const [url, el] of urls) imageJobs.push(new Promise((resolve) => {
      const img = new Image();
      const done = (ok) => { if (!ok) add('R18', idOf(el), `${url.slice(-50)} background not decoded`); resolve(); };
      img.onload = () => done(img.naturalWidth > 0); img.onerror = () => done(false); img.src = url;
      setTimeout(() => done(false), 4000);
    }));
  });
  await Promise.all(imageJobs);

  // ---- R13 safe areas
  if (cfg.insets) guard('R13', () => {
    const { top, right, bottom, left } = cfg.insets;
    const seen = new Set();
    // Scrolling content may pass under the top and bottom insets; it has to clear them where the
    // scroller starts and ends. Anything not in a scroller (bars, footers) has to clear them always.
    const inScroller = (el) => { for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) { const s = cs(a); if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && a.scrollHeight > a.clientHeight + 4) return true; } return false; };
    for (const el of [...textEls, ...interactive, ...[...root.querySelectorAll('svg.icon')].filter(shown)]) {
      if (seen.has(el)) continue; seen.add(el);
      const clip = visibleRect(el);
      const words = textEls.includes(el) ? wordsRect(el) : null;
      const v = clip && words ? { left: Math.max(words.left, clip.left), top: Math.max(words.top, clip.top), right: Math.min(words.right, clip.right), bottom: Math.min(words.bottom, clip.bottom) } : clip;
      if (!v || v.right <= v.left || v.bottom <= v.top) continue;
      const scrolling = inScroller(el);
      const sides = [];
      if (left && v.left < left - 0.5) sides.push(`${Math.round(left - v.left)}px into the left inset`);
      if (right && v.right > vw - right + 0.5) sides.push(`${Math.round(v.right - (vw - right))}px into the right inset`);
      if (bottom && v.bottom > vh - bottom + 0.5 && (!scrolling || cfg.atEnd)) sides.push(`${Math.round(v.bottom - (vh - bottom))}px into the bottom inset`);
      if (top && v.top < top - 0.5 && (!scrolling || cfg.atStart)) sides.push(`${Math.round(top - v.top)}px into the top inset`);
      if (sides.length) add('R13', idOf(el), sides.join(', '));
    }
  });

  // ---- R16 the first decision
  let decision = null;
  guard('R16', () => {
    if (!cfg.decision) return;
    const card = [...document.querySelectorAll('.call-grid .callbtn:not(.callbtn-off)')].find(shown) ?? [...document.querySelectorAll('.call-grid .callbtn')].find(shown);
    const title = card?.querySelector('.callbtn-title, h3, strong') ?? card;
    const fixed = [...document.querySelectorAll('.chrome-head, .chrome-foot, .sheet-foot, .live-continue, .sticky-foot')].filter(shown);
    const blocked = fixed.reduce((sum, el) => sum + (cs(el).position === 'fixed' || cs(el).position === 'sticky' || el.matches('.chrome-head, .chrome-foot') ? rectOf(el).height : 0), 0);
    let visible = false, top = null;
    if (title) {
      const r = rectOf(title); top = Math.round(r.top);
      const mid = document.elementFromPoint(r.left + Math.min(r.width / 2, 40), r.top + r.height / 2);
      visible = r.top >= 0 && r.bottom <= vh && !!mid && (title.contains(mid) || card.contains(mid));
    }
    const affordance = [...document.querySelectorAll('[data-choices-below]')].some(shown);
    decision = { present: !!card, titleVisible: visible, titleTop: top, affordance, chromeHeight: Math.round(blocked), viewportHeight: vh, unobscuredHeight: Math.round(vh - blocked) };
  });

  const legacy = cfg.only ? null : (() => {
    const h = (sel) => { const el = [...document.querySelectorAll(sel)].find(shown); return el ? Math.round(rectOf(el).height) : 0; };
    const primary = [...root.querySelectorAll('.btn-primary')].find(shown);
    return {
      docOverflow: document.documentElement.scrollWidth > vw,
      chrome: { topbar: h('.topbar, .flow-head'), bottomnav: h('.bottomnav, .chrome-foot > .action-bar'), sheetFoot: h('.sheet-foot'), stickyFoot: h('.prep-foot, .live-continue, .debrief-foot, .sticky-foot, .opfoot') },
      primary: primary ? { label: nameOf(primary), top: Math.round(rectOf(primary).top) } : null,
      smallTargets: findings.filter((f) => f.rule === 'R6').length,
      smallText: textEls.filter((el) => parseFloat(cs(el).fontSize) < 13).length,
    };
  })();
  return {
    paintedTexts, legacy, surface, viewport: `${vw}x${vh}`, root: root.className || root.tagName.toLowerCase(),
    findings, decision, errors, stats,
    textHash: (() => { let h = 2166136261; for (const ch of root.innerText ?? '') h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h.toString(16); })(),
  };
}
