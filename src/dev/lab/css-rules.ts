// A small CSS reader for the isolation guards (css-scope.test.ts, game-css-guard.test.ts): every
// style rule's selectors, with the at-rules around it. It reads plain CSS as this repo writes it;
// a nested style rule (CSS nesting) is reported as such, so a guard fails loudly instead of skipping it.
// Test support only: nothing in the lab imports it.

export interface CssSelector { selector: string; at: string[]; line: number }
export interface CssRead { selectors: CssSelector[]; nested: CssSelector[] }

/** At-rules whose blocks hold style rules. Everything else (@keyframes, @font-face, @property) is skipped. */
const GROUPING = /^@(media|supports|container|layer|scope|document)\b/;

/** Splits on commas that are not inside (), [] or quotes. */
export function splitSelectorList(list: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = '', start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { out.push(list.slice(start, i).trim()); start = i + 1; }
  }
  out.push(list.slice(start).trim());
  return out.filter(Boolean);
}

/** The leftmost compound selector: everything before the first combinator outside () and []. */
export function firstCompound(selector: string): string {
  let depth = 0, quote = '';
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && (c === ' ' || c === '>' || c === '+' || c === '~' || c === '\n' || c === '\t')) return selector.slice(0, i);
  }
  return selector;
}

/** Class names in a compound, outside :not() and other functional pseudo-classes' arguments too. */
export const classesOf = (compound: string): string[] => [...compound.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(match => match[1]);

export function readCss(source: string): CssRead {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '));
  const selectors: CssSelector[] = [], nested: CssSelector[] = [];
  let i = 0;
  const lineAt = (at: number) => css.slice(0, at).split('\n').length;

  /** Skips a balanced block starting just after its `{`; returns whether a nested `{` was inside. */
  const skipBlock = (): { inner: boolean; body: string } => {
    let depth = 1, inner = false, quote = '';
    const from = i;
    while (i < css.length && depth) {
      const c = css[i++];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === '{') { depth++; inner = true; }
      else if (c === '}') depth--;
    }
    return { inner, body: css.slice(from, i - 1) };
  };

  const walk = (at: string[]) => {
    let prelude = '', preludeStart = i;
    while (i < css.length) {
      const c = css[i];
      if (c === '}') { i++; return; }
      if (c === ';') { i++; prelude = ''; preludeStart = i; continue; }
      if (c === '"' || c === "'") {
        const end = css.indexOf(c, i + 1);
        prelude += css.slice(i, end + 1); i = end + 1; continue;
      }
      if (c === '{') {
        i++;
        const head = prelude.trim();
        const line = lineAt(preludeStart + (prelude.length - prelude.trimStart().length));
        if (head.startsWith('@')) {
          if (GROUPING.test(head)) walk([...at, head]); else skipBlock();
        } else {
          const block = skipBlock();
          for (const selector of splitSelectorList(head)) selectors.push({ selector, at, line });
          if (block.inner) nested.push({ selector: head, at, line });
        }
        prelude = ''; preludeStart = i;
        continue;
      }
      if (!prelude) preludeStart = i;
      prelude += c;
      i++;
    }
  };
  walk([]);
  return { selectors, nested };
}

interface NodeFs { readFileSync(path: string, encoding: 'utf8'): string; readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[] }
interface NodeProcess { cwd(): string; getBuiltinModule(id: 'node:fs'): NodeFs }

/** Every stylesheet under a directory (relative to the project root), keyed by its path inside it.
 * Read from disk: Vitest serves `.css?raw` as an empty string, which would make a guard pass on nothing. */
export function stylesheetsUnder(dir: string): Record<string, string> {
  const node = (globalThis as unknown as { process: NodeProcess }).process;
  const fs = node.getBuiltinModule('node:fs');
  const root = `${node.cwd()}/${dir}/`;
  const out: Record<string, string> = {};
  const visit = (sub: string) => {
    for (const entry of fs.readdirSync(`${root}${sub}`, { withFileTypes: true })) {
      const path = `${sub}${entry.name}`;
      if (entry.isDirectory()) visit(`${path}/`);
      else if (entry.name.endsWith('.css')) out[path] = fs.readFileSync(`${root}${path}`, 'utf8');
    }
  };
  visit('');
  return out;
}
