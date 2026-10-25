# The cast strip

Owner request, 2026-10-25: the "People inside" panel was too heavy on every beat, showed people as
unconfirmed that the prose already named, lost the backstory once a call went live, and could not
scale to a call with a crowd. Canvas: https://claude.ai/artifact/Txf7t3DP9EmhgKNyb6FJU3 (People
Inside, One Cast).

Code: `src/ui/components/cast.ts` (the rules), `CastStrip.tsx` (the drawing), `cast-strip.css`.

## Who earns a row

A person gets a row of their own when they are the subject or leader, the stage's prose names them,
they need care, or the player pinned them. Four rows at most. Everyone else folds into one row per
group (followers of a leader, then civilians by their incident kind) with a count and a bar that
splits out, seen, heard, reported and not located. One or two leftovers with a row to spare stand on
their own, so a small cast looks as it did. The panel's height follows how many people matter now,
never how many are there.

## How the team knows someone

A ladder that never falls: reported (dispatch said so), heard (a voice in the stage's lines), seen
(the location fact is confirmed, or the stage's prompt names them). If the prose names someone, the
panel never says less. The highest rung each person has reached is kept per run in memory.
The subject's chip is their temper instead (the stance); injury and death override the ladder.

## Backstory on the live row

- The subject's row shows `stake`, one authored line per role (`TreeRole.stake`, compiled to
  `briefing.people[].stake`).
- Tapping any row opens it in place: `profile` (the briefing's "Who they are"), then the facts the
  team has reported, confirmed or ruled out about them.
- The briefing sheet drops "Who they are" and the civilian and subject lists when the strip is shown
  (`castShown`), keeping clocks, wounded officers and other casualties under "On this call".

## Groups, the roster and pins

A group row opens a roster sheet. Names show once the team has seen or heard someone; the rest are
counts, so the sheet never says more than the team knows. Tapping a name pins it to a row (the
four-row ceiling holds); a pinned row has "Take off the cast" in its opened view. Pins live in memory
per run and are not saved.

## Not built

- A headcount certainty flag ("about 28" turning into "27"). It needs an engine field.
- Sources on the chip ("Heard · 911 call"). A person the dispatcher heard from still reads
  Reported until the prose names or quotes them.
- Stakes for roles outside the building (the fellow courier) and for any call but Going Live.
- No shipped call has a counted group yet. Group rows were checked on made-up casts of 8 and 29,
  not on a real call.
