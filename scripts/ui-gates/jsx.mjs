// A JSX element scanner for the UI gates. TypeScript 7 ships without a JavaScript API, so this reads
// TSX source directly: it finds each opening tag (with its attributes), matches it to its closing tag
// and hands back the source range between them. It is not a full parser. A `<` counts as a tag when it
// is followed by a letter and does not follow an identifier or a closing bracket, which is how the
// code in src/ui writes JSX and how type arguments (`Array<string>`) and comparisons (`a <b`) differ.

const KEYWORDS_BEFORE_JSX = new Set(['return', 'case', 'default', 'else', 'yield', 'of', 'in', 'typeof', 'void', 'await', 'do']);

/** Blank block comments and whole-line or trailing `//` comments, keeping offsets. A `//` counts as
 * a comment only when whitespace or a line start precedes it, so URLs in strings survive. */
export function stripTsComments(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|\s)\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length)));
}

/** Index just past the `}` that closes the `{` at `from`, honoring strings and template literals. */
export function skipBraces(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") { i = skipString(src, i); continue; }
    if (ch === '`') { i = skipTemplate(src, i); continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) return i + 1; }
  }
  return -1;
}
function skipString(src, from) {
  const quote = src[from];
  for (let i = from + 1; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === quote || src[i] === '\n') return i;
  }
  return src.length;
}
function skipTemplate(src, from) {
  for (let i = from + 1; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === '`') return i;
    if (src[i] === '$' && src[i + 1] === '{') { const end = skipBraces(src, i + 1); if (end < 0) return src.length; i = end - 1; }
  }
  return src.length;
}

/**
 * @typedef {{ kind: 'str' | 'expr' | 'bool', value: string }} Attr
 * @typedef {{ name: string, attrs: Record<string, Attr>, start: number, openEnd: number, closeStart: number, end: number, selfClosing: boolean, line: number }} JsxElement
 */

/** @param {string} source  @returns {{ src: string, elements: JsxElement[], lineOf: (offset: number) => number }} */
export function scanJsx(source) {
  const src = stripTsComments(source);
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
  const lineOf = (offset) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
  const tokens = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '<') continue;
    if (src[i + 1] === '/') {
      const close = /^<\/([A-Za-z][\w.:-]*)\s*>/.exec(src.slice(i, i + 80));
      if (close) { tokens.push({ type: 'close', name: close[1], at: i, end: i + close[0].length }); i += close[0].length - 1; }
      continue;
    }
    if (!/[A-Za-z]/.test(src[i + 1] ?? '')) continue;
    let p = i - 1;
    while (p >= 0 && /\s/.test(src[p])) p--;
    const prev = src[p] ?? '';
    if (/[\w$)\]]/.test(prev)) {
      let w = p; while (w >= 0 && /[\w$]/.test(src[w])) w--;
      if (!KEYWORDS_BEFORE_JSX.has(src.slice(w + 1, p + 1))) continue;
    }
    const open = parseOpenTag(src, i);
    if (!open) continue;
    tokens.push({ type: 'open', ...open, at: i });
    i = open.end - 1;
  }
  /** @type {JsxElement[]} */
  const elements = [];
  const stack = [];
  for (const token of tokens) {
    if (token.type === 'open') {
      const element = { name: token.name, attrs: token.attrs, start: token.at, openEnd: token.end, closeStart: token.end, end: token.end, selfClosing: token.selfClosing, line: lineOf(token.at) };
      elements.push(element);
      if (!token.selfClosing) stack.push(element);
    } else {
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].name === token.name) { stack[s].closeStart = token.at; stack[s].end = token.end; stack.length = s; break; }
      }
    }
  }
  return { src, elements, lineOf };
}

function parseOpenTag(src, from) {
  const name = /^<([A-Za-z][\w.:-]*)/.exec(src.slice(from, from + 80));
  if (!name) return null;
  let i = from + name[0].length;
  const attrs = {};
  for (let guard = 0; guard < 400; guard++) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] === '/' && src[i + 1] === '>') return { name: name[1], attrs, end: i + 2, selfClosing: true };
    if (src[i] === '>') return { name: name[1], attrs, end: i + 1, selfClosing: false };
    if (src[i] === '{') { const end = skipBraces(src, i); if (end < 0) return null; i = end; continue; }
    const attr = /^[\w:-]+/.exec(src.slice(i, i + 80));
    if (!attr) return null;
    i += attr[0].length;
    if (src[i] !== '=') { attrs[attr[0]] = { kind: 'bool', value: '' }; continue; }
    i++;
    if (src[i] === '"' || src[i] === "'") { const end = skipString(src, i); attrs[attr[0]] = { kind: 'str', value: src.slice(i + 1, end) }; i = end + 1; }
    else if (src[i] === '{') { const end = skipBraces(src, i); if (end < 0) return null; attrs[attr[0]] = { kind: 'expr', value: src.slice(i + 1, end - 1).trim() }; i = end; }
    else return null;
  }
  return null;
}

/** The source between an element's tags. */
export const childrenOf = (src, element) => element.selfClosing ? '' : src.slice(element.openEnd, element.closeStart);

/** The smallest element whose tags contain `offset` (its own opening tag excluded), or null. */
export function enclosing(elements, offset) {
  let best = null;
  for (const el of elements) {
    if (el.selfClosing || offset < el.openEnd || offset >= el.closeStart) continue;
    if (!best || el.end - el.start < best.end - best.start) best = el;
  }
  return best;
}

/** The smallest element strictly around `element`. */
export function parentOf(elements, element) {
  let best = null;
  for (const el of elements) {
    if (el === element || el.selfClosing || el.start > element.start || el.end < element.end) continue;
    if (!best || el.end - el.start < best.end - best.start) best = el;
  }
  return best;
}

/** What a heading or row starts with, reading its children source: the name of the first element,
 * 'text' when words come first, or 'expr' for an expression that is not a conditional element. */
export function firstChild(children) {
  let rest = children;
  for (let guard = 0; guard < 20; guard++) {
    rest = rest.trimStart();
    if (!rest) return { kind: 'none' };
    if (rest.startsWith('{')) {
      const end = skipBraces(rest, 0);
      const inner = rest.slice(1, end < 0 ? undefined : end - 1).trim();
      if (!inner) { rest = rest.slice(end < 0 ? rest.length : end); continue; }
      const conditional = /^[\w$.!?()\s=&|<>'"-]*?&&\s*<([A-Za-z][\w.]*)/.exec(inner) ?? /^\(?\s*<([A-Za-z][\w.]*)/.exec(inner);
      if (conditional) return { kind: 'element', name: conditional[1] };
      return { kind: 'expr', text: inner.slice(0, 60) };
    }
    const tag = /^<([A-Za-z][\w.]*)/.exec(rest);
    if (tag) return { kind: 'element', name: tag[1] };
    return { kind: 'text', text: rest.slice(0, 40) };
  }
  return { kind: 'none' };
}

/** Component and tag names that draw a picture. A heading or row that opens with one has a lead. */
const VISUAL_NAME = /^(Icon|Spot|svg|img|Portrait|StatusMark|OutcomeMark|CallTypeBadge|RankInsignia|[A-Z]\w*(Art|ArtFrame|Mark|Badge|Glyph|Emblem|Insignia|Portrait|Icon|Spot|Medallion|Swatch))$/;
export const isVisualName = (name) => VISUAL_NAME.test(name);
