// The runtime import graph of the source tree, for the guards that keep the game's store out of
// the Scenario Lab (src/dev/lab/no-store.test.ts) and out of the player components the lab renders
// (src/ui/ui-store-free.test.ts), and for the layer rules in src/architecture/. src/ui/store.ts
// opens, ticks and saves the campaign as soon as it is imported, so either guard fails with the
// import chain that reaches it. Imports are read from each file's syntax tree with the parser Vite
// already ships (oxc, `parseAst`), not matched by pattern, so a specifier inside a string, a
// template-string specifier and an `import()` with options are all read the way the bundler reads
// them. Test support only: nothing in the game or the lab imports this file.
import { parseAst } from 'vite';

/** Every source module, keyed by its path from the project root ('/src/ui/store.ts'). */
export const SOURCES = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** The modules that must never load in the lab: the store, and the toast that imports it. */
export const STORE_MODULES = ['/src/ui/store.ts', '/src/ui/components/toast.tsx'];

type Node = { type: string; [key: string]: unknown };
const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && typeof (value as Node).type === 'string';

/** A string literal or a template with no expressions: a specifier the bundler can resolve. */
function literal(node: unknown): string | null {
  if (!isNode(node)) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && !(node.expressions as unknown[]).length) return ((node.quasis as { value: { cooked: string } }[])[0]?.value.cooked) ?? null;
  return null;
}
/** A declaration the compiler erases: `import type`, `export type`, or braces naming only types. */
function typeOnly(node: Node): boolean {
  if (node.importKind === 'type' || node.exportKind === 'type') return true;
  const specifiers = (node.specifiers as Node[] | undefined) ?? [];
  return specifiers.length > 0 && specifiers.every(specifier => specifier.importKind === 'type' || specifier.exportKind === 'type');
}
const isImportMetaUrl = (node: unknown) => isNode(node) && node.type === 'MemberExpression'
  && isNode(node.object) && node.object.type === 'MetaProperty' && isNode(node.property) && node.property.name === 'url';

interface Scan { specs: string[]; computed: string[] }
const scans = new Map<string, Scan>();
/** Every module load in a file, read from its syntax tree (oxc, through Vite's parseAst), in source
 * order. A dynamic `import()` whose specifier is not a plain string lands in `computed`: the bundler
 * can't follow it, and neither can these rules. Cached by source text. */
function scan(code: string, file = 'module.tsx'): Scan {
  const key = `${file.endsWith('.ts') ? 'ts' : 'tsx'}\u0000${code}`;
  const hit = scans.get(key);
  if (hit) return hit;
  const found: Scan = { specs: [], computed: [] };
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { for (const child of node) visit(child); return; }
    if (!isNode(node)) return;
    if ((node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source) {
      if (!typeOnly(node)) found.specs.push(literal(node.source)!);
    } else if (node.type === 'ImportExpression') {
      const spec = literal(node.source);
      if (spec === null) found.computed.push(code.slice(node.start as number, node.end as number));
      else found.specs.push(spec);
    } else if (node.type === 'NewExpression' && isNode(node.callee) && node.callee.name === 'URL') {
      const [target, base] = node.arguments as unknown[];
      const spec = literal(target);
      if (spec !== null && isImportMetaUrl(base)) found.specs.push(spec);
    }
    for (const [field, child] of Object.entries(node)) if (field !== 'type' && typeof child === 'object') visit(child);
  };
  visit(parseAst(code, { lang: file.endsWith('.ts') ? 'ts' : 'tsx' }));
  scans.set(key, found);
  return found;
}

/** Module specifiers this file loads at runtime, in source order: static, side-effect, re-export,
 * dynamic `import()` (with or without options, string or plain template specifier) and worker
 * `new URL(…, import.meta.url)`. Type-only imports and re-exports are erased. Pass the file's
 * path so a `.ts` file parses as TypeScript, not TSX. */
export function runtimeImports(code: string, file?: string): string[] {
  return scan(code, file).specs;
}

/** Dynamic imports whose specifier is computed (`import(name)`, `import(\`./${x}\`)`): loads no
 * rule here can see. The architecture test keeps this list empty. */
export function computedImports(code: string, file?: string): string[] {
  return scan(code, file).computed;
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
    for (const spec of runtimeImports(SOURCES[file] ?? '', file)) {
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
