// The runtime import graph of the source tree, for the guards that keep the game's store out of
// the Scenario Lab (src/dev/lab/no-store.test.ts) and out of the player components the lab renders
// (src/ui/ui-store-free.test.ts), and for the layer rules in src/architecture/. src/ui/store.ts opens, ticks and saves the campaign as soon as it
// is imported, so either guard fails with the import chain that reaches it. Test support only:
// nothing in the game or the lab imports this file.

/** Every source module, keyed by its path from the project root ('/src/ui/store.ts'). */
export const SOURCES = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** The modules that must never load in the lab: the store, and the toast that imports it. */
export const STORE_MODULES = ['/src/ui/store.ts', '/src/ui/components/toast.tsx'];

/** Source without comments, keeping strings (so `// import` in a comment never counts). */
function stripComments(code: string): string {
  let out = '', i = 0, quote = '';
  while (i < code.length) {
    const c = code[i], next = code[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += next ?? ''; i += 2; continue; }
      if (c === quote) quote = '';
      i++;
      continue;
    }
    if (c === '/' && next === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (c === '/' && next === '*') { const end = code.indexOf('*/', i + 2); i = end < 0 ? code.length : end + 2; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    out += c;
    i++;
  }
  return out;
}

/** Module specifiers this file loads at runtime: static, side-effect, re-export, dynamic `import()`
 * and worker `new URL(…, import.meta.url)`. Type-only imports and re-exports are erased. */
export function runtimeImports(code: string): string[] {
  const src = stripComments(code);
  const found: string[] = [];
  for (const match of src.matchAll(/\b(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    const [, , typeOnly, clause, spec] = match;
    if (typeOnly) continue;
    const braces = /^\{([^}]*)\}$/.exec(clause.trim());
    if (braces && braces[1].split(',').map(part => part.trim()).filter(Boolean).every(part => part.startsWith('type '))) continue;
    found.push(spec);
  }
  for (const match of src.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) found.push(match[1]);
  for (const match of src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(match[1]);
  for (const match of src.matchAll(/new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g)) found.push(match[1]);
  return found;
}

/** A posix path with `.` and `..` folded. */
function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..') out.pop(); else if (part && part !== '.') out.push(part);
  }
  return `/${out.join('/')}`;
}

/** The source module a relative specifier names, or null for a package or a non-source file (CSS, JSON). */
export function resolveModule(from: string, spec: string): string | null {
  const base = normalize(`${from.slice(0, from.lastIndexOf('/'))}/${spec}`);
  // Vite leaves this file out of its own glob, so it is named here.
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (candidate in SOURCES || candidate === '/src/dev/import-graph.ts') return candidate;
  return null;
}

/** Every module reachable from the entries, with the module that first imported it, and the
 * relative specifiers that named no source file (other than stylesheets, JSON and images). */
export function walkImports(entries: readonly string[]): { parent: Map<string, string | null>; unresolved: string[] } {
  const parent = new Map<string, string | null>(entries.map(entry => [entry, null]));
  const queue = [...entries], unresolved: string[] = [];
  while (queue.length) {
    const file = queue.shift()!;
    for (const spec of runtimeImports(SOURCES[file] ?? '')) {
      if (!spec.startsWith('.')) continue;
      const target = resolveModule(file, spec);
      if (!target) { if (!/\.(css|json|svg|png)(\?|$)/.test(spec)) unresolved.push(`${file} → ${spec}`); continue; }
      if (!parent.has(target)) { parent.set(target, file); queue.push(target); }
    }
  }
  return { parent, unresolved };
}

/** The import chain from an entry to `file`, one module per line. */
export function importChain(parent: Map<string, string | null>, file: string): string {
  const links: string[] = [];
  for (let at: string | null | undefined = file; at; at = parent.get(at)) links.unshift(at);
  return links.join('\n  → ');
}
