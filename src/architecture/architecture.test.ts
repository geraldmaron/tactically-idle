// Layer and ownership rules from manifest.ts, checked against the real runtime import graph.
// Run `npx vitest run src/architecture -u` to re-render docs/architecture.md after a manifest change.
import { describe, expect, it } from 'vitest';
import { computedImports, SOURCES } from '../dev/import-graph';
import { layerEdges, ownerOf, RULES, sourceFiles, systemEdges, unresolvedImports } from './graph';
import { LAYER_DEBT, LAYERS, SYSTEM_EDGES, SYSTEMS, type Layer } from './manifest';
import { renderArchitecture } from './render';

const allowed = (from: Layer, to: Layer) => (LAYERS[from].uses as readonly string[]).includes(to);

describe('architecture', () => {
  it('assigns every source module to a layer and a system', () => {
    const orphans = sourceFiles().filter(file => !ownerOf(file));
    expect(orphans, 'add an OWNERSHIP rule in src/architecture/manifest.ts').toEqual([]);
  });

  it('keeps every ownership rule in use', () => {
    const files = sourceFiles();
    const unused = RULES.filter(rule => !files.some(file => ownerOf(file)?.glob === rule.glob)).map(rule => rule.glob);
    expect(unused, 'delete ownership rules that own nothing').toEqual([]);
  });

  it('only imports downward through the layers', () => {
    const breaks = layerEdges().filter(edge => !allowed(edge.fromLayer, edge.toLayer)).map(edge => `${edge.from} -> ${edge.to}`);
    const fresh = [...new Set(breaks)].filter(key => !(key in LAYER_DEBT)).map(key => `${key} (${ownerOf(key.split(' -> ')[0])!.layer} may not import ${ownerOf(key.split(' -> ')[1])!.layer})`);
    expect(fresh, 'fix the import, or record it in LAYER_DEBT with a reason').toEqual([]);
  });

  it('shrinks the layer debt as it is paid', () => {
    // A debt entry must still be an import that the layer rules forbid: widening a layer's `uses`
    // to legalize it counts as paying it, and the entry has to go.
    const forbidden = new Set(layerEdges().filter(edge => !allowed(edge.fromLayer, edge.toLayer)).map(edge => `${edge.from} -> ${edge.to}`));
    const paid = Object.keys(LAYER_DEBT).filter(key => !forbidden.has(key));
    expect(paid, 'these are no longer forbidden imports: delete them from LAYER_DEBT').toEqual([]);
  });

  it('resolves every local import, so no edge escapes the rules', () => {
    expect(unresolvedImports(), 'a local import that names no source module').toEqual([]);
    const computed = sourceFiles().flatMap(file => computedImports(SOURCES[file] ?? '', file).map(load => `${file}: ${load}`));
    expect(computed, 'name the module in a dynamic import() literally, so the bundler and these rules can follow it').toEqual([]);
  });

  it('keeps the system dependency chain to the edges the manifest lists', () => {
    const live = systemEdges();
    expect(live.filter(edge => !SYSTEM_EDGES.includes(edge)), 'new coupling between systems: remove it, or add it to SYSTEM_EDGES with care').toEqual([]);
    expect(SYSTEM_EDGES.filter(edge => !live.includes(edge)), 'coupling removed: delete it from SYSTEM_EDGES').toEqual([]);
  });

  it('declares only layers that exist', () => {
    for (const [name, layer] of Object.entries(LAYERS)) for (const use of layer.uses) expect(Object.keys(LAYERS), `${name} uses ${use}`).toContain(use);
    expect(Object.keys(SYSTEMS).length).toBeGreaterThan(0);
  });

  it('keeps docs/architecture.md rendered from the manifest', async () => {
    await expect(renderArchitecture()).toMatchFileSnapshot('../../docs/architecture.md');
  }, 60_000);
});
