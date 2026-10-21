DRAFT (the separate writing review, the Codex cold read and `check:strings` are not done: `going-live-review`)

# Going Live: design sheet

The first curated call, written 2026-10-21 after every old call was deleted. Strings ship in
`src/content/call-trees/hostage-live.ts` and `src/content/incidents/hostage.ts`; the lines here are
placeholders where they differ.

## Premise

```
Call type borrowed:  hostage at a counter
Person:              a delivery rider (pronouns drawn) wants one sentence said on camera: that the rider didn't take the bag
Wrong note:          the rider streams the stand-off on their own phone, propped on the register
Worse if they wait:  the count climbs, the riders at the tape multiply, and the rider can back down less with every viewer
Why a tactical team: "A rider the store got cut off is back with a handgun and won’t let {manager} or {clerk} leave."
Self-harm risk:      present: cut off from the only income, accused in public, a handgun, a refusal. E4 applied; noDeathOnCard; the negotiator asks the direct question off the card in `cornered`
Private logic:       four hundred people who believed the rider are the only thing left that the app didn't take; the stream is proof and armor at once
Lenses:              L7 reframe (primary), L4 voice under pressure
Reframe:             s1 the manager's glances at the stockroom were about family, not the handgun; s2 the followers' faith is why the rider can't stop
Temptation:          tell the rider the clerk backs the rider's story (`say_clerk_backs`); cue: the clerk's unprompted "I didn't say anything"; breaks in s2 when the clerk's own comment appears on the stream
Iceberg tip:         the clerk's "I didn't say anything to anybody", via `clerk_out`
Closing fact:        who took the bag. NEVER PRINTED as a narrator fact
```

## People

- **Rider** (subject). Wants the sentence. Fears being hurt where nobody can see. Reads: plays to the
  chat as the count rises; sits down when told something true. Voice: short, to the camera, repeats
  the timestamp. Breaking point: the comments turning, or the stream cut out from under them.
- **Night manager** (held, the grievance). In s1 filed the complaint to cover the clerk, their
  nephew or niece. Anchor: the green marker on the pickup whiteboard.
- **Clerk** (held, incidental, nineteen). In s1 took the bag. Anchor: the case of water they never
  put down.
- **Rider friend** (outside, at the tape). Types in the comments. Can carry words as a gamble.

## Shape

| Stage | Node | Dilemma | Choices |
|---|---|---|---|
| 1 approach | `going_live` | the stream is the only line the rider answers, and talking on it feeds it | on the stream, through the glass, cut the stream, escort the clerk out, watch the counter |
| 2 turn | `on_air` | let the sentence be said live, or take the audience away first | manager answers on camera, camera to the wall, move up to the glass, the friend on the line |
| 2 turn | `off_air` | the honest answer to someone with nobody watching, or quiet the street | say you cut it, push the tape back |
| 2 turn | `clerk_talks` | hear what happened at 11:40, or say what the rider came for before you know | ask the clerk, the temptation |
| 3 commit | `way_out` | walk out live (safety and a show) or dark (no show, no witnesses) | walk live, phone down then walk, manager first, own the lie, the honest next step, hold all night |
| 3 commit | `cornered` (s2) | end the stream that turned, or let a friend talk | off the stream, the friend stays |
| 3 commit | `threat`, `fired_on`, `last_word` | talk down, go in or go dark; how the rider walks out | as authored |

## Pressure

- **Stream** (`stream`, owner the rider): 380 to 42,000 watching. Talking on it, the chat turning
  and the rider playing to it speed it up; the camera on the wall slows it; command, the rider or the
  dark ends it. Pulls up to 7 points off contact and pressure checks.
- **Riders at the tape** (`tape_riders`): 6 to 280. Pushing the tape back slows it. Pulls up to 6 off
  coordination and execution. The crowd can hurt someone at the front when it surges.
- **Threats** (5 to 6 game minutes, under 90 real seconds at Relaxed) each carry two or three beats.

## Officers

Choices favor `steady` (doesn't speed up for the camera) and `calm_voice`. A crisis negotiator is
credited on the talk. A rookie is rattled by the cameras past 40% of a source. The physical acts
(the escort, the voice through the glass, the squad at the window, entry) read the building and the
kit.

## Balance record

`npx vitest run src/gen/incident/trees-v13/call-tree-balance.test.ts`, tier 2, day-one squads,
random style, 60 calls, measured 2026-10-21: clean 48%, costly 33%, unresolved 15%, hurt 1.7%,
death 1.7%. Harm totals 3.4% against a 3% floor, a thin margin.

## Design record

- Lane and version: call tree, content v13; old compiled fingerprints retired with the old calls.
- Gates: `npx vitest run src/gen/incident/trees-v13/call-trees.test.ts` passes (routing, marks,
  futures, binding as he, she and they, every path walked).
- Ethics: E2 force never rewarded (entry endings cost trust and go to review); E4 applied to the
  rider; E7 no gore (the injuries are a wrist, a knee, a shoulder, a forearm, said plainly); E12.5
  entry only from `threat` and `fired_on`, behind a seen threat to life.
- Not done: the `swat-writing-review` verdict, the Codex cold read, `check:strings`, the E3 batch
  tally, and the owner's read of both death endings.
