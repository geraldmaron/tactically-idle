# Squad and scene coherence

The Oct6 pass links the displayed blueprint, public people and possessions, movement, equipment decisions and their aftermath. New calls use content version7; previously issued version1–6 calls keep their seeded definitions and recorded results. The authored starting scene supplies one set of rooms, actual objects, people, reports and routes. Presentation never treats hidden truth as a player observation.

## Squads and recruitment

Roster portraits reserve their final dimensions before the first paint, removing the height jump on A/B switches. Selected squad and individual rename drafts stay in the current campaign's UI session across navigation. Keyboard tab activation remains immediate; focus and selection have distinct cues, and reduced motion is respected. Recruitment no longer has a targeted-role rail, role-biased refresh or specialist reserve injection. Officer roles and qualifications still matter in the game. Existing candidate identities and saved careers are retained.

## Blueprint and public knowledge

New furnishings use versioned location keys, wall-facing groups and real room/opening geometry. Sofas face their table/TV grouping, beds have wall-aligned headboards, and dining chairs face their table. Furniture cannot overlap, block required access or leave usable polygons. A suitable TV wall is optional, while essential beds, kitchen fixtures and residential bathrooms are required. See [furnished-rooms-v7.md](furnished-rooms-v7.md) for bounded placement/path rules and coverage.

Walking and chair movement use the same clearance-valid polylines for display and cost, including exterior obstacles. Person movement starts at public observed positions and ends at the specific observed transition that the action commits. Checking a proposed route is explicitly an inspection: it validates that route but does not move a person, open doors or spend movement-only tools.

Reported people are recognizable amber silhouettes with a short reported label; observed people have mint silhouettes and names. Known item glyphs remain attached to their holder inside the room, with independent item certainty. Full names and evidence are available through the room inspector and its accessible text alternative. Room-level reports use separate approximate anchors, not hidden exact positions. Possessions require explicit knowledge conditions; hidden handoffs do not move public glyphs. An initially reported holder is stored separately from the actual holder. Unknown weapon information never means unarmed. Repeated generic CHECK NEEDED annotations and category question-mark badges no longer duplicate the same person report.

## Equipment and aftermath

Only explicitly authored force choices use the new harm model, in the two suitable high-risk story families. Qualifying carried gear alone does not activate it. A chosen action must use the matching serviceable unit, trained participant and complete supplies. Task success and physical harm are separate saved results. Less-lethal options have substantially lower but nonzero fictional lethal risk; the player sees qualitative consequences, not real-world percentages. Protection, medical supplies, communication, observation and vehicles retain distinct contextual effects. See [equipment-harm-v7.md](equipment-harm-v7.md).

Named injury/death records govern later actions, medical acceptance, visible status and endings. A shared responsive-person requirement handles conversations involving someone other than the physical action target. A dead or injured subject cannot be made to answer an inherited dialogue branch. Other surviving people can still receive help. Post-force checks do not turn a failed uninjured attempt into a free success: safe access requires a recorded successful intervention, current evidence or explicit incapacitation. Historical stand-down observations cannot override a later successful response. Requesting a medical crew, its arrival, safe access and actual care acceptance remain separate states. Death cannot be reversed by care or a later safe flag.

## Research applied

- [W3C tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/): immediate activation is useful only when panels appear without noticeable latency; keyboard focus, selection and panels must stay related. This supports fixing first-paint geometry and state continuity rather than delaying tab clicks with animation.
- [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): meaningful controls and graphics need distinguishable visual cues. Person shape, dashed/solid treatment and explicit text complement color; important state is not carried by color alone.
- High-level less-lethal and objective-clarity sources are documented in the equipment note. They inform risk distinctions and understandable consequences; the numeric model is explicitly game balance.

## Review and publication boundary

Source/engine checks cover seeded geometry, actual generated journeys, hidden-state separation, old definitions, supplies, injuries and persistence. Static SVG exports check furniture and marker geometry. They are not an interactive browser test. The local browser preview route is blocked; changed-build phone-width interaction checks remain pending an authorized hosted release. Main is not updated by the draft PR.
