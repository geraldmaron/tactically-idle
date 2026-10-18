# Tactically Idle: first playable (browser spike)

Portrait mobile department-management game with an idle economy and short branching operations on a data-driven blueprint. Design: [PLAN.md](PLAN.md). Location/operation contract: [docs/operation-model.md](docs/operation-model.md).

Work still to do lives only in [docs/backlog.md](docs/backlog.md).

This is the browser application. Hosted phone-sized browser journeys have been checked; native device hardware and a native engine have not been validated.

## Run

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173 at a phone-sized viewport (390×844 is the design target).

```bash
npm test
```

```bash
npm run build
```

Use **Saves / New** below the header for ten local campaign slots, New Game, loading, named copies, and backup import/export. The active slot autosaves; starting or loading another campaign saves the current one first. Only saves from the current save and content version load; old saves are rejected. See [local campaigns](docs/local-campaigns.md).

Every operation is a live tactical call: it uses owned equipment, applies strain and injuries, and pays rewards and department service. The Ops board dispatches barricade, armed incident, hostage and protected rescue calls. Each current v13 call takes one squad; its squad range is derived from its choices.

In an incident briefing, **Auto-equip** fills untouched loadout choices from usable stock, keeps manual quantities, and explains shortages. It never chooses or commits a story decision. See [auto-equip](docs/auto-equip.md).

New campaigns sample officers from the full 100-person catalog. Calls bind people and physical moves to generated buildings; rescue sightlines come from geometry in `src/sim/sightlines.ts`. Content has one current version, using the [v13 call-tree model](docs/call-trees-v13.md). Compiled fingerprints catch regressions and are deliberately recaptured when content changes.

Radios load automatically at one per deployed officer. Gear offers an equipment-manager upgrade with discounted repairs, slower wear and explicitly enabled maintenance budgets. Blocked action details can request a timed stores delivery while squads remain staged outside. See [field readiness](docs/field-readiness.md). Maps support drag, pinch, wheel, keyboard navigation and Fit; the isolated [responsive harness](docs/responsive-layout.md) exercises real viewport widths.

Dev-only state handle in the browser console: `window.__ti.getState()`, `__ti.send(cmd)`. The blueprint visual harness is at `/harness.html` (`?only=map&w=358&seed=7&door=blocked`, `?only=portraits&n=100`). The Scenario Lab is at `/lab` (`npm run lab`, or the Lab link in the campaign bar): it plays any tactical call on the real engine with the hidden truth, odds and routes beside the game's own screens, and holds the call graph, ending shares, wiring lint, every line of text and the game's global tuning. See [Scenario Lab](docs/scenario-lab.md).

## Layout

| Path | What it owns |
| --- | --- |
| `src/sim/types.ts` | Shared records and the `Command` union (the contract every module builds against) |
| `src/sim/game.ts` | Transactional dispatcher: settle time, apply command to a draft, commit only on success |
| `src/sim/location*.ts`, `src/content/locations/` | Geometry derivation, seeded variations, validation. Maple Street lives in test fixtures |
| `src/sim/operation*.ts`, `resolution.ts`, `src/content/scenarios/` | Operation runs, action eligibility, resolution with traceable contributors, debrief |
| `src/sim/department*.ts`, `economy.ts`, `roster.ts`, `develop.ts`, `save.ts` | Economy and offline settlement, hiring, squads, training, development tree, saves |
| `src/sim/inventory.ts`, `officer.ts` | Reservations and settlement, stress bands and deployability |
| `src/ui/blueprint/`, `src/ui/portraits/` | SVG blueprint rendered from location data; painted portraits and personnel-file fallbacks |
| `src/ui/screens/` | HQ, Squad, Ops (board, prepare, live, debrief), Develop, Gear |
| `src/dev/lab/` | Scenario Lab, dev only (`/lab`): plays calls on the real engine beside what the player can't see; its shell, surfaces, models and workers. Saved tuning is `src/sim/tuning.json` (registry in `src/sim/tuning.ts`). See [docs/scenario-lab.md](docs/scenario-lab.md) |

## Current status

The browser game includes the department economy, recruitment, training, equipment, recovery and the prepare, deploy, decide and debrief loop. It has four squad slots, 100 officers and 16 Develop nodes. Command Staff v1 is on HQ with the Watch Commander, Training Sergeant and Quartermaster.

The four v13 call trees use generated buildings and one squad per call. Force requires a carried firearm and a qualified officer. Maple Street survives only in `src/sim/fixtures`. Architecture rules are enforced by `src/architecture/` and rendered to [docs/architecture.md](docs/architecture.md).

Remaining work and owner decisions live in [docs/backlog.md](docs/backlog.md).

## Re-running the UI checks

Use a supported Node release (CI uses Node 24; local verification used Node 22). Run `npm ci`, then start the server with `npm run dev -- --host 127.0.0.1 --port 5174`. In another terminal, run `npm run test:e2e`.

The Playwright driver uses the real UI and isolated browser contexts at 390×844 and 320×568. From a fresh department it checks the casebook's locked rows, takes every starting board call live through Prepare, the call and the debrief, and ends on an empty board. Each call sends as many ready squads as its Prepare screen says it takes; current v13 calls take one. `playwright-core` is a declared development dependency; Google Chrome must be installed. Set `CHROME_PATH` for another Chrome executable or `TI_BASE_URL` for another server address. Set `TI_CAPTURE_DIR` and `TI_E2E_REPORT` to save screenshots and the JSON journey report.

The current incident catalog uses the v13 call-tree model. See [call trees](docs/call-trees-v13.md) for its structure. Older content generators and save migrations are not supported.
