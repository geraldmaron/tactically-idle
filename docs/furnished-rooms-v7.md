# Furnished rooms, content version 7

New content uses an explicit `__furnished_v7` location lookup key. The underlying
family identity, room names, wall polygons and seeded opening variations remain
available to the story authors. Its location ID and version identify the new
physical plan. Existing unsuffixed family keys, incident versions 1–6, RNG draws
and saved history continue using their original objects and route calculations.

The generator furnishes each room after architectural variation. Its versioned
object definitions give footprint sizes in feet, room suitability, service space
and the same obstruction/cover/sightline tags consumed by simulation. Furniture
backs anchor to real continuous wall segments with wall-thickness allowance.
The blueprint reads the resulting orientation directly instead of guessing the
nearest wall and reversing a sofa away from its table.

Living rooms try a facing sofa, coffee table and television group, with a
1.5-foot sofa/table gap. Screens are only placed where an opposite clear wall
works; otherwise that room can have seating without a screen. Dining chairs
face their table with space to pull out. Bedroom bed width can reduce from a
double to a small double or single in compact rooms. Kitchens require useful
appliance footprints. Full bathrooms solve a tub, toilet and washbasin as a
group before accepting the arrangement, including exact clearance-edge slots
that a fixed sampling grid could miss. Shops use checkout
and shelving, and halls/stairs remain clear. Optional pieces are omitted when
they cannot fit rather than shrinking them into arbitrary icons.

TV coverage is checked per advertised home family, not only as one global
count. In the 128-seed verification sample, Cedar, Harbour, Ash and Juniper fit
a TV in every living room; Willow fits one in 84 layouts. The optional furnished
Maple adapter has no valid opposing-wall TV group in that sample and deliberately
keeps seating without a screen. Its unsuffixed authored layout remains unchanged.

Every accepted group must remain inside the room polygon and clear of other
objects, doors, conservative door-swing/approach rectangles, window positions,
and other furniture's service fronts. Shared centroid and door approach anchors
must remain connected by an actual interior path. Living rooms reserve a wider
three-foot route envelope for chair-preserving rescue stories. Placement varies from stable
room/object/seed hashes; rendering never draws new randomness.

For new furnished locations, movement uses a bounded room-local visibility graph
around expanded rotated footprints and inset room corners. Opening-side states
allow a different door to be chosen when furniture makes a route longer or
unreachable. The displayed polyline and time calculation use the same points.
Closed/locked doors keep their normal operation and material costs. Old location
keys retain the exact legacy route behavior.

Person movement starts at the current public position and ends at the observed
story transition this action can cause. It does not substitute a geometric room
centroid that may be occupied by a tree or cabinet. If one action releases two
people, each has a separate physical leg and the simultaneous move costs the
longest leg, with shared door forcing charged once. Hidden transitions never
provide route endpoints. Arriving medical crews use the explicit public care
target when it is known.

Route inspection is an explicit separate action kind. It validates the same
planned chair path from the person's public position to the named observed
arrival, while retaining the authored check workload. Its overlay is labeled as
a plan; inspection does not move the person, add movement time, use a door tool,
or open a lock. The later committed move rechecks the physical route.

## Boundaries

This is a feet-based game abstraction, not a building-code or accessibility
certification. The current furniture solver targets the seven existing
orthogonal plans. Room movement uses one-foot radial wall clearance and
conservative square clearance around furniture (a two-foot walking envelope),
with door-normal crossings handled separately. Chair routes use a 1.5-foot
clearance and three-foot openings, but this is not a full crowd or wheelchair
swept-volume simulation. The graph caps geometry at 256 vertices;
an unsupported/sealed route is reported unreachable. New exterior paths also
stay inside their zone polygons and avoid physical tree/shrub footprints.
Low objects consume floor space without automatically
blocking the whole sightline; tall wardrobes, refrigerators and shelves do.

Tests cover every authored partition/optional-door combination, repeatable
furnishing across families and seeds, object containment and collision rejection,
door clearance, service fronts, actual wall anchoring, seating/TV orientation,
essential room contents, concave detours, route timing and legacy preservation.
