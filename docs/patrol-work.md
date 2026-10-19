# Patrol work (design note, proposed)

Status: proposed on 2026-10-19 for the `patrol-work` backlog item. Nothing here is built. The owner
decided to restore routine patrol work as idle work under the Watch Commander; this note says what
that means in the code as it is now, and asks for the choices only the owner can make.

## What exists

- A squad's `duty` is `patrol`, `standby` or `rest` (`src/sim/types.ts` `SquadDuty`).
- A squad on `patrol` earns `ECONOMY_TUNING.patrolPerOfficer` (150 a game hour) for each available
  officer, and recovers 1 stress an hour against 3 on standby and 6 on rest (`src/sim/economy.ts`).
- The Watch Commander rests a tired idle squad and returns it to its earlier duty (`src/sim/command-staff.ts`).
- The Ops board shows tactical call-outs only (`src/ui/screens/standingBoard.test.ts`).
  What was deleted is the standing patrol assignments that used to share that board.

So patrol today is a rate: no event ever happens on patrol, and nothing about it shows anywhere
except a funding line. "Restoring" it means giving that rate a texture.

## Recommendation

Patrol work is what a patrol squad does between calls, shown as a shift log and never as board cards.

1. **Hourly shift beats.** On the clock-hour grid that settlement already runs for managers, each
   squad on patrol with at least one available officer rolls one beat from a seeded draw (the
   campaign seed, the hour and the squad id, so an offline settlement equals any sequence of online
   ticks). Roughly 7 in 10 hours are quiet. Most of the rest are a routine contact. A small share
   leave an officer a little more strained. A rarer share are a lead that moves the next board
   call earlier. No beat injures anyone, kills anyone or asks the player to decide anything.
2. **Pay does not change.** The 150 an officer an hour stays as it is. Beats add a log line and a
   few service points, not a second income, so the idle economy keeps its balance.
3. **The Watch Commander runs it.** With the Watch Commander on, a patrol squad with a worn-down
   officer is rested before a beat can strain them, and returns to patrol afterward. With the
   Watch Commander off, beats still happen and the player keeps the duty switch.
4. **It shows without crowding the board.** The shift report gains one line per patrol squad
   ("Alpha: 9 quiet hours, 2 contacts, 1 lead"). The board keeps tactical call-outs only. The Squad
   tab's duty chip shows the latest beat.

## Strongest failure modes

- Idle texture that nobody reads. Control: the lead beat has a visible effect (a board call lands
  earlier), so the log earns attention.
- Extra stress from beats pushing officers into mandatory recovery without the player noticing.
  Control: beats can only add strain below the Strained band, never across it, and the Watch Commander
  already rests squads at that band.
- Offline settlement drifting from online play. Control: the draw is seeded by absolute hour, the
  same way restock and the managers are.

## For the owner

1. Is "texture, no new income" what you want, or should patrol also earn something other than funding?
2. Should a lead move a board call earlier, or is a log line enough?
3. Should patrol work exist for a squad the player keeps on manual duty, or only under the Watch Commander?

Once these are answered the engine loop (a `runPatrol` beside `runWatchCommander`) and the shift
report line are about a day of work, with tests that settle the same hours online and offline.
