# Residential layout additions

Three additive residential families expand the incident catalog from three to six locations. The original Maple Street tutorial, Cedar Close, Harbour Court and Market Row definitions and seed behavior are unchanged.

| Family ID | Structure | Practical differences |
| --- | --- | --- |
| `willow_terrace_v1` | Deep end-terrace, five rooms | Front room leads through the kitchen to a short rear lobby. A side passage reaches the lobby directly. Offset openings and a bookcase break up the long interior view; an optional kitchen exit adds another approach. |
| `ash_grove_v1` | L-shaped bungalow, seven spaces | A recessed patio reaches the private wing. Two connected hall sections form a dogleg without routes cutting through the outside corner. A kitchen-to-living door can create an internal loop. Wood-frame exterior walls have different signal properties from the brick homes. |
| `juniper_court_v1` | U-shaped courtyard house, six rooms | A transverse hall joins two wings around a usable outdoor court. The garden bedroom has two window approaches. An optional living-to-court door adds a loop; a courtyard tree and indoor furniture interrupt sightlines and reduce usable space. |

Each new family has 12 bounded authored variants: three partition positions, two secondary entrance states, and an optional extra connection. Seed zero is the authored base. This is a finite catalog of playable structures, not a claim of a unique layout for every seed or completion of the broader Phase 3 proposal.

New incidents select all six families while avoiding families already on the board or in an active operation when another is available. Initial boards still contain three different families. Residential incident types, equipment-free resolution actions, and specialist handover remain available at every entrance.

## Save compatibility

The family IDs are versioned content identities. Changes to these structural contracts must use new family IDs; never replace the layout behind an existing saved incident ID. Older generated incidents continue to regenerate their exact rooms, occupants, actions and rewards. The content-version field and save format do not need migration for an additive catalog.

`legacy-compat.test.ts` records fingerprints from commit `149ac15`, captured before the additions, for original buildings and incident definitions across five seeds including zero and the maximum unsigned 32-bit seed. The legacy source definitions and variation algorithm were not edited.

## Verification

- Exhaustive validation of every authored partition/door combination in all six families
- 500 seeds per added family: no geometry errors or warnings, furniture-clear anchors, and a finite route to every room from every entrance
- All 12 expected layout variants and both connectivity variants observed per added family
- 100 medical incident seeds per added family: every eligible room used and every person inside its room with furniture clearance
- Real-engine playthroughs of both three-step action paths, from every entrance, for all supported incident types at tiers 1, 3 and 5; serialize/reload after each decision
- Tests demonstrating shorter routes through optional connections and changed visual transmission through the bookcase and courtyard tree
- Existing blueprint label/marker fit tests automatically cover all added families

These families use one floor. The separate two-floor fixtures remain available for engine testing; this release does not introduce new upstairs incident behavior.
