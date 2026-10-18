// Run counts for simulated numbers and the timings behind them (spec 9.6). Targets: "this call",
// `call` runs, within 8 s, streamed; the quick tuning tier, `quick` runs × 2 sides, within 3 s;
// "Where this leads", `fromHere` runs, within 3 s.
//
// Measured 2026-10-09 on this Mac (18 cores, so a pool of 4 workers) in the dev server, headless
// system Chrome through playwright-core, fresh context each run, while other agents' test runs
// shared the machine. Scripts and raw output: the build/J scratch folder of the lab rebuild.
//
// bench job, one worker, ms per unit (hostage / barricaded / armed / rescue default calls):
//   this-call run      1.46 / 1.94 / 1.63 / 1.12   (3.7 / 3.2 / 2.8 / 2.7 decisions a run)
//   start the call     4.2  / 6.9  / 4.3  / 3.6    open (generate) 11.7 / 11.7 / 8.6 / 5.4
//   drawCalls, a call  12.3 / 12.2 / 21.2 / 13.8   played gate call 24 / 10 / 12 / 11 cold, 17 / 4.7 / 6.0 / 6.5 warm
//   whole explore      683 ms (1,020 states) / 253 (332) / 199 (294) / 70 (129)
// Through the lab's pool of 4 (ms), with these defaults:
//   call 2000 runs     926 / 862 / 708 / 612      (second run 826 / 803 / 714 / 589; the very first job, which
//                                                  starts the workers, 511 ms for 400 runs)
//   quick 600 × 2      486 / 450 / 363 / 347
//   fromHere 1000      384 / 251 / 146 / 277
// On a pool of one worker (a two-core machine), same defaults:
//   call 2000 runs     3,133 / 2,452 / 2,396 / 2,035
//   quick 600 × 2      1,601 / 1,359 / 1,331 / 1,085
//   fromHere 1000      1,360 / 1,120 / 1,080 / 960
// So every target holds with room on this Mac and on one worker. No main-thread task over 50 ms
// while these ran (longtask observer); 2000 runs stream 40 progress events per worker.
// Gate, 11 jobs: both sides on fresh workers 9.3 s and 9.1 s; the patched side alone (saved side
// cached, workers warm) 3.5 s and 3.4 s. measure(hostage, random, 60) as a this-type job: 3.7 s.
// Explore to an ending (hostage, 232 states) 366 ms; the whole hostage walk (1,572 states) 887 ms.
export const RUN_DEFAULTS: { call: number; fromHere: number; quick: number; chunk: number } = { call: 2000, fromHere: 1000, quick: 600, chunk: 50 };

/** A played population call (gate, this type: a fresh start, often a fresh generation) costs about
 * this many this-call runs (bench above), so those jobs yield every chunk / CALL_COST calls. */
export const CALL_COST = 10;

/** The gate (11 jobs) through the pool, in seconds (measured above): both sides on fresh workers,
 * and the patched side alone with the saved side cached. For the "Run gate ≈ N s" button. */
export const GATE_SECONDS = { bothSides: 9, patchSide: 3.5 };
