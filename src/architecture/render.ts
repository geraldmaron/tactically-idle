// Renders docs/architecture.md from the manifest and the live import graph. Test support: the
// architecture test compares the output with the committed doc, and `vitest -u` rewrites it.
import { SOURCES } from '../dev/import-graph';
import { layerEdges, moduleEdges, ownerOf, sourceFiles } from './graph';
import { JOURNEYS, JOBS } from './journeys';
import { LAYER_DEBT, LAYERS, SYSTEM_EDGE_REASONS, SYSTEMS } from './manifest';
import { measureWiring } from './wiring';

const lines = (file: string) => (SOURCES[file] ?? '').split('\n').length;

export function renderArchitecture(): string {
  const files = sourceFiles();
  const out: string[] = [
    '# Architecture',
    '',
    'Generated from `src/architecture/` by its tests. Do not edit by hand: change the manifest, then run',
    '`npx vitest run src/architecture -u`. A test fails when the code and this page disagree.',
    '',
    '## Layers',
    '',
    'A module may import its own layer and the layers it lists. Type-only imports do not count. Imports are read from each file\'s',
    'syntax tree (`src/dev/import-graph.ts`, with the parser Vite ships), and a dynamic `import()` must name its module literally.',
    '',
    '| Layer | Modules | Lines | May import | Owns |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const [name, layer] of Object.entries(LAYERS)) {
    const own = files.filter(file => ownerOf(file)?.layer === name);
    out.push(`| ${name} | ${own.length} | ${own.reduce((n, file) => n + lines(file), 0)} | ${layer.uses.join(', ') || 'nothing'} | ${layer.summary} |`);
  }

  out.push('', '## Systems', '', '| System | Modules | Lines | Job |', '| --- | --- | --- | --- |');
  for (const [name, job] of Object.entries(SYSTEMS)) {
    const own = files.filter(file => ownerOf(file)?.system === name);
    out.push(`| ${name} | ${own.length} | ${own.reduce((n, file) => n + lines(file), 0)} | ${job} |`);
  }

  // System dependency chain: runtime imports between systems, platform left out as background.
  const counts = new Map<string, number>();
  for (const edge of moduleEdges()) {
    if (edge.fromSystem === edge.toSystem || edge.fromSystem === 'platform' || edge.toSystem === 'platform') continue;
    const key = `${edge.fromSystem} --> ${edge.toSystem}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  out.push('', '## System dependency chain', '', 'Runtime imports between systems (count of module edges). Platform is left out.', '', '```mermaid', 'flowchart LR');
  for (const [key, n] of [...counts].sort()) out.push(`  ${key.replace(' --> ', SYSTEM_EDGE_REASONS[key.replace('-->', '->')] === 'chain' ? ` -->|${n}| ` : ` -.->|${n} reversed| `)}`);
  const reversed = Object.entries(SYSTEM_EDGE_REASONS).filter(([, why]) => why !== 'chain');
  const chain = 'Solid edges follow the intended chain (the scenario reads the blueprint, people, officers and items; metrics read what happened).';
  out.push('```', '', reversed.length ? `${chain} Dotted edges run against it:` : `${chain} No edge runs against it.`);
  if (reversed.length) out.push('');
  for (const [edge, why] of reversed) out.push(`- \`${edge}\`: ${why.replace(/^Reversed: /, '')}`);

  out.push('', '## What moves the odds', '', 'Each input a system feeds into a choice\'s chance, and whether the engine actually reads it.',
    '`wiring.test.ts` perturbs the input on every opening choice of every call tree and checks the favorable chance moves (or, for a gap, that it still does not).', '',
    '| System | Input | Measured | Floor | Evidence |', '| --- | --- | --- | --- | --- |');
  for (const { probe, moved, choices } of measureWiring()) out.push(`| ${probe.system} | ${probe.input} | ${moved} of ${choices} | ${probe.status === 'live' ? `${Math.round(probe.minShare * 100)}%` : `gap: ${probe.gap}`} | ${probe.evidence} |`);

  out.push('', '## Jobs and journeys', '', '| Job | Journey | Covered by |', '| --- | --- | --- |');
  for (const journey of JOURNEYS) out.push(`| ${JOBS[journey.job]} | ${journey.title} | \`${journey.test}\` |`);

  const debt = Object.entries(LAYER_DEBT);
  out.push('', '## Layer debt', '', debt.length ? 'Imports that break the layer rules today. Each must shrink to zero.' : 'None.', '');
  if (debt.length) {
    out.push('| Import | Why it exists |', '| --- | --- |');
    for (const [key, why] of debt) out.push(`| \`${key}\` | ${why} |`);
  }
  out.push('', `Cross-layer runtime imports in total: ${layerEdges().length}.`, '');
  return out.join('\n');
}

