# Squad inventory auto-equip

Auto-equip adds useful owned equipment to preparation. It preserves explicit manual quantities, exact unit picks and zero quantities, and reserves non-target squad selections first. It does not purchase gear, spend funding or invent units. Radios are standard kit: exactly one usable unit per selected officer is reserved automatically.

The per-squad control is labeled **Auto-equip squad A** (or the corresponding squad), and the shared control targets only selected squads. These controls change preparation inventory only: they never choose a story decision, assign acting or supporting squads, deploy the operation, or execute an action.

Live operation choices start unselected, including after a decision or a stage change. Opening an action reviews it for the visibly focused squad; supporting squads are selected by the player. An explicit action and its participating squads stay selected through a stores delivery or a simple screen update. Confirm remains the only control that executes that decision.

Live equipment uses the existing **Equipment from stores** path for the reviewed action. It reserves the listed owned, usable serials for the chosen squads only while staged outside, before the first decision. Delivery has the displayed time/pressure cost and prevents cancellation; it neither executes the reviewed decision nor silently switches to a different action or squad. It is not a mid-operation inventory teleport.

The shared equipment-requirements model derives action hard requirements, alternative bundles, certifications and contextual optional benefits. Briefing, preparation repair, field resupply and the recommendation use the same declared requirements. An optional tactic is never presented as a mandatory deployment requirement.

The planner ranks genuinely qualified participants and actual serviceable unit contribution in public context. Daylight lights, nighttime binoculars and a solo-squad relay are not useful bonuses. Better nominal equipment can lose to a healthier simpler item. Hidden truth and person positions are never recommendation inputs. Inventory explanations describe equipment and stock limits, without exposing future story titles, private prerequisites or instructions about which officer should lead a later decision.

Reusable equipment is bounded to useful participating squads. Consumables cover feasible sequential uses; simply sharing a stage does not make actions mutually exclusive. Complete required bundles precede optional bonuses. There is no invented hand-carried capacity rule. Manual requests exceeding available stock stay visible with a shortage rather than being silently clipped.

Power is included with equipment. Separate battery stock is retired by save migration and unused units refunded at their historical $40 price. Legacy scenario IDs and historical decisions remain readable through integrated-power compatibility.

A recommendation is a deterministic suggestion with reasons and shortages. It is not a guarantee of success or a claim of global mathematical optimality. Undo restores the previous preparation selections where safe.
