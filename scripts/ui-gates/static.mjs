// The static UI gates: rules R1, R3, R4, R5, R7, R8, R9, R10 and R11 as source scans. Each detector
// takes a file's text and returns findings, so a negative control can feed it a fixture it owns.
// collectStatic() runs them over src/ui. Counts go to the ratchet (ratchet.mjs); a finding is
// { file, line, text }. Definitions are in docs/visual-kit.md, "UI gates".
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCss, topLevelTokens, withoutUrls, withoutVars } from './css.mjs';
import { childrenOf, enclosing, firstChild, isVisualName, parentOf, scanJsx, stripTsComments } from './jsx.mjs';

export const THEME_FILE = 'src/ui/theme.css';
/** The spacing scale in px: --sp1 to --sp6 in theme.css. */
export const SPACING_SCALE = [4, 8, 12, 16, 24, 32];
export const ICON_SIZES = [16, 20, 24];
/** The kit's named icon sizes (icons.tsx, ICON_SIZE): 16, 20 and 24. */
export const ICON_SIZE_NAMES = ['sm', 'md', 'lg'];
export const ICON_STROKE = 1.75;
export const SMALL_PX = 14;
export const FLOOR_PX = 12;
/** The blueprint's SVG text is sized in viewBox units that scale with the map, not in screen pixels. */
const SVG_UNIT_FILES = ['src/ui/blueprint/blueprint.css'];
const SVG_UNIT_UNDER = 6;
/** The kit gallery is a dev page the production bundle never renders (visual-floors.test.ts). */
const NOT_UI_SOURCE = /(^|\/)(KitGallery\.tsx)$/;
/** Screen, sheet and card titles name a whole surface or a thing, not a section of one. They carry no
 * lead of their own (the plate, the sheet chrome or the card art does). */
const TITLE_CLASS = /\b(?:sheet-title|flow-title|screen-banner-title|cl-card-title|debrief-title|first-run-title|squad-block-name|cl-board-count|operation-choice-count)\b/;

const SPACING_PROP = /^(?:padding|margin)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?$|^(?:gap|row-gap|column-gap|grid-gap|grid-row-gap|grid-column-gap)$/;
const GAP_PROP = /^(?:gap|row-gap|column-gap|grid-gap|grid-row-gap|grid-column-gap)$/;

/** @typedef {{ file: string, line: number, text: string, kind?: string }} Finding */

const decl = (d) => `${d.selector.slice(0, 70)} { ${d.prop}: ${d.value.slice(0, 60)} }`;

// ------------------------------------------------------------------------------------------ R1, R3

/** Nonzero px/rem lengths a value spells itself, var() excluded. rem counts as 16px. */
export function rawLengths(value) {
  const found = [];
  for (const m of withoutUrls(withoutVars(value)).matchAll(/(?<![\w.#-])(-?\d*\.?\d+)(px|rem)\b/g)) {
    const n = Number(m[1]) * (m[2] === 'rem' ? 16 : 1);
    if (n !== 0) found.push(n);
  }
  return found;
}

/** R1: layout spacing comes from the --sp tokens. One finding per declaration with a raw length.
 * R3: of those, the gap declarations whose raw length is also off the scale. */
export function spacingFindings(file, css) {
  const R1 = [], R3 = [];
  if (file === THEME_FILE) return { R1, R3 };
  for (const d of parseCss(css, file)) {
    if (!SPACING_PROP.test(d.prop)) continue;
    const lengths = rawLengths(d.value);
    if (!lengths.length) continue;
    const offScale = lengths.some((n) => !SPACING_SCALE.includes(Math.abs(n)));
    R1.push({ file, line: d.line, text: decl(d), kind: offScale ? 'off-scale' : 'on-scale' });
    if (GAP_PROP.test(d.prop) && offScale) R3.push({ file, line: d.line, text: decl(d) });
  }
  return { R1, R3 };
}

/** R1 in TSX: padding, margin and gap in style objects with a literal other than 0. */
export function tsxSpacingFindings(file, tsx) {
  const src = stripTsComments(tsx);
  const out = [];
  for (const m of src.matchAll(/\b(padding|margin|gap|rowGap|columnGap)(?:Top|Right|Bottom|Left|Inline|Block)?\s*:\s*(-?\d*\.?\d+(?:px|rem)?|'[^']*\d[^']*'|"[^"]*\d[^"]*")/g)) {
    const lengths = /^['"]/.test(m[2]) ? rawLengths(m[2].slice(1, -1)) : Number(parseFloat(m[2])) ? [1] : [];
    if (lengths.length) out.push({ file, line: lineAt(src, m.index), text: m[0].slice(0, 70) });
  }
  return out;
}

// -------------------------------------------------------------------------------------------- R7

/** Every font size a declaration sets, in px or as a size token (--s12 is 12px). */
export function fontPx(d) {
  if (d.prop !== 'font-size' && d.prop !== 'font') return null;
  const m = d.prop === 'font-size' ? /^(?:([\d.]+)px|var\(--s(\d+)\))/.exec(d.value) : /(?:^|\s)(?:([\d.]+)px|var\(--s(\d+)\))/.exec(d.value);
  if (!m) return null;
  const px = Number(m[1] ?? m[2]);
  if (SVG_UNIT_FILES.includes(d.file) && px < SVG_UNIT_UNDER) return null;
  return px;
}

/** R7: text under 14px in CSS (one finding per declaration), tagged `floor` when under 12px. */
export function textSizeFindings(file, css) {
  const out = [];
  for (const d of parseCss(css, file)) {
    const px = fontPx(d);
    if (px !== null && px < SMALL_PX) out.push({ file, line: d.line, text: decl(d), kind: px < FLOOR_PX ? 'floor' : 'sub14' });
  }
  return out;
}

/** R7 in TSX: inline fontSize. A literal under 12 is a floor failure; a formula is dynamic and has to
 * be classified (the blueprint's SVG units are, by path). */
export function tsxTextFindings(file, tsx) {
  if (/^src\/ui\/blueprint\//.test(file)) return [];
  const src = stripTsComments(tsx);
  const out = [];
  for (const m of src.matchAll(/\bfontSize\s*[:=]\s*\{?\s*([^,}\n]+)/g)) {
    const value = m[1].trim();
    const n = /^(\d+(?:\.\d+)?)(?:px)?['"]?$/.exec(value.replace(/^['"]/, ''));
    const kind = n ? (Number(n[1]) < FLOOR_PX ? 'floor' : Number(n[1]) < SMALL_PX ? 'sub14' : null) : 'dynamic';
    if (kind) out.push({ file, line: lineAt(src, m.index), text: m[0].slice(0, 70), kind });
  }
  return out;
}

// -------------------------------------------------------------------------------------------- R8

const NAMED_COLORS = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' '));
const COLOR_PROP = /^(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-color)?)?|border-color|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|filter|caret-color|accent-color|text-decoration(?:-color)?|column-rule(?:-color)?|stop-color|flood-color|lighting-color|-webkit-text-stroke(?:-color)?|--[\w-]+)$/;
/** Mask properties use only a color's alpha, so a literal there is not a UI color. Counted apart. */
const MASK_PROP = /^(?:-webkit-)?mask(?:-[\w-]+)?$/;

/** Literal colors in a CSS value: hex, color functions with a numeric argument, and named colors. */
export function colorLiterals(prop, rawValue) {
  const value = withoutUrls(rawValue);
  const found = [];
  for (const m of value.matchAll(/#[0-9a-fA-F]{3,8}(?![\w-])/g)) found.push(m[0]);
  for (const m of value.matchAll(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(((?:[^()]|\([^()]*\))*)\)/g)) if (/\d/.test(withoutVars(m[2]))) found.push(m[0].slice(0, 40));
  if (COLOR_PROP.test(prop)) {
    for (const token of withoutVars(value).split(/[^a-zA-Z-]+/)) if (NAMED_COLORS.has(token.toLowerCase())) found.push(token);
  }
  return found;
}

/** R8 in CSS: literal colors outside the theme. Kind `mask` is the alpha-only exception. */
export function cssColorFindings(file, css) {
  if (file === THEME_FILE) return [];
  const out = [];
  for (const d of parseCss(css, file)) {
    const literals = colorLiterals(d.prop, d.value);
    if (literals.length) out.push({ file, line: d.line, text: decl(d), kind: MASK_PROP.test(d.prop) ? 'mask' : 'color' });
  }
  return out;
}

/** R8 in TS and TSX: color literals inside string literals (style objects, SVG attributes). */
export function tsColorFindings(file, ts) {
  const src = stripTsComments(ts);
  const out = [];
  for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const content = m[2];
    const hex = /^#[0-9a-fA-F]{3,8}$/.test(content) || /[\s(,:]#[0-9a-fA-F]{3,8}(?![\w-])/.test(content);
    const fn = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^)]*\d[^)]*\)/.test(withoutVars(content));
    const named = NAMED_COLORS.has(content.toLowerCase()) && /(?:fill|stroke|[cC]olor|background)\s*[:=]\s*\{?\s*$/.test(src.slice(Math.max(0, m.index - 30), m.index));
    if (hex || fn || named) out.push({ file, line: lineAt(src, m.index), text: content.slice(0, 50) });
  }
  return out;
}

// -------------------------------------------------------------------------------------------- R9

/** R9: <Icon> sizes (16, 20, 24), stroke (1.75) and dynamic expressions, in TSX. */
export function iconFindings(file, tsx) {
  const { elements } = scanJsx(tsx);
  const size = [], stroke = [], dynamic = [];
  for (const el of elements) {
    if (el.name !== 'Icon') continue;
    const s = el.attrs.size;
    if (s) {
      // A kit size name ('sm', 'md', 'lg'), a pixel size, or an expression made of them (compact ? 'md' : 'lg').
      const tokens = [...s.value.matchAll(/'([^']*)'|"([^"]*)"|(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g)].map((m) => m[1] ?? m[2] ?? Number(m[3]));
      const n = s.kind === 'expr' && /^\d+(?:\.\d+)?$/.test(s.value) ? Number(s.value) : s.kind === 'str' && /^\d+$/.test(s.value) ? Number(s.value) : null;
      if (s.kind === 'str' && ICON_SIZE_NAMES.includes(s.value)) continue;
      if (n !== null) { if (!ICON_SIZES.includes(n)) size.push({ file, line: el.line, text: `<Icon size={${n}}>` }); }
      else if (tokens.length && tokens.every((t) => typeof t === 'string' ? ICON_SIZE_NAMES.includes(t) : ICON_SIZES.includes(t))) continue;
      else if (tokens.some((t) => typeof t === 'number' && !ICON_SIZES.includes(t))) size.push({ file, line: el.line, text: `<Icon size={${s.value.slice(0, 30)}}>` });
      else dynamic.push({ file, line: el.line, text: `<Icon size={${s.value}}>` });
    }
    const w = el.attrs.strokeWidth;
    if (w && !(w.kind === 'expr' && Number(w.value) === ICON_STROKE)) stroke.push({ file, line: el.line, text: `<Icon strokeWidth={${w.value}}>` });
  }
  return { size, stroke, dynamic };
}

/** R9 in CSS: a rule that sizes an icon or svg to something other than 16, 20 or 24px. */
export function iconCssFindings(file, css) {
  const out = [], seen = new Set();
  for (const d of parseCss(css, file)) {
    if (!/(?:^|[\s>+~,])(?:[\w.-]*\.icon\b|svg\b)/.test(d.selector) || /\.kit-|\.res-icon|\.tab-plate/.test(d.selector)) continue;
    if (!/^(?:width|height)$/.test(d.prop)) continue;
    const px = /^([\d.]+)px$/.exec(d.value);
    if (!px || ICON_SIZES.includes(Number(px[1]))) continue;
    const key = `${d.selector}|${d.at.join()}`;
    if (!seen.has(key)) { seen.add(key); out.push({ file, line: d.line, text: decl(d) }); }
  }
  return out;
}

// -------------------------------------------------------------------------------------------- R4

const SR_ONLY = /\bsr-only\b/;
const importsFromUi = (src, name) => new RegExp(`import\\s*(?:type\\s*)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"][^'"]*(?:components/ui|\\./ui)['"]`).test(src);

/** R4: a section heading opens with a picture, a shared Section carries an icon, a shared Row a lead. */
export function leadFindings(file, tsx) {
  if (NOT_UI_SOURCE.test(file)) return { heading: [], section: [], row: [] };
  const { src, elements } = scanJsx(tsx);
  const heading = [], section = [], row = [];
  const sharedRow = importsFromUi(src, 'Row') || file === 'src/ui/components/ui.tsx';
  const sharedSection = importsFromUi(src, 'Section');
  for (const el of elements) {
    if (/^h[1-6]$/.test(el.name) && !el.selfClosing) {
      const cls = el.attrs.className?.value ?? '';
      if (SR_ONLY.test(cls) || TITLE_CLASS.test(cls)) continue;
      const first = firstChild(childrenOf(src, el));
      if (!(first.kind === 'element' && isVisualName(first.name))) heading.push({ file, line: el.line, text: `<${el.name}${cls ? ` className="${cls.slice(0, 30)}"` : ''}> starts with ${first.kind === 'element' ? `<${first.name}>` : first.kind}` });
    }
    if (el.name === 'Section' && sharedSection && !el.attrs.icon) section.push({ file, line: el.line, text: `<Section title=${el.attrs.title?.value?.slice(0, 30) ?? '?'}> has no icon` });
    if (el.name === 'Row' && sharedRow && !el.attrs.lead) row.push({ file, line: el.line, text: `<Row title=${el.attrs.title?.value?.slice(0, 40) ?? '?'}> has no lead` });
  }
  return { heading, section, row };
}

/** R4 in CSS: a rule that hides a glyph (`display: none` on an icon or svg). */
export function hiddenGlyphFindings(file, css) {
  const out = [];
  for (const d of parseCss(css, file)) {
    if (d.prop === 'display' && d.value === 'none' && /(?:\.icon\b|\bsvg\b)/.test(d.selector) && !/sr-only|print/.test(d.selector)) out.push({ file, line: d.line, text: decl(d) });
  }
  return out;
}

// -------------------------------------------------------------------------------------------- R5

const BASIC_GLYPH = /GEAR_SOURCE_ICON\.basic|['"]basicKit['"]/;
const STATUS_ICON_USE = /STATUS_META|OFFICER_STATUS_ICON/;
const OUTCOME_ICON_USE = /OUTCOME_ICON/;

/** R5: source, status and outcome keep the kit's marks. A "Basic kit" mention in visible text needs the
 * basicKit glyph in its element or the one around it; a status or outcome icon is drawn by StatusMark
 * and OutcomeMark (icons/marks.tsx), never by hand. */
export function kitSemanticsFindings(file, tsx) {
  if (/^src\/ui\/icons\//.test(file) || NOT_UI_SOURCE.test(file)) return { basicKit: [], status: [], outcome: [], forecast: [] };
  const { src, elements, lineOf } = scanJsx(tsx);
  const basicKit = [], status = [], outcome = [], forecast = [];
  const seen = new Set();
  for (const m of src.matchAll(/basic kit|\bBASIC_KIT_LINE\b/gi)) {
    if (elements.some((e) => m.index >= e.start && m.index < e.openEnd)) continue;
    const el = enclosing(elements, m.index);
    if (!el) continue;
    const inText = !/^[A-Z_]+$/.test(m[0]) || src.slice(Math.max(0, m.index - 1), m.index) === '{';
    // Only visible words count: text between tags or a braced constant, not an attribute value.
    const own = childrenOf(src, el);
    const relative = m.index - el.openEnd;
    const before = own.slice(0, relative);
    const insideChildElement = (before.match(/<[A-Za-z][^>]*[^/]>/g)?.length ?? 0) > (before.match(/<\/[A-Za-z][^>]*>/g)?.length ?? 0) + (before.match(/<[A-Za-z][^>]*\/>/g)?.length ?? 0);
    if (!inText || insideChildElement || seen.has(el.start)) continue;
    seen.add(el.start);
    const parent = parentOf(elements, el);
    const around = src.slice(el.start, el.end) + (parent ? src.slice(parent.start, parent.end) : '');
    if (!BASIC_GLYPH.test(around)) basicKit.push({ file, line: lineOf(m.index), text: `"${m[0]}" without the basicKit glyph` });
  }
  for (const el of elements) {
    // An outcome row (a forecast band) opens with the kit's mark, so favorable, mixed and adverse read at a glance.
    if (!el.selfClosing && /\boutcome-option\b/.test(el.attrs.className?.value ?? '')) {
      const first = firstChild(childrenOf(src, el));
      const inner = firstChild(childrenOf(src, el).replace(/^\s*<div[^>]*>/, ''));
      const lead = [first, inner].find((c) => c.kind === 'element' && isVisualName(c.name));
      if (!lead) forecast.push({ file, line: el.line, text: `<${el.name} className="${(el.attrs.className?.value ?? '').slice(0, 30)}"> has no outcome mark` });
    }
    if (el.name !== 'Icon' || !el.attrs.name) continue;
    if (STATUS_ICON_USE.test(el.attrs.name.value)) status.push({ file, line: el.line, text: `<Icon name={${el.attrs.name.value.slice(0, 40)}}> draws status by hand` });
    if (OUTCOME_ICON_USE.test(el.attrs.name.value)) outcome.push({ file, line: el.line, text: `<Icon name={${el.attrs.name.value.slice(0, 40)}}> draws an outcome by hand` });
  }
  return { basicKit, status, outcome, forecast };
}

// ------------------------------------------------------------------------------------------- R10

/** The shared component families, with the stylesheet that owns each one's look. */
export const FAMILIES = [
  { name: 'button', cls: /^\.btn(?:-[\w-]+)?$/, owners: ['src/ui/app.css'] },
  { name: 'chip', cls: /^\.chip(?:-[\w-]+)?$/, owners: ['src/ui/app.css'] },
  { name: 'pill', cls: /^\.pill(?:-[\w-]+)?$/, owners: ['src/ui/app.css'] },
  { name: 'card', cls: /^\.card(?:-[\w-]+)?$/, owners: ['src/ui/app.css'] },
  { name: 'row', cls: /^\.ui-row(?:-[\w-]+)?$/, owners: ['src/ui/app.css'] },
];
/** Declarations that make up a component's look. Layout (width, flex, margin, position) is the caller's. */
const APPEARANCE = /^(?:font-size|font-weight|font-family|letter-spacing|text-transform|padding(?:-[\w]+)?|border(?:-[\w]+)*|border-radius|background(?:-color)?|box-shadow|min-height|height|color)$/;
/** Badge-shaped standalone definitions that are registered variants, by class name. */
export const REGISTERED_BADGES = new Set(['.chip', '.pill', '.ct-badge', '.kit-mark', '.tag']);

const subjectOf = (selector) => selector.split(',').map((part) => part.trim().split(/[\s>+~]+/).pop() ?? '');

/** R10: one implementation per family. A local redefinition is a rule outside the owner stylesheet that
 * sets a shared family's look. A rogue badge is a one-class rule outside the owners that has the whole
 * recipe of a badge (pill radius, padding, small type and a fill or border) and is not registered. */
export function variantFindings(file, css) {
  const redefinition = [], badge = [];
  const rules = new Map();
  for (const d of parseCss(css, file)) {
    const key = `${d.selector}|${d.at.join()}`;
    if (!rules.has(key)) rules.set(key, { selector: d.selector, line: d.line, decls: new Map() });
    rules.get(key).decls.set(d.prop, d.value);
  }
  for (const rule of rules.values()) {
    const subjects = subjectOf(rule.selector);
    for (const family of FAMILIES) {
      if (family.owners.includes(file)) continue;
      const hit = subjects.find((s) => s.split(/(?=[.:[#])/).some((part) => family.cls.test(part)));
      const set = [...rule.decls.keys()].filter((p) => APPEARANCE.test(p));
      if (hit && set.length) redefinition.push({ file, line: rule.line, text: `${rule.selector.slice(0, 60)} sets ${set.join(', ')} (${family.name})` });
    }
    const only = subjects.length === 1 ? /^\.[\w-]+$/.exec(subjects[0].replace(/:[\w-]+(\([^)]*\))?$/, '')) : null;
    if (!only || REGISTERED_BADGES.has(only[0]) || FAMILIES.some((f) => f.cls.test(only[0]))) continue;
    const d = rule.decls;
    const radius = d.get('border-radius') ?? '';
    const pill = /^(?:999|99\d\d|50%|var\(--r-?pill\))/.test(radius) || /^(\d+)px$/.test(radius) && Number(radius.slice(0, -2)) >= 100;
    if (pill && d.has('padding') && d.has('font-size') && (d.has('background') || d.has('background-color') || d.has('border'))) badge.push({ file, line: rule.line, text: `${rule.selector.slice(0, 60)} is a badge outside the chip family` });
  }
  return { redefinition, badge };
}

/** R10 in TSX: a switch is one component. Every site that builds one by hand (role="switch", or a
 * checkbox inside a toggle) is a finding outside the shared owner, ui.tsx. */
export function switchFindings(file, tsx) {
  if (file === 'src/ui/components/ui.tsx') return [];
  const { elements } = scanJsx(tsx);
  const out = [];
  for (const el of elements) {
    const role = el.attrs.role?.value === 'switch';
    const checkbox = el.name === 'input' && el.attrs.type?.value === 'checkbox';
    const around = checkbox ? enclosing(elements, el.start) : null;
    const toggle = checkbox && /\b(?:toggle|switch)\b/.test(around?.attrs.className?.value ?? '');
    if (role || toggle) out.push({ file, line: el.line, text: `<${el.name}> built as a switch by hand` });
  }
  return out;
}

// ------------------------------------------------------------------------------------------- R11

/** R11: an empty or failed state uses the shared treatment. A bespoke empty is an element whose text opens
 * with "No", "None", "Nothing" or "Empty", or whose class names itself empty, outside EmptyState. A
 * bespoke error is an alert built by hand. */
export function stateFindings(file, tsx) {
  if (file === 'src/ui/components/ui.tsx' || file === 'src/ui/components/states.tsx' || NOT_UI_SOURCE.test(file)) return { empty: [], error: [] };
  const { src, elements } = scanJsx(tsx);
  const empty = [], error = [];
  for (const el of elements) {
    if (el.selfClosing || /^(?:Section|Sheet|EmptyState|LoadingState|ErrorState)$/.test(el.name)) continue;
    const insideEmptyState = elements.some((p) => /^(?:EmptyState|LoadingState|ErrorState)$/.test(p.name) && !p.selfClosing && el.start >= p.openEnd && el.end <= p.closeStart);
    const cls = el.attrs.className?.value ?? '';
    const first = firstChild(childrenOf(src, el));
    const absence = first.kind === 'text' && /^(?:No|None|Nothing|Empty)\b/.test(first.text);
    const namedEmpty = /(?:^|[\s-])empty(?:$|[\s-])/.test(cls);
    if (!insideEmptyState && (absence || namedEmpty)) empty.push({ file, line: el.line, text: `<${el.name}${cls ? ` className="${cls.slice(0, 30)}"` : ''}> ${absence ? first.text.slice(0, 30) : 'is its own empty state'}` });
    if (!insideEmptyState && (el.attrs.role?.value === 'alert' || /^(?:p|div|span)$/.test(el.name) && /(?:^|[\s-])(?:alert|error)(?:$|[\s-])/.test(cls))) error.push({ file, line: el.line, text: `<${el.name}${cls ? ` className="${cls.slice(0, 30)}"` : ''}> is an error built by hand` });
  }
  return { empty, error };
}

// -------------------------------------------------------------------------------------------- run

function lineAt(src, offset) {
  let n = 1;
  for (let i = 0; i < offset; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

/** Every .css, .tsx and .ts file under src/ui, as { file, text } with repo-relative paths. Tests are skipped. */
export function loadSources(root) {
  const ui = join(root, 'src/ui');
  const css = [], ts = [];
  for (const rel of readdirSync(ui, { recursive: true, encoding: 'utf8' })) {
    const file = `src/ui/${rel.replaceAll('\\', '/')}`;
    if (/\.test\.tsx?$/.test(file) || /\.fixtures?\.tsx?$/.test(file) || NOT_UI_SOURCE.test(file)) continue;
    if (file.endsWith('.css')) css.push({ file, text: readFileSync(join(ui, rel), 'utf8') });
    else if (file.endsWith('.tsx') || file.endsWith('.ts')) ts.push({ file, text: readFileSync(join(ui, rel), 'utf8') });
  }
  return { css, ts };
}

/** All static rule ids and what each one counts. The key is the rule id the baseline uses. */
export const STATIC_RULES = {
  'R1': 'raw px or rem in padding, margin or gap declarations (CSS)',
  'R1.tsx': 'raw spacing literals in inline style objects (TSX)',
  'R3': 'gap declarations off the spacing scale (CSS)',
  'R4.heading': 'headings that do not open with a picture',
  'R4.section': 'shared <Section> without an icon',
  'R4.row': 'shared <Row> without a lead',
  'R4.hidden-glyph': 'CSS rules that hide an icon',
  'R5.basic-kit': '"Basic kit" shown without the basicKit glyph',
  'R5.status': 'officer status drawn by hand, not by StatusMark',
  'R5.outcome': 'outcome drawn by hand, not by OutcomeMark',
  'R5.forecast': 'outcome rows that open with words, not an OutcomeMark',
  'R7.sub14': 'font-size declarations under 14px (CSS)',
  'R7.floor': 'font sizes under 12px (CSS and TSX)',
  'R7.dynamic': 'inline fontSize formulas that need a classified floor (TSX)',
  'R8': 'literal colors outside theme.css (CSS and TS)',
  'R8.mask': 'literal colors in mask properties, the alpha-only exception',
  'R9.size': '<Icon size> outside 16, 20 and 24',
  'R9.stroke': '<Icon strokeWidth> other than 1.75',
  'R9.dynamic': '<Icon size> given an expression',
  'R9.css': 'CSS rules that size an icon outside 16, 20 and 24',
  'R10.redefinition': 'rules outside the owner that set a shared component\'s look',
  'R10.badge': 'badge-shaped rules outside the chip family',
  'R10.switch': 'switches built by hand instead of one shared component',
  'R11.empty': 'bespoke empty states outside EmptyState',
  'R11.error': 'error messages built by hand',
};

/** Run every static detector over src/ui. Returns { ruleId: Finding[] }. */
export function collectStatic(root) {
  const { css, ts } = loadSources(root);
  /** @type {Record<string, Finding[]>} */
  const out = Object.fromEntries(Object.keys(STATIC_RULES).map((id) => [id, []]));
  const add = (id, findings) => out[id].push(...findings);
  for (const { file, text } of css) {
    const spacing = spacingFindings(file, text);
    add('R1', spacing.R1); add('R3', spacing.R3);
    const sizes = textSizeFindings(file, text);
    add('R7.sub14', sizes.filter((f) => f.kind === 'sub14' || f.kind === 'floor')); add('R7.floor', sizes.filter((f) => f.kind === 'floor'));
    const colors = cssColorFindings(file, text);
    add('R8', colors.filter((f) => f.kind === 'color')); add('R8.mask', colors.filter((f) => f.kind === 'mask'));
    add('R9.css', iconCssFindings(file, text));
    add('R4.hidden-glyph', hiddenGlyphFindings(file, text));
    const variants = variantFindings(file, text);
    add('R10.redefinition', variants.redefinition); add('R10.badge', variants.badge);
  }
  for (const { file, text } of ts) {
    add('R8', tsColorFindings(file, text));
    if (!file.endsWith('.tsx')) continue;
    add('R1.tsx', tsxSpacingFindings(file, text));
    const t = tsxTextFindings(file, text);
    add('R7.floor', t.filter((f) => f.kind === 'floor')); add('R7.sub14', t.filter((f) => f.kind === 'sub14')); add('R7.dynamic', t.filter((f) => f.kind === 'dynamic'));
    const icons = iconFindings(file, text);
    add('R9.size', icons.size); add('R9.stroke', icons.stroke); add('R9.dynamic', icons.dynamic);
    const leads = leadFindings(file, text);
    add('R4.heading', leads.heading); add('R4.section', leads.section); add('R4.row', leads.row);
    const kit = kitSemanticsFindings(file, text);
    add('R5.basic-kit', kit.basicKit); add('R5.status', kit.status); add('R5.outcome', kit.outcome); add('R5.forecast', kit.forecast);
    add('R10.switch', switchFindings(file, text));
    const states = stateFindings(file, text);
    add('R11.empty', states.empty); add('R11.error', states.error);
  }
  return out;
}

/** Findings as { file: count }. */
export function countByFile(findings) {
  const counts = {};
  for (const f of findings) counts[f.file] = (counts[f.file] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export { topLevelTokens };
