// The jobs the player hires this game for, and the critical journeys that serve them. Each journey
// names the test that plays it headless through the real dispatcher; journeys.test.ts holds the
// ones that span systems. The architecture test renders this table into docs/architecture.md.

export const JOBS = {
  command: 'When a call comes in, let me make hard decisions under pressure and live with what follows.',
  build: 'Let me build a department whose people and gear visibly change how calls go.',
  understand: 'After a call, show me why it went the way it did, so the next decision is better.',
  return: 'When I come back, show me what happened while I was away and what needs me now.',
  keep: 'Never lose my campaign.',
} as const;
export type Job = keyof typeof JOBS;

export interface Journey { id: string; job: Job; title: string; test: string }

export const JOURNEYS: readonly Journey[] = [
  { id: 'answer-a-call', job: 'command', title: 'A new department gets a tactical call on a generated building, deploys, decides until the call ends, and closes the debrief', test: 'src/architecture/journeys.test.ts' },
  { id: 'choices-branch', job: 'command', title: 'Different picks at the same point lead to different next decisions', test: 'src/gen/incident/trees-v13/graph.test.ts' },
  { id: 'chance-not-script', job: 'command', title: 'The same pick can take more than one branch, by a roll the player was shown the odds of', test: 'src/architecture/journeys.test.ts' },
  { id: 'team-moves-odds', job: 'build', title: 'Better ratings, less strain and the right gear raise the chance on the choices they apply to', test: 'src/architecture/wiring.test.ts' },
  { id: 'hire-and-equip', job: 'build', title: 'Hire an officer and buy equipment with department money', test: 'src/architecture/journeys.test.ts' },
  { id: 'debrief-explains', job: 'understand', title: 'Every committed decision in the debrief names what helped and what hurt', test: 'src/architecture/journeys.test.ts' },
  { id: 'offline-settles', job: 'return', title: 'Time away settles once and caps at 24 hours', test: 'src/sim/economy.test.ts' },
  { id: 'save-round-trip', job: 'keep', title: 'A campaign mid-call saves and loads to the same state', test: 'src/architecture/journeys.test.ts' },
];
