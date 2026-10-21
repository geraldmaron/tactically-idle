# Hostage call: the crowd and the taker go live

DRAFT for the owner, 2026-10-20. Design under `swat-call-design`, lines under `swat-call-prose`, on
One Last Signature (`src/content/call-trees/hostage-signature.ts`, `src/content/incidents/hostage.ts`).
Engine: gauges that fill (`docs/call-pressure.md`, "Gauges that fill"). Structure otherwise
unchanged: the existing design sheet (`docs/calls/hostage-signature-design.md`) still holds.

## What the player meets

Two gauges fill over the call, the same in every situation. Neither depends on the hidden truth, so
neither leaks it.

| Gauge | Clock id | Rate | Starts biting | Slowed or stopped by | Ends |
|---|---|---|---|---|---|
| Phones at the tape | `crowd_stream` | 0.5 a minute (±20%), from 0 | its first cue, about 50 minutes in | `tape_back` slows it to 0.2 a minute | never stops on its own |
| {taker.first}’s stream | `taker_live` | 0.4 a minute (±25%), from 0 | its first cue, about 87 minutes in | `phone_down`: favorable stops it, mixed slows it to 0.15 a minute | stops once the taker is out (owner `taker`) |

What a live gauge does is the engine's, from its first cue: more strain on officers, more call
pressure each minute, and a bigger trust swing at the debrief either way.

## Cues, lowest first

| Gauge | At | Line | Effect |
|---|---|---|---|
| crowd | 25 | At the tape a regular is filming the shop front and telling someone on the phone what happened here. | the gauge starts biting |
| crowd | 40 | The people at the tape pass one phone around and read the comments under it out loud. Somebody says a thousand people are watching. | |
| crowd | 70 | A TV station’s van pulls up at the corner. The regulars start filming the reporter as well as the shop. | |
| stream | 35 | {taker.first} props {owner.first}’s phone against the register, screen out, and starts telling it about the till. | mark `taker_live` (opens `phone_down`); `watched` on the taker |
| stream | 50 | {taker.first} reads names off the phone’s screen out loud, people from the neighborhood, and answers them one at a time. | `watched` on the taker |
| stream | 80 | {taker.first} turns the phone so it faces {owner.first} and tells the people watching to take a good look. | `watched` on the taker |

The stream uses the owner's phone, which the taker took off the counter before letting the courier
go (`out_keys` prompt). The crowd is the regulars the call already has at the tape; the `talking`
threat ("The regulars start filming") now reads as more of them joining.

## The two choices

| Choice | Where | Title | Minutes | Favorable | Mixed | Adverse | Named cost |
|---|---|---|---|---|---|---|---|
| `tape_back` | `both_inside` (every choice there leads on to `talking` or `standoff`) | Move the tape back | 8 | tape moves, crowd slowed (`tape_back`), on to `talking` | slowed, but the taker saw it (`team_seen`, pressure 3), on to `talking` | regulars won't move, not slowed (`team_seen`, pressure 5), to `standoff` | nobody answers the taker while patrol moves the street |
| `phone_down` | `talking`, only once `taker_live` is heard | Ask {taker.him} to stop streaming | 4 | phone face down, stream stopped (`stabilize`, `phone_down`) | phone to the wall, stream slowed (`phone_turned`) | phone pressed to the glass, stream goes on (pressure 4) | `provoked` on every band, and the call goes to `standoff` on every band |

Why a player picks each: when the call is going badly, the audience multiplies the trust loss and
the strain, so slowing or stopping it protects the department and the officers; when it is going
well, the audience multiplies the gain, and the bargaining is worth more than the quiet. Neither
choice beats the existing talking choices on every axis: both give up progress toward getting the
owner out.

## Ethics screen (E-numbers from the rulebook)

- E1 no manual: no method, no technique; patrol moving a line is plain procedure.
- E2 force never the reward: neither choice touches force, and both trade progress, not safety.
- E4: the taker is an E4 subject. No line shows a method or frames harm as a release; the stream
  cues are about the till, the neighborhood and the owner, not about ending anything. The `watched`
  moves raise agitation, the honest effect of a camera on a person in crisis.
- E12.3: the regulars and the TV van are bystanders at the tape; nobody is put on the line.
- E11 honest outcomes: no line claims what the stream shows beyond what the team sees.

## Gates

- `npm run check:strings -- hostage_crisis`: exit 0 after rewrites (repeated runs against an
  existing ending, echoes between previews, and a "negotiator goes" role-position hit were fixed).
- Tree tests, dependencies (marks read and written), the push-back and descriptor gates: see the
  commit. A tree test that assumed every clock lists cues highest first now knows a fill lists them
  lowest first; the dependency index now counts a `rateFlags` mark as read and mirrors `onFull`.
- Compiled fingerprints: recaptured on purpose for `hostage_crisis` only (new clocks, new choices).

## Balance (owner decision, 2026-10-20)

First authored at crowd 1.5 a minute (first cue at 10) and stream 1.0 (first cue at 20), with
`tape_back` at `talking`. The balance gate failed (hostage, random style, 60 calls: bad 0.667
against a 0.65 ceiling; before the gauges 0.633): the gauges added one bad ending and `tape_back`,
routing every band to the standoff from the hub, one more. Moving `tape_back` to `both_inside` and
slowing the gauges brought bad back to 0.633, but six odds-wiring probe floors still failed by 1 to
5 sampled choices: the gauges' strain and pressure shift the seeded walk into states where the
taker's agitation is capped and every choice sits at the 3% odds clamp. The owner chose to ship the
gauges late (crowd 0.5 from 25, stream 0.4 from 35) and leave the probes as they are, so on most
calls the gauges never start; they bite on long calls.
