# Who carries what: loadouts by officer

Status: decided design, 2026-10-24. Backlog item `named-carriers`. Owner: "The inventory for the mission
seems disorganized. It isn't clear that the basic kit is per officer. Also how do we determine which officer
has which item?"

## The decision

Keep the squad's equipment pool and its rules. Name a carrier for every packed unit, assigned automatically,
and name who works an item when a decision uses it. Carrying is information and accountability. It never
changes which choices exist, their odds, who leads or what force is allowed.

A first draft gave every officer one hands slot and two pack slots, made an action need its carrier, preferred
the carrier as lead and took a hurt carrier's gear out of play. Sol rejected it (challenge below) and the
rejection holds: those rules added chores and broke the engine without a packing choice worth making.

## What the game does today (read in code)

- Basic kit (radio headset, sidearm, carbine, light armor) is one built-in set per squad
  (`src/sim/basic-kit.ts`): no stock cost, no wear, no score. The Adjust sheet says every officer carries it;
  the prepare screen says so only in an accessible label and draws the four icons under the first squad
  (`src/ui/screens/OpsPrepare.tsx`). So the basic-kit confusion is a presentation failure.
- Armory units are reserved per squad (`LoadoutReservation { id, runId, squadId, itemId, unitId }` in
  `src/sim/types.ts`). Effects take the best item in each effect group, uses deduplicate by unit, reusable
  wear lands once per used unit per operation, used consumables are spent and the rest return
  (`src/sim/inventory.ts`, `src/sim/equipment-requirements.ts`).
- Some gear already needs a qualified participant: contextual capabilities check participating qualification
  holders, and force tools need a qualified officer taking part (`src/sim/drawn-effects.ts`).
- Nothing records who carried or worked a unit, so no screen can say "Aung has the shield".

## Four relationships, never one field

Carrier (who brought it), operator (who works it in a decision), lead (who the player put in charge) and
protected officer (whom a shield or armor covers) are different people. This design adds the first two.
The lead is unchanged. Protection stays with `worn-kit` and the existing shield rules.

## Data contract

1. `LoadoutReservation` gains `carrierOfficerId: Id | null`. Null is for shared supplies and
   operation-level assets (a vehicle). One reservation per physical unit stays the only record; squad and
   officer summaries derive from it.
2. Carriers are assigned after equipment is chosen (auto-equip, a preset or a manual pick), from the officers
   actually deploying in that squad, by a fixed order:
   - talk gear (loud hailer, throw phone) to an officer with the negotiation qualification;
   - medical consumables (trauma kits) to an officer with the medical qualification;
   - entry and protection gear (ballistic shield, door ram, rescue shield) to the deploying officer with the
     best entry aptitude;
   - anything else, and every tie, to whoever carries least, then by roster order.
   No certification is invented: an item whose qualification no one holds goes by the last rule.
3. Basic kit stays the virtual squad set for rules. The UI shows it once as issued to every officer. No
   copies, no bonuses, no wear.
4. When a carrier becomes unavailable mid-call (hurt, recalled), the unit moves to another officer in the same
   squad at the next command boundary, by the same order. It grants no extra unit, bonus or cross-squad access.
   Equipment is never stranded.
5. At decision commit the history records each used unit with its item, squad and operator. The operator is
   the participant the engine can honestly name (the qualified holder for a gated item, otherwise the lead);
   where it can't, the record says the squad worked it. A later carrier change never rewrites history.
   Used-unit accounting derives from that record.
6. Presets stay item types and quantities. Serials and carriers resolve for each deployment.
7. Save, reservation and history validators extend deliberately under the current-version-only save policy.

## What must not change

- Participant ordering, the player's lead choice, recusal, participant limits and strain.
- Action eligibility, odds, routes and story branches. Carrier data alone never moves them.
- Best-of-group effects, physical-unit deduplication, atomic reservations across squads, vehicle rules.
- Firearm authorization, less-lethal precedence, certifications, supplies and the separate harm draws.
- Basic kit availability, zero cost, zero wear and zero score.
- Wear once per used unit per operation; consumables spent per actual use. Wear belongs to the unit, never
  to a person.
- Manual quantities, explicit zeroes, exact picks, undo, and the Quartermaster's spending limits.

## Screens

Prepare screen, squad section, full-width rows at 390 and 320 px:

```text
Alpha equipment                        Adjust
Basic kit issued to every officer
[radio] [sidearm] [carbine] [armor]
[face] Singh   Loud hailer
[face] Aung    Ballistic shield
Shared supplies   Trauma kits ×2
```

The four-icon basic-kit row appears once per squad with its scope in visible words. Officers without packed
gear still appear, with "Basic kit" in place of an item, so the whole squad reads. Structural sketch; the
final words go through the writing rules.

Adjust sheet: Auto-equip, Undo and Apply preset together; packed equipment first with carrier, quantity and
any condition warning; item info and unit detail open from the item; adding gear stays a squad action with
the carrier assigned automatically; shortages and missing qualified operators shown directly. No manual
"move to officer" control until players show they want one.

Decision sheet: the operator beside the item a choice uses ("Singh works the hailer"), with the lead shown
separately as today.

Debrief: per unit, who carried it, who worked it, and whether it was spent, worn or returned.

## Rejected, with reasons

| Element | Verdict | Why |
|---|---|---|
| Hands and pack slots, item size classes | Rejected for now | No call shows a packing dilemma; quantities, stacking and many item classes are undefined; 26+ taps to fill. Revisit only with a call that has competing, viable packing choices. |
| Action requires its carrier among participants | Rejected | Changes availability and force fallbacks; no answer for supporting squads. |
| Carrier preferred as lead | Rejected | Lead choice moves odds sharply (one probe: 43% to 15% across leads) and drives strain, traits and story flags. |
| A hurt carrier's gear leaves play | Rejected | Strands life-saving gear with no recovery; the team loses options because of packing. |
| Four officer columns, basic kit under each face | Rejected | About 83 px per column at 390; short squads break the grid. |
| Wear per carrier | Rejected | Wear is a property of the unit. |
| Memory facts naming carried gear | Needs validation | Accurate but may read as filler; decide with the officer-stories review. |

## Challenge record

Sol (`gpt-6.1-sol`), 2026-10-24, against the first draft: rejected, one fatal finding (injury strands
equipment) and seven serious (lead rewrite, slots, auto-equip under capacity, double representation, force
and protection semantics, phone tap cost, lifecycle past deployment). Its alternative, automatic visible
carriers in the squad pool, is this design. Two side findings went to the backlog: auto-equip skipping
less-lethal gear on calls with drawn force (`auto-equip-force`), and the stale radio-reservation claim in
`docs/auto-equip.md` (fixed inside `named-carriers`).
