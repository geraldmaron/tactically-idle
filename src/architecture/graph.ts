// The layer and system each module belongs to, and the runtime edges between layers. Test support.
import { resolveModule, runtimeImports, SOURCES } from '../dev/import-graph';
import { OWNERSHIP, type Layer, type System } from './manifest';

const globRe = (glob: string) => new RegExp(`^${glob
  .replace(/\{([^}]+)\}/g, (_, alts: string) => `\u0003${alts.split(',').join('\u0004')}\u0005`)
  .replace(/[.+^$()|[\]\\]/g, '\\$&')
  .replace(/\*\*\//g, '\u0001').replace(/\*\*/g, '\u0002').replace(/\*/g, '[^/]*')
  .replace(/\u0001/g, '(?:.*/)?').replace(/\u0002/g, '.*')
  .replace(/\u0003/g, '(?:').replace(/\u0004/g, '|').replace(/\u0005/g, ')')}$`);
export const RULES = OWNERSHIP.map(rule => ({ ...rule, re: globRe(rule.glob) }));
export const isSupport = (file: string) => /\.test\.tsx?$/.test(file) || /\.d\.ts$/.test(file);
// The graph module is left out of its own glob by Vite, so it is added here; it imports nothing local.
export const sourceFiles = () => [...new Set([...Object.keys(SOURCES), '/src/dev/import-graph.ts'])].filter(file => !isSupport(file)).sort();

export interface Owner { layer: Layer; system: System; glob: string }
export function ownerOf(file: string): Owner | null {
  return RULES.find(rule => rule.re.test(file)) ?? null;
}

export interface Edge { from: string; to: string; fromLayer: Layer; toLayer: Layer; fromSystem: System; toSystem: System }
/** Project-local specifiers: relative, or root-absolute (`/src/...`). Query suffixes are dropped. */
const local = (spec: string) => spec.startsWith('.') || spec.startsWith('/src/');
const targetOf = (file: string, spec: string) => {
  const bare = spec.split('?')[0];
  return bare.startsWith('/') ? resolveModule('/x', `.${bare}`) : resolveModule(file, bare);
};
const NON_SOURCE = /\.(css|json|svg|png|jpe?g|webp|html|md|txt)$/;

/** Local imports that name no source module: each one is an edge the layer rules can't see. */
export function unresolvedImports(): string[] {
  return sourceFiles().flatMap(file => runtimeImports(SOURCES[file] ?? '', file).filter(spec => local(spec) && !NON_SOURCE.test(spec.split('?')[0]) && !targetOf(file, spec)).map(spec => `${file} -> ${spec}`));
}

/** Every runtime import between two owned modules (type-only imports are erased and don't count). */
export function moduleEdges(): Edge[] {
  const edges: Edge[] = [];
  for (const file of sourceFiles()) {
    const from = ownerOf(file);
    if (!from) continue;
    for (const spec of runtimeImports(SOURCES[file] ?? '', file)) {
      if (!local(spec)) continue;
      const target = targetOf(file, spec);
      const to = target ? ownerOf(target) : null;
      if (!target || !to) continue;
      edges.push({ from: file, to: target, fromLayer: from.layer, toLayer: to.layer, fromSystem: from.system, toSystem: to.system });
    }
  }
  return edges;
}
export const layerEdges = () => moduleEdges().filter(edge => edge.fromLayer !== edge.toLayer);

/** `a -> b` for every pair of different systems with a runtime import between them, platform left out. */
export function systemEdges(): string[] {
  return [...new Set(moduleEdges().filter(edge => edge.fromSystem !== edge.toSystem && edge.fromSystem !== 'platform' && edge.toSystem !== 'platform').map(edge => `${edge.fromSystem} -> ${edge.toSystem}`))].sort();
}
