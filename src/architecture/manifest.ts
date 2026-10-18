// The architecture of Tactically Idle, as data. Tests read this file and fail when the code drifts
// from it (architecture.test.ts: layers and ownership; wiring.test.ts: which systems move the odds;
// journeys.test.ts: the jobs and journeys the game exists for). docs/architecture.md is rendered
// from it, so the doc can't go stale without a failing test.
//
// The pattern is the "fitness function" from evolutionary architecture: every rule here is
// executable, and every known violation sits on a ratchet list that may only shrink. When a
// violation is fixed, its entry must be deleted (the test says so); a new violation fails outright.
// Nothing in the game or the lab imports this folder.

/** Layers, lowest first. A module may import its own layer and the layers listed in `uses`. */
export const LAYERS = {
  kernel: { summary: 'Shared records, ids, seeded randomness, geometry and the tuning registry. No game rules.', uses: [] },
  world: { summary: 'Blueprints: authored and procedural buildings, rooms, openings, furniture, routes and sightlines.', uses: ['kernel'] },
  catalog: { summary: 'Authored data: officers, personas, items, courses, unlocks, call templates and call trees.', uses: ['kernel', 'world'] },
  scenario: { summary: 'Turns a drawn call into a playable definition: cast, placement on the blueprint, compiled tree.', uses: ['kernel', 'world', 'catalog'] },
  engine: { summary: 'Game rules and state: department, economy, operations, resolution, outcomes, saves.', uses: ['kernel', 'world', 'catalog', 'scenario', 'commerce'] },
  commerce: { summary: 'Point packs and the purchase ledger.', uses: ['kernel'] },
  qa: { summary: 'Content gates, balance measurement, fixtures and test support. Never loaded by the game.', uses: ['kernel', 'world', 'catalog', 'scenario', 'engine', 'commerce'] },
  ui: { summary: 'Player screens, the blueprint renderer, portraits and the store that dispatches commands.', uses: ['kernel', 'world', 'catalog', 'scenario', 'engine', 'commerce'] },
  lab: { summary: 'The dev-only Scenario Lab and dev sheets. Reads everything, never ships.', uses: ['kernel', 'world', 'catalog', 'scenario', 'engine', 'commerce', 'qa', 'ui'] },
  shell: { summary: 'Entry points that choose which app to mount.', uses: ['kernel', 'world', 'catalog', 'engine', 'ui', 'lab'] },
} as const satisfies Record<string, { summary: string; uses: readonly string[] }>;
export type Layer = keyof typeof LAYERS;

/** The systems the game is built from. A system is a slice through the layers that owns one job. */
export const SYSTEMS = {
  blueprint: 'Where things are: buildings, rooms, doors and windows, furniture, routes, cover and sightlines.',
  subject: 'Who is on scene: subjects, hostages, victims, bystanders and animals, their holds, weapons, temper and positions.',
  officer: 'Who the player sends: ratings, traits, stress, injuries, certifications, careers and squads.',
  item: 'What they carry: the item catalog, ratings and capabilities, inventory, wear, loadouts and resupply.',
  scenario: 'What happens: call trees, choices, chance per choice, branches, clocks and meters during a call.',
  metric: 'What it meant: outcome scoring, harm, debriefs, department reputation, money and progression.',
  platform: 'Everything that serves the systems above: records, randomness, saves, the store, screens and tooling.',
} as const;
export type System = keyof typeof SYSTEMS;

/** First match wins. Paths are from the project root; `**` matches any depth, `*` one segment. */
export const OWNERSHIP: readonly { glob: string; layer: Layer; system: System }[] = [
  // shell
  { glob: '/src/main.tsx', layer: 'shell', system: 'platform' },
  { glob: '/src/harness.tsx', layer: 'shell', system: 'platform' },
  { glob: '/src/lab-entry.ts', layer: 'shell', system: 'platform' },
  { glob: '/src/architecture/**', layer: 'qa', system: 'platform' },
  // lab and dev
  { glob: '/src/dev/import-graph.ts', layer: 'qa', system: 'platform' },
  { glob: '/src/dev/**', layer: 'lab', system: 'platform' },
  // qa
  { glob: '/src/gen/incident/gates/**', layer: 'qa', system: 'scenario' },
  { glob: '/src/gen/incident/trees-v13/balance.ts', layer: 'qa', system: 'scenario' },
  { glob: '/src/gen/incident/trees-v13/*-fixture.ts', layer: 'qa', system: 'scenario' },
  { glob: '/src/gen/building/procedural/suite.ts', layer: 'qa', system: 'blueprint' },
  { glob: '/src/gen/building/procedural/render-svg.ts', layer: 'qa', system: 'blueprint' },
  { glob: '/src/sim/fixtures/**', layer: 'qa', system: 'platform' },
  { glob: '/src/sim/test-fixtures.ts', layer: 'qa', system: 'platform' },
  { glob: '/src/sim/department-test-fixtures.ts', layer: 'qa', system: 'platform' },
  { glob: '/src/content/locations/*-fixture.ts', layer: 'qa', system: 'blueprint' },
  { glob: '/src/content/locations/test-fixtures.ts', layer: 'qa', system: 'blueprint' },
  // kernel
  { glob: '/src/sim/types.ts', layer: 'kernel', system: 'platform' },
  { glob: '/src/sim/scenario-types.ts', layer: 'kernel', system: 'scenario' },
  { glob: '/src/sim/rng.ts', layer: 'kernel', system: 'platform' },
  { glob: '/src/sim/geometry.ts', layer: 'kernel', system: 'blueprint' },
  // The tuning registries collect every engine table for the lab's tuning surface; only the lab loads them.
  { glob: '/src/sim/tuning-tables.ts', layer: 'lab', system: 'platform' },
  { glob: '/src/sim/tuning-meta.ts', layer: 'lab', system: 'platform' },
  { glob: '/src/sim/tuning.ts', layer: 'kernel', system: 'platform' },
  { glob: '/src/sim/calendar.ts', layer: 'kernel', system: 'platform' },
  // world (blueprint)
  { glob: '/src/gen/building/**', layer: 'world', system: 'blueprint' },
  { glob: '/src/content/locations/**', layer: 'world', system: 'blueprint' },
  { glob: '/src/content/materials.ts', layer: 'world', system: 'blueprint' },
  { glob: '/src/sim/location*.ts', layer: 'world', system: 'blueprint' },
  { glob: '/src/sim/furniture-path.ts', layer: 'world', system: 'blueprint' },
  { glob: '/src/sim/spatial.ts', layer: 'world', system: 'blueprint' },
  // catalog
  { glob: '/src/content/call-trees/**', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/incidents/**', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/scenarios/**', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/scenario-*.ts', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/unlocks.ts', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/items.ts', layer: 'catalog', system: 'item' },
  { glob: '/src/content/capabilities.ts', layer: 'catalog', system: 'item' },
  { glob: '/src/content/officers.ts', layer: 'catalog', system: 'officer' },
  { glob: '/src/content/personas.ts', layer: 'catalog', system: 'officer' },
  { glob: '/src/content/recruits.ts', layer: 'catalog', system: 'officer' },
  { glob: '/src/content/courses.ts', layer: 'catalog', system: 'officer' },
  { glob: '/src/content/dev-tree.ts', layer: 'catalog', system: 'metric' },
  { glob: '/src/content/american-english.ts', layer: 'catalog', system: 'platform' },
  // scenario generation
  { glob: '/src/gen/incident/**', layer: 'scenario', system: 'scenario' },
  // commerce
  { glob: '/src/commerce/**', layer: 'commerce', system: 'metric' },
  // engine, by system
  { glob: '/src/sim/spatial-factors.ts', layer: 'engine', system: 'blueprint' },
  { glob: '/src/sim/threat.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/incident-factors.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/force-*.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/drawn-*.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/equipment*.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/inventory*.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/auto-equip*.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/capabilities.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/officer*.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/roster*.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/career*.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/squad*.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/command-staff.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/outcome-score.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/economy.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/department*.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/develop*.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/casebook.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/clocks.ts', layer: 'engine', system: 'scenario' },
  { glob: '/src/sim/meters.ts', layer: 'engine', system: 'scenario' },
  { glob: '/src/sim/save*.ts', layer: 'engine', system: 'platform' },
  { glob: '/src/sim/campaign-*.ts', layer: 'engine', system: 'platform' },
  { glob: '/src/sim/game.ts', layer: 'engine', system: 'platform' },
  { glob: '/src/sim/environment.ts', layer: 'engine', system: 'blueprint' },
  { glob: '/src/sim/physical-care.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/story-people.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/story-movement.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/personnel.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/standard-kit.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/external-support.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/support-vehicles.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/hq-selectors.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/incident-consequences.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/session.ts', layer: 'engine', system: 'platform' },
  { glob: '/src/sim/story-bindings.ts', layer: 'engine', system: 'blueprint' },
  { glob: '/src/sim/story-context.ts', layer: 'engine', system: 'scenario' },
  { glob: '/src/sim/{action-result,authorization,commitments,incidents,operation,operation-selectors,resolution,response-failure,scenario-registry}.ts', layer: 'engine', system: 'scenario' },
  // ui
  { glob: '/src/ui/blueprint/**', layer: 'ui', system: 'blueprint' },
  { glob: '/src/ui/portraits/**', layer: 'ui', system: 'officer' },
  { glob: '/src/ui/people/**', layer: 'ui', system: 'officer' },
  { glob: '/src/ui/storefront/**', layer: 'ui', system: 'item' },
  // Every other screen and component is the ui layer by location; its system label is informational.
  { glob: '/src/ui/**', layer: 'ui', system: 'platform' },
];

/** Runtime imports that break the layer rules today. Each entry is a debt with a reason; the test
 * fails when an entry no longer occurs (delete it) and when a new break appears (fix it or justify
 * it here). Keys are `from -> to` module paths. */
export const LAYER_DEBT: Readonly<Record<string, string>> = {
  '/src/gen/building/procedural/generate.ts -> /src/sim/spatial-factors.ts': 'Routing mixes geometric reachability (world) with traversal and forcing policy: speed, materials, tool effectiveness, keys (engine). Split reachability into the world layer and pass policy in.',
  '/src/gen/incident/instance.ts -> /src/sim/spatial-factors.ts': 'coverOnLine is pure geometry kept in the engine module; move it to the world layer.',
  '/src/gen/incident/trees-v13/compile.ts -> /src/sim/spatial-factors.ts': 'Same split as generate.ts: routeAlongOpenings carries forcing policy with its geometry.',
  '/src/gen/incident/trees-v13/compile.ts -> /src/sim/story-bindings.ts': 'Room and route binding for a call is scenario placement, kept in the engine; move story-bindings to the scenario layer.',
  '/src/gen/incident/trees-v13/compile.ts -> /src/sim/drawn-effects.ts': 'Cascade definitions (keys, combos, variants) are the scenario model, mixed with the engine\'s draw; split definitions from the roll.',
  '/src/gen/incident/trees-v13/graph.ts -> /src/sim/drawn-effects.ts': 'Same split: graph reads cascade definitions.',
  '/src/gen/incident/trees-v13/compile.ts -> /src/sim/incidents.ts': 'Reward scaling by tier is economy policy reached from the compiler; pass it in or move it to the catalog.',
  '/src/gen/incident/trees-v13/path-key.ts -> /src/sim/meters.ts': 'Meter stances are scenario model kept in the engine module.',
  '/src/content/recruits.ts -> /src/sim/career.ts': 'Recruit generation reads career tuning from the engine; move CAREER_TUNING to the catalog or kernel.',
};

/** Runtime imports between systems (platform left out), and why each exists. The intended chain:
 * the scenario reads the blueprint, the people on it, the officers and the items, and metrics read
 * what happened. An edge marked `chain` follows it; any other value is a reversed edge, a debt,
 * named for what it couples. The architecture test fails on a new edge and on a listed edge that
 * is gone. */
export const SYSTEM_EDGE_REASONS: Readonly<Record<string, string>> = {
  'scenario -> blueprint': 'chain',
  'scenario -> subject': 'chain',
  'scenario -> officer': 'chain',
  'scenario -> item': 'chain',
  'scenario -> metric': 'chain',
  'subject -> blueprint': 'chain',
  'metric -> blueprint': 'chain',
  'metric -> item': 'chain',
  'metric -> officer': 'chain',
  'metric -> scenario': 'chain',
  'metric -> subject': 'chain',
  'officer -> item': 'chain',
  'item -> blueprint': 'chain',
  'blueprint -> subject': 'Reversed: story placement in the blueprint layer reads people.',
  'item -> metric': 'Reversed: equipment reads department money and levels directly.',
  'item -> officer': 'Reversed: equipment checks officer certifications itself.',
  'item -> scenario': 'Reversed: equipment rules read scenario actions and runs.',
  'item -> subject': 'Reversed: force tools read subjects.',
  'officer -> metric': 'Reversed: careers read department progression.',
  'officer -> scenario': 'Reversed: officer state reads operation runs.',
  'subject -> item': 'Reversed: subject threat rules read carried equipment.',
  'subject -> scenario': 'Reversed: subject rules read scenario runs and actions.',
};
export const SYSTEM_EDGES: readonly string[] = Object.keys(SYSTEM_EDGE_REASONS);
