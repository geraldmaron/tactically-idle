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
  engine: { summary: 'Game rules and state: department, economy, operations, resolution, outcomes, saves.', uses: ['kernel', 'world', 'catalog', 'scenario'] },
  qa: { summary: 'Content gates, balance measurement, fixtures and test support. Never loaded by the game.', uses: ['kernel', 'world', 'catalog', 'scenario', 'engine'] },
  ui: { summary: 'Player screens, the blueprint renderer, portraits and the store that dispatches commands.', uses: ['kernel', 'world', 'catalog', 'scenario', 'engine'] },
  lab: { summary: 'The dev-only Scenario Lab and dev sheets. Reads everything, never ships.', uses: ['kernel', 'world', 'catalog', 'scenario', 'engine', 'qa', 'ui'] },
  shell: { summary: 'Entry points that choose which app to mount.', uses: ['kernel', 'world', 'catalog', 'engine', 'ui', 'lab'] },
} as const satisfies Record<string, { summary: string; uses: readonly string[] }>;
export type Layer = keyof typeof LAYERS;

/** The systems the game is built from. A system is a slice through the layers that owns one job. */
export const SYSTEMS = {
  blueprint: 'Where things are: buildings, rooms, doors and windows, furniture, routes, cover and sightlines.',
  subject: 'Who is on scene: subjects, hostages, victims, bystanders and animals, their holds, weapons, temper (agitation and rapport) and positions.',
  officer: 'Who the player sends: ratings, traits, stress, injuries, certifications, careers and squads.',
  item: 'What they carry: the item catalog, ratings and capabilities, force risk, inventory and wear.',
  scenario: 'What happens: call trees, placement on the blueprint, choices, chance per choice, branches and clocks, and the call-time logistics (loadouts, resupply, outside support) that read the items.',
  metric: 'What it meant: outcome scoring, harm, debriefs, department reputation, money and progression, and the Command Staff who run the department.',
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
  // The call graph and path key read finished calls and runs for the lab and the tests; no call is built from them.
  { glob: '/src/gen/incident/trees-v13/{graph,path-key}.ts', layer: 'qa', system: 'scenario' },
  { glob: '/src/gen/building/procedural/suite.ts', layer: 'qa', system: 'blueprint' },
  { glob: '/src/gen/building/procedural/render-svg.ts', layer: 'qa', system: 'blueprint' },
  { glob: '/src/sim/fixtures/**', layer: 'qa', system: 'platform' },
  { glob: '/src/sim/test-fixtures.ts', layer: 'qa', system: 'platform' },
  { glob: '/src/sim/department-test-fixtures.ts', layer: 'qa', system: 'platform' },
  { glob: '/src/content/locations/*-fixture.ts', layer: 'qa', system: 'blueprint' },
  { glob: '/src/content/locations/test-fixtures.ts', layer: 'qa', system: 'blueprint' },
  // kernel
  { glob: '/src/sim/types.ts', layer: 'kernel', system: 'platform' },
  // The scenario record schema, shared like types.ts: every system reads it, so it is platform.
  { glob: '/src/sim/scenario-types.ts', layer: 'kernel', system: 'platform' },
  { glob: '/src/sim/rng.ts', layer: 'kernel', system: 'platform' },
  { glob: '/src/sim/geometry.ts', layer: 'kernel', system: 'blueprint' },
  // The tuning registries collect every engine table for the lab's tuning surface; only the lab loads them.
  { glob: '/src/sim/tuning-tables.ts', layer: 'lab', system: 'platform' },
  { glob: '/src/sim/tuning-meta.ts', layer: 'lab', system: 'platform' },
  { glob: '/src/sim/tuning.ts', layer: 'kernel', system: 'platform' },
  { glob: '/src/sim/calendar.ts', layer: 'kernel', system: 'platform' },
  { glob: '/src/sim/crew-flags.ts', layer: 'kernel', system: 'officer' },
  { glob: '/src/sim/format.ts', layer: 'kernel', system: 'platform' },
  { glob: '/src/sim/squad-names.ts', layer: 'kernel', system: 'platform' },
  { glob: '/src/sim/conditions.ts', layer: 'kernel', system: 'platform' },
  // world (blueprint)
  { glob: '/src/gen/building/**', layer: 'world', system: 'blueprint' },
  { glob: '/src/content/locations/**', layer: 'world', system: 'blueprint' },
  { glob: '/src/content/materials.ts', layer: 'world', system: 'blueprint' },
  { glob: '/src/sim/location*.ts', layer: 'world', system: 'blueprint' },
  { glob: '/src/sim/furniture-path.ts', layer: 'world', system: 'blueprint' },
  { glob: '/src/sim/spatial.ts', layer: 'world', system: 'blueprint' },
  { glob: '/src/sim/{routes,cover,sightlines}.ts', layer: 'world', system: 'blueprint' },
  // catalog
  { glob: '/src/content/call-trees/**', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/content-descriptors.ts', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/incidents/**', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/scenarios/**', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/scenario-*.ts', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/unlocks.ts', layer: 'catalog', system: 'scenario' },
  // The city's invented names (apps, the stream site, the news) that call text binds.
  { glob: '/src/content/world.ts', layer: 'catalog', system: 'scenario' },
  { glob: '/src/content/traits.ts', layer: 'catalog', system: 'officer' },
  { glob: '/src/content/items.ts', layer: 'catalog', system: 'item' },
  { glob: '/src/content/capabilities.ts', layer: 'catalog', system: 'item' },
  // What each officer brings: chosen from the item catalog by role and certification (starter-kit).
  { glob: '/src/content/issue-kit.ts', layer: 'catalog', system: 'item' },
  { glob: '/src/content/officers.ts', layer: 'catalog', system: 'officer' },
  { glob: '/src/content/personas.ts', layer: 'catalog', system: 'officer' },
  { glob: '/src/content/recruits.ts', layer: 'catalog', system: 'officer' },
  // The rank ladder: titles, XP thresholds and what a promotion gives (the rules are sim/ranks.ts).
  { glob: '/src/content/ranks.ts', layer: 'catalog', system: 'officer' },
  { glob: '/src/content/courses.ts', layer: 'catalog', system: 'officer' },
  { glob: '/src/content/certs.ts', layer: 'catalog', system: 'officer' },
  { glob: '/src/content/dev-tree.ts', layer: 'catalog', system: 'metric' },
  { glob: '/src/content/american-english.ts', layer: 'catalog', system: 'platform' },
  // scenario generation
  { glob: '/src/gen/incident/**', layer: 'scenario', system: 'scenario' },
  // engine, by system. Call-time logistics (what a squad carries into this call, resupply on
  // scene, outside services and support vehicles, what an action asks of equipment and what a
  // capability adds to it) belong to the scenario that reads the items, not to the item system.
  { glob: '/src/sim/{auto-equip,equipment-resupply,equipment-requirements,capabilities,external-support,support-vehicles}.ts', layer: 'engine', system: 'scenario' },
  // Drawn consequences settle a committed choice's variant: the scenario's chance per choice.
  { glob: '/src/sim/drawn-effects.ts', layer: 'engine', system: 'scenario' },
  // The equipment manager is a department upgrade run by Command Staff, priced from the development tree.
  { glob: '/src/sim/equipment-manager*.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/spatial-factors.ts', layer: 'engine', system: 'blueprint' },
  { glob: '/src/sim/threat.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/incident-factors.ts', layer: 'engine', system: 'subject' },
  // Force risk is what a force tool does to the person it is used on: a property of the item.
  { glob: '/src/sim/force-*.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/equipment*.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/inventory*.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/officer*.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/roster*.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/career*.ts', layer: 'engine', system: 'officer' },
  // The one writer of officer XP, and promotions.
  { glob: '/src/sim/ranks.ts', layer: 'engine', system: 'officer' },
  // Instructor details: what an officer earns teaching for a neighbouring department (officer-value).
  { glob: '/src/sim/detail.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/squad*.ts', layer: 'engine', system: 'officer' },
  // Command Staff are hired managers who run department loops; they never go on calls.
  { glob: '/src/sim/command-staff.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/staff-pool.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/staff-fixtures.ts', layer: 'qa', system: 'platform' },
  { glob: '/src/sim/outcome-score.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/economy.ts', layer: 'engine', system: 'metric' },
  // Patrol employees are a department workforce and funding loop. They never join tactical squads.
  { glob: '/src/sim/patrol.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/department*.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/develop*.ts', layer: 'engine', system: 'metric' },
  // Development milestones: each tier granted free when its UnlockRule holds.
  { glob: '/src/sim/grants.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/casebook.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/reputation.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/player-profile.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/pressure-sources.ts', layer: 'engine', system: 'scenario' },
  { glob: '/src/sim/clocks.ts', layer: 'engine', system: 'scenario' },
  { glob: '/src/sim/timer-setting.ts', layer: 'engine', system: 'scenario' },
  // Agitation and rapport are a subject's temper.
  { glob: '/src/sim/meters.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/crew.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/save*.ts', layer: 'engine', system: 'platform' },
  // The department's books: every system that spends or earns posts here, like it saves through save.ts.
  { glob: '/src/sim/ledger.ts', layer: 'engine', system: 'platform' },
  // The open shift report: careers, grants and settlement all add lines to it.
  { glob: '/src/sim/shift-report.ts', layer: 'engine', system: 'platform' },
  { glob: '/src/sim/campaign-*.ts', layer: 'engine', system: 'platform' },
  { glob: '/src/sim/game.ts', layer: 'engine', system: 'platform' },
  { glob: '/src/sim/environment.ts', layer: 'engine', system: 'blueprint' },
  { glob: '/src/sim/physical-care.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/story-people.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/story-movement.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/sightings.ts', layer: 'engine', system: 'subject' },
  { glob: '/src/sim/personnel.ts', layer: 'engine', system: 'officer' },
  { glob: '/src/sim/basic-kit.ts', layer: 'engine', system: 'item' },
  { glob: '/src/sim/hq-selectors.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/incident-consequences.ts', layer: 'engine', system: 'metric' },
  { glob: '/src/sim/session.ts', layer: 'engine', system: 'platform' },
  { glob: '/src/sim/story-context.ts', layer: 'engine', system: 'scenario' },
  { glob: '/src/sim/{action-result,authorization,commitments,incidents,operation,operation-selectors,resolution,response-failure,scenario-registry}.ts', layer: 'engine', system: 'scenario' },
  // What the board suggests bringing, read from a call type's authored tree and the department, never from a drawn call.
  { glob: '/src/sim/board-suggestions.ts', layer: 'engine', system: 'scenario' },
  // ui
  { glob: '/src/ui/blueprint/**', layer: 'ui', system: 'blueprint' },
  { glob: '/src/ui/portraits/**', layer: 'ui', system: 'officer' },
  // The lexicon colors names in call text: the call's cast and the officers on it.
  { glob: '/src/ui/people/{lexicon,PeopleText}.{ts,tsx}', layer: 'ui', system: 'scenario' },
  { glob: '/src/ui/people/**', layer: 'ui', system: 'officer' },
  // The storefront is where department money is spent: equipment, training and development.
  { glob: '/src/ui/storefront/**', layer: 'ui', system: 'metric' },
  // Every other screen and component is the ui layer by location; its system label is informational.
  { glob: '/src/ui/**', layer: 'ui', system: 'platform' },
];

/** Runtime imports that break the layer rules today. Each entry is a debt with a reason; the test
 * fails when an entry no longer occurs (delete it) and when a new break appears (fix it or justify
 * it here). Keys are `from -> to` module paths. */
export const LAYER_DEBT: Readonly<Record<string, string>> = {
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
  // An officer arrives with issue kit and the signing pays for it (starter-kit, owner decision 2026-10-19).
  'officer -> item': 'issue kit: a hire brings items into the pool, priced into the signing',
};
export const SYSTEM_EDGES: readonly string[] = Object.keys(SYSTEM_EDGE_REASONS);
