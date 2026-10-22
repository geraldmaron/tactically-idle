// A small CSS reader for the UI gates. It strips comments, walks rules and at-rules, and yields one
// record per declaration (not per line), so a gate counts what the stylesheet sets. It respects
// strings and parentheses, so a `;` or `{` inside url(data:...) never splits a declaration.

/** Replace comments with spaces, keeping newlines so offsets and line numbers stay true. */
export function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

/**
 * @typedef {{ file: string, selector: string, at: string[], prop: string, value: string, line: number, keyframes: boolean }} Declaration
 * @param {string} text
 * @param {string} file
 * @returns {Declaration[]}
 */
export function parseCss(text, file) {
  const src = stripCssComments(text);
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
  const lineOf = (offset) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
  const out = [];
  /** @type {{ head: string, isAt: boolean }[]} */
  const stack = [];
  let start = 0, parens = 0, quote = '';
  const emitDeclaration = (from, to) => {
    const raw = src.slice(from, to);
    if (!raw.trim()) return;
    const top = stack[stack.length - 1];
    if (!top || top.isAt && !/^@(font-face|page|property|counter-style)/.test(top.head)) return;
    const colon = raw.indexOf(':');
    if (colon < 0) return;
    const prop = raw.slice(0, colon).trim().toLowerCase();
    if (!prop || /\s/.test(prop)) return;
    const value = raw.slice(colon + 1).replace(/\s+/g, ' ').trim();
    const lead = raw.length - raw.trimStart().length;
    const at = stack.filter((s) => s.isAt).map((s) => s.head.replace(/\s+/g, ' '));
    const rules = stack.filter((s) => !s.isAt);
    out.push({
      file, prop, value, at, line: lineOf(from + lead),
      selector: (rules[rules.length - 1]?.head ?? top.head).replace(/\s+/g, ' '),
      keyframes: at.some((a) => /^@(-\w+-)?keyframes/.test(a)),
    });
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') { parens++; continue; }
    if (ch === ')') { parens = Math.max(0, parens - 1); continue; }
    if (parens) continue;
    if (ch === '{') {
      const head = src.slice(start, i).replace(/\s+/g, ' ').trim();
      stack.push({ head, isAt: head.startsWith('@') });
      start = i + 1;
    } else if (ch === '}') {
      emitDeclaration(start, i);
      stack.pop();
      start = i + 1;
    } else if (ch === ';') {
      emitDeclaration(start, i);
      start = i + 1;
    }
  }
  return out;
}

/** Split a value on top-level whitespace or commas, keeping function calls whole. */
export function topLevelTokens(value) {
  const tokens = [];
  let depth = 0, current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (!depth && (ch === ' ' || ch === ',')) { if (current) tokens.push(current); current = ''; continue; }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

/** The value with every var(...) removed, fallback included, so only literals remain. */
export const withoutVars = (value) => {
  let out = value;
  for (let guard = 0; guard < 8 && /var\(/.test(out); guard++) out = out.replace(/var\([^()]*\)/g, ' ');
  return out;
};

/** The value with url(...) contents removed (data URIs hold `;`, `#` and quotes that are not CSS). */
export const withoutUrls = (value) => value.replace(/url\((?:[^()"']|"[^"]*"|'[^']*')*\)/g, 'url()');
