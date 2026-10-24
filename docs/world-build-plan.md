# World redesign build plan

Status: lead plan, 2026-10-24. Builds [world-redesign.md](world-redesign.md) and its canvas
(https://claude.ai/artifact/6kwXCJp2vknqx7xfrrEKoz). Owner: "Implement the plan and redesign. Use codex to
challenge adversarially, and no broad testing until all visual surfaces have been changed."

## Scope

Built in this pass, at slice depth but with the general modules:

- The world: five district definitions (Pike Street open at the start, the rest opened by department
  level), four crew archetypes as data, persistent subjects, flat-rate patrol contacts, cases with review
  clocks and one award per investigation, leads that never expire, warrants, the allocation factor and the
  funding scale, SWAT proactive shifts with a stress stop, the radio log.
- The people: canonical person records with rehire after a cooldown, jacket pages, memory facts, imprints
  with a real duration and no number, the aftercare fork, settled traits, bond states, ties, romance under
  its controls, debrief write-back.
- Calls from the world: a warrant or an armed contact the player answers becomes a call card that casts
  the known subject's name and shows an officer's tie; the tie adds one visible, capped contributor.
- Every visual surface in the night-city look and the new navigation: City, Operations, Team, HQ, Store.
- The lifetime Store catalog with local entitlements (no billing in the browser build), the 72-hour free
  offline window, settings for personal lives, purchases and backup.

Not built (owner decisions or later): moving tactical unlocks from funding to service, the alumni hall
across saves, real billing, cloud backup service, iOS Live Activity and widgets (browser build), new call
trees written for crews (warrants reuse the current call kinds).

## Rules for this pass

- No broad testing until every visual surface has changed: no `npm run verify`, `npm test`, e2e, UI gates
  or feel checks. Lanes run `npx tsc --noEmit -p .` and the unit tests of the new modules they write.
  Evidence for UI lanes is screenshots at 390 x 844 and 320 x 568 from their own dev server port.
- Codex challenges adversarially: this plan before any code, and the integrated diff before the broad
  test run. Sol (`-m gpt-6.1-sol`), read-only.
- One writer per file (COORDINATION.md). The lead writes the contract (wave 0) and every interface file.
- Saves: version 19; old saves are rejected (no-legacy rule before launch).
- Prose: officer and call strings follow the swat skills; no em or en dashes, colons only in stat rows and
  clock times; funding is the coin glyph and a number, never "$".

## The contract (wave 0, lead)

New kernel files, mapped as kernel in `src/architecture/manifest.ts`:

- `src/sim/world/types.ts`: `DistrictId`, `DistrictState`, `CrewArchetypeId`, `Crew`, `Subject`,
  `SubjectStatus`, `Case`, `CaseResolution`, `Lead`, `ProactiveShift`, `WorldEvent`, `WorldState`.
- `src/sim/people/types.ts`: `PersonRecord`, `MemoryFact`, `FactKind`, `Imprint`, `ImprintPackId`,
  `SettledTrait`, `BondState`, `Bond`, `Tie`, `PeopleBeat`, `PeopleState`.

Changes to `src/sim/types.ts` (interface file):

- `GameState.world: WorldState` and `GameState.people: PeopleState` (required from save 19).
- `IncidentCard.world?: { kind: 'warrant' | 'armed_contact'; leadId: Id; subjectId: Id; caseTier: 1|2|3|4 }`.
- `OperationRun.world?` copying the card's field at dispatch.
- `Ctx.entitlements?: { charter: boolean; nightWatch: boolean }`, read by settlement.
- `ShiftReport.world?: { contacts: number; casesOpened: number; casesClosed: number; awards: number; leads: Id[]; crime: Record<DistrictId, [before: number, after: number]> }`
  and `ShiftReport.people?: Id[]` (beat ids for the report).
- Commands: `setDistrictCoverage {districtId, units}`, `openDistrict {districtId}`, `startProactiveShift
  {squadId, districtId, hours}`, `recallProactiveShift {squadId}`, `openWarrant {leadId}`,
  `respondToContact {leadId}`, `decideAftercare {imprintId, choice, partnerId?}`, `acknowledgeBeat {beatId}`.

Stubs the lead lands so lanes plug in without sharing files:

- `src/sim/world/index.ts` exports `createWorld(seed, now)`, `settleWorld(d, from, to, acc, ctx)`,
  `applyWorldDebrief(d, run, result)`, `WORLD_HANDLERS`.
- `src/sim/people/index.ts` exports `createPeople(d)`, `settlePeople(d, from, to)`,
  `applyPeopleDebrief(d, run, result, verdict)`, `PEOPLE_HANDLERS`.
- `src/sim/game.ts` spreads `WORLD_HANDLERS` and `PEOPLE_HANDLERS`; `economy.settle` calls `settleWorld`
  and `settlePeople` once per settled interval; `operation.closeDebrief` calls both debrief hooks after the
  career loop; new campaigns call both create functions; `save.ts` bumps to 19 and validates both fields.

## Waves and lanes

All lanes are Sonnet subagents in their own worktree, cut from the wave's base. Each reports changed files,
typecheck result, its own unit test result and (UI) screenshots. The lead merges one at a time.

### Wave 1 (parallel, after wave 0)

| Lane | Writes only | Done |
| --- | --- | --- |
| world-engine | `src/sim/world/**` (not types.ts), `src/content/city/**`, `ECONOMY_TUNING` allocation and cap in `src/sim/economy.ts`, `src/sim/patrol.ts` (coverage reads) | districts, crews, subjects, contacts, cases, awards, leads, warrants, shifts, allocation factor, funding scale, radio events, selectors in `src/sim/world/selectors.ts`; unit tests for determinism (same seed and hours give the same events online and offline), no re-award, crime never raises net, shift stops before Overloaded |
| people-engine | `src/sim/people/**` (not types.ts), `src/content/people/**`, rehire rules in `src/sim/roster.ts` | records, jacket pages and reveal, facts from debriefs, imprint packs (8), the fork, settled traits with caps, bond states with causes, ties from jackets and arrests, romance eligibility (no supervision, both open, setting-independent mechanics), selectors in `src/sim/people/selectors.ts`; jacket text for the 8 starting officers and templates for the rest, written under `swat-officer-stories` |
| look-and-shell | `src/ui/theme.css`, `src/ui/skin.css`, `src/ui/app.css` (tokens and shared rules only), `src/ui/player-navigation.css`, `index.html` fonts, `src/ui/components/{BottomNav,TopBar,nav,ui,Sheet,ChoiceRail,chrome}.tsx` and their CSS, `src/ui/App.tsx`, `src/ui/icons*` | night-city tokens and type, five tabs City, Operations, Team, HQ, Store with routes (City shows the old HQ until wave 2), shared components restyled; screenshots of every existing screen still rendering |

### Wave 2 (parallel, after wave 1 merges)

| Lane | Writes only | Surfaces |
| --- | --- | --- |
| city | `src/ui/screens/city/**`, `HQ.tsx` retired into it, `components/{ShiftReport,WelcomeBack,Settlement,Hub}*`, `src/ui/settings/FirstRun.tsx` and the cold open | City map and list, district sheet with coverage and proactive shift, radio, return report, welcome back, first run and cold open, scripted first contact |
| operations | `src/ui/screens/{Ops*,CallTile,Casebook*,PrepBriefing,OpsPrepare,SupportPreparation,SupportContext,LiveView,LiveFeed,DecisionList,OperationFeedback,DebriefContents,SituationPanel}*`, `src/ui/screens/operations/**`, `components/{DebriefResults,Transcript,IncidentPeople,DepthBrief}*` | Now, Investigations (crew ladder, dossier, lead, warrant prep), Archive; live call and debrief restyled with world and people sections |
| team | `src/ui/screens/{Team*,Squad*,Recruit*,OfficerSheet*,Patrol*}`, `src/ui/screens/team/**`, `components/{CommandStaff,OfficerCard,OfficerRow,OfficerTile,OfficerProgress,Career,Face,StressDisplay,RankInsignia,SquadCrest,SquadPlacement}*`, `src/ui/people/**`, `src/ui/portraits/**` | squad room, service jacket, bonds, aftercare, recruit, patrol, command |
| hq-store-settings | `src/ui/screens/{Build*,Develop*,build-parts*,Gear*,Store*}`, `src/ui/storefront/**`, `src/ui/settings/**` (not FirstRun), `components/{SaveManager,Finance,Funds,PriceCapsule,GrantToasts,ToastView,toast}*`, `src/ui/entitlements.ts` | HQ (build, develop, gear, training, policy), Store lifetime catalog and restore, settings and account, save manager, toasts |
| world-calls | `src/sim/incidents.ts`, `src/sim/operation.ts` (payout and cast only), `src/gen/incident/**` cast binding, `src/content/traits.ts` tie contributor | warrant and armed-contact cards, cast-from-world name binding, tie contributor (capped 4, visible), call fee by tier times funding scale |

### Wave 3 (lead)

Merge, typecheck, screenshot every surface at 390 and 320, fix. Sol adversarial review of the integrated
diff. Then the broad run: `npm run verify`, e2e, UI gates; update tests that pinned old markup, regenerate
`docs/architecture.md`, `ui-debt.json` and fingerprints deliberately.

## Risks

- **Shared CSS.** `app.css` is 3,800 lines; the look lane owns tokens and shared rules, screen lanes own
  their files. Control: tokens first, screen CSS only in screen files.
- **Settlement correctness.** A second hourly loop could double count. Control: the world settles inside
  the existing `settle` interval walk, one call per interval, with hour indices stored.
- **Test fallout.** Markup changes will break many UI tests at wave 3. Accepted: the owner deferred testing.
- **Content cost.** Jackets for 100 personas are not written here; 8 authored, the rest from templates.
