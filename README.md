# Tactically Idle: first playable (browser spike)

Portrait mobile department-management game with an idle economy and short branching operations on a data-driven blueprint. Design: [PLAN.md](PLAN.md). Location/operation contract: [docs/operation-model.md](docs/operation-model.md).

This is the browser side of the plan's device spike. No native engine has been chosen, and nothing here has run on a phone.

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

Use **Saves / New** below the header for ten local campaign slots, New Game, loading, named copies, and backup import/export. The active slot autosaves; starting or loading another campaign saves the current one first. Existing single-slot saves migrate into slot 1 and keep their original recovery data. See [local campaigns](docs/local-campaigns.md).

In an incident briefing, **Auto-equip** fills untouched loadout choices from usable stock, keeps manual quantities, and explains shortages. See [auto-equip](docs/auto-equip.md).

Dev-only state handle in the browser console: `window.__ti.getState()`, `__ti.send(cmd)`. The blueprint visual harness is at `/harness.html` (`?only=map&w=358&seed=7&door=blocked`, `?only=portraits&n=100`).

## Layout

| Path | What it owns |
| --- | --- |
| `src/sim/types.ts` | Shared records and the `Command` union (the contract every module builds against) |
| `src/sim/game.ts` | Transactional dispatcher: settle time, apply command to a draft, commit only on success |
| `src/sim/location*.ts`, `src/content/locations/` | Geometry derivation, seeded variations, validation. Maple Street is authored data |
| `src/sim/operation*.ts`, `resolution.ts`, `src/content/scenarios/` | Operation runs, action eligibility, resolution with traceable contributors, debrief |
| `src/sim/department*.ts`, `economy.ts`, `roster.ts`, `develop.ts`, `save.ts` | Economy and offline settlement, hiring, squads, training, development tree, saves |
| `src/sim/inventory.ts`, `officer.ts` | Reservations and settlement, stress bands and deployability |
| `src/ui/blueprint/`, `src/ui/portraits/` | SVG blueprint rendered from location data; painted and procedural portraits |
| `src/ui/screens/` | HQ, Squad, Ops (board, prepare, live, debrief), Develop, Gear |

## Status against the plan (2026-10-01)

**Works and was observed on the real UI** (headless Chrome at 390×844 and 320×568; captures in [docs/captures](docs/captures)):

- One full department → operation → department loop. Prepare, deploy with reserved gear, three staged decisions, debrief, close. Rewards apply once, gear returns, and stress and XP land per officer.
- Two-squad deployment with a joint action (one squad acting, one supporting).
- The live screen follows the approved composition: blueprint, marker annotations that change with knowledge, painted portrait strip, amber decisions. It fits 390×844 without scrolling, and there's no horizontal scroll at 320px.

**Covered by unit tests only** (159 passing, `npm test`):

- Offline equivalence, the 24h cap, and backward-clock checks.
- Hiring and dismissal, training and the tree, three-squad limits.
- Inventory integrity, interruption with no reroll, and geometry/rating relevance.
- Generation validity across 200 seeds.
- Cautious play wins one scenario and direct play wins the other.

**Not done or not proven:**

- Native device spike: no engine comparison, no touch hardware, no suspend/resume on a phone.
- Content beyond the slice: one layout and two scenarios exist; the "Next" row wants three layouts and six scenarios.
- The camera drone, a separate "change priorities" action, and team familiarity are not used in any scenario yet.
- Balance numbers are first-pass and directional only. There's been no playtest (acceptance 12 and 14).
- The authored roster has 100 distinct identities. Portrait availability is explicit in `public/art/portraits/manifest.json`; remaining people use intentional personnel-file cards. See [personnel and art integration](docs/art/roster-integration.md).
- Room shapes on the 320px map are smaller than 44px. Zoom and the Rooms list are the accessible path.

## Re-running the UI checks

`scripts/play-loop.mjs` and `scripts/play-two-squads-320.mjs` drive the running dev server with installed Google Chrome via `playwright-core`. That package is not a project dependency, so install it outside the repo or with `npm i --no-save playwright-core`, then run `node scripts/play-loop.mjs 390x844`. Screenshots land in the working directory.
