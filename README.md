# Tactically Idle: first playable (browser spike)

Portrait mobile department-management game with an idle economy and short branching operations on a data-driven blueprint. Design: [PLAN.md](PLAN.md). Location/operation contract: [docs/operation-model.md](docs/operation-model.md).

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

Every operation is a live call: it uses owned equipment, applies strain and injuries, and pays rewards and department service. The Ops board shows live incidents first, and the two standing assignments fill any open places. Practice runs, decision exercises, casebook replays and the daily featured operation were removed on 2026-10-06; save v8 ends any saved practice run as cancelled and drops practice records.

In an incident briefing, **Auto-equip** fills untouched loadout choices from usable stock, keeps manual quantities, and explains shortages. It never chooses or commits a story decision. See [auto-equip](docs/auto-equip.md).

New campaigns sample officers from the full 100-person catalog. Current calls use coherent scene variants with shared blueprint bindings. Content has one current version, using the v13 call-tree model. Compiled fingerprints catch regressions and are deliberately recaptured when content changes. See [campaign and choice variety](docs/campaign-choice-variety.md).

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

## Historical first-playable status (2026-10-01)

**Works and was observed on the real UI** (headless Chrome at 390×844 and 320×568; captures in [docs/captures](docs/captures)):

- One full department → operation → department loop. Prepare, deploy with reserved gear, three staged decisions, debrief, close. Rewards apply once, gear returns, and stress and XP land per officer.
- Two-squad deployment with a joint action (one squad acting, one supporting).
- The live screen follows the approved composition: blueprint, marker annotations that change with knowledge, painted portrait strip, amber decisions. It fits 390×844 without scrolling, and there's no horizontal scroll at 320px.

**Covered by the regression suite** (`npm test`):

- Offline equivalence, the 24h cap, and backward-clock checks.
- Hiring and dismissal, training and the tree, three-squad limits.
- Inventory integrity, interruption with no reroll, and geometry/rating relevance.
- Generation validity across 200 seeds.
- Cautious play wins one scenario and direct play wins the other.

**Not done or not proven:**

- Native device spike: no engine comparison, no touch hardware, no suspend/resume on a phone.
- Dispatch uses four tactical call trees on supported authored and procedural buildings. Maple Street remains test data only.
- The camera drone, a separate "change priorities" action, and team familiarity are not used in any scenario yet.
- Balance numbers are first-pass and directional only. There's been no playtest (acceptance 12 and 14).
- The authored roster has 100 distinct identities, each with an individual file portrait listed in `public/art/portraits/manifest.json`. Missing identities and image-loading failures use personnel-file cards. See [personnel and art integration](docs/art/roster-integration.md).
- Room shapes on the 320px map are smaller than 44px. Zoom and the Rooms list are the accessible path.

## Re-running the UI checks

Use a supported Node release (CI uses Node 24; local verification used Node 22). Run `npm ci`, then start the server with `npm run dev -- --host 127.0.0.1 --port 5174`. In another terminal, run `npm run test:e2e`.

The Playwright driver takes every starting board call and both standing assignments live at 390×844 with one squad and at 320×568 with two squads, buying the second squad's radios on the Prepare screen. It uses the real UI and isolated browser contexts. `playwright-core` is a declared development dependency; Google Chrome must be installed. Set `CHROME_PATH` for another Chrome executable or `TI_BASE_URL` for another server address. Set `TI_CAPTURE_DIR` and `TI_E2E_REPORT` to save screenshots and the JSON journey report. `node scripts/play-two-squads-320.mjs` runs only the smaller two-squad pass using the same driver.

The current incident catalog uses the v13 call-tree model. See [call trees](docs/call-trees-v13.md) for its structure. Older content generators and save migrations are not supported.
