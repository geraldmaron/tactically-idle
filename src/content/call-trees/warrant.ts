import { APPROACH_NODES } from './warrant-approach';
import { ENDINGS, RESOLVE_NODES } from './warrant-resolve';
import type { CallTree } from './types';

// The Room Next Door, the warrant call (design sheet: docs/calls/warrant-design.md). The world sends
// it, never the board (its template is worldOnly): a lead and enough intel open a warrant on a crew
// lieutenant (docs/world-redesign.md, "Crews"), and this is the operation that serves it. The
// lieutenant's name and pronouns are cast from the world into the one subject role, `lt`; nothing
// here writes them.
//
// Before dawn the squad stands in the downstairs hall of a house let by the room. The man on the
// warrant said "Not tonight" through his door upstairs. A parent and a child are asleep in the
// rooms beside his, off the same landing, and the parent's alarm goes at 5:15. Three situations,
// three earlier scenes:
// - Leaving. He stood the landlord's ladder under the family's window last night and asked the
//   parent whether it opens. "Not tonight" bought him time to lace his boots; the way out goes
//   through the family's room.
// - The kid. He walks the child next door to the bus some mornings and won't be taken where the
//   child can see. His "Are they still asleep next door?" was never a threat. No handgun in the room.
// - Witnesses. A cousin was hurt in a raid like this one, in the dark. He will walk out only in
//   daylight with the street watching, which is the opposite of the quiet the team chose for the
//   family's sake.
//
// An officer who knows him (ties, docs/world-redesign.md "Officers know people") changes one choice
// per stage: the name only his family uses, the gym where he trained. warrant-parts.ts lists them.
//
// Self-harm screen (E4): screened. No loss event, no goodbye, no withdrawal: in every situation he
// asks about tomorrow (the bus, his grandmother, who will see), and his want is a way to come out,
// not an end. Force against him is spared anyway (noFatal): this is the call the city sends most
// often, and the design keeps a subject's death off its routine paths.

export const WARRANT_ROOM: CallTree = {
  type: 'barricaded',
  title: 'The Room Next Door',
  roles: [
    { id: 'lt', label: 'crew lieutenant', pronouns: 'he', kind: 'subject', place: { rooms: ['bedroom', 'living'], floor: 'upper' },
      profile: '{lt.first} has rented a room upstairs at {place} for a year, paid in cash on the first of the month. {lt.He} trained at the boxing gym two streets over as a kid. The warrant says {lt.he} {lt~runs|run} the corner trade on this block for a crew.',
      carries: { label: 'Handgun', glyph: 'weapon', knownFrom: 'handgun' } },
    { id: 'parent', label: 'neighbor next door', pronouns: 'she', kind: 'civilian', place: { rooms: ['bedroom', 'living'], floor: 'upper' }, surnameGroup: 'family',
      profile: '{parent.first} rents the rooms beside {lt.first}’s with {kid.first} and works the early shift at a bakery across town, out the door at 5:30 every weekday and home in time for the school bus.' },
    { id: 'kid', label: 'child next door', pronouns: 'he', kind: 'civilian', place: { rooms: ['bedroom', 'living', 'office', 'storage'], floor: 'upper' }, surnameGroup: 'family',
      profile: '{kid.first} is {kid.age} and has lived at {place} since the spring. {kid.He} {kid~knocks|knock} on the wall at night to say goodnight to whoever is on the other side.' },
    { id: 'landlord', label: 'landlord', pronouns: 'he', kind: 'bystander', place: 'outside',
      profile: '{landlord.first} owns {place} and lets the upstairs rooms by the month. {landlord.He} gave patrol the key to the street door and stood in the cold telling them who sleeps where.' },
  ],
  // A house let by the room, or the rooms over a corner store: upstairs, off one landing.
  families: ['two_storey_house_g2', 'semi_detached_g2', 'corner_store_flat_g2'],
  scene: { setting: ['residential', 'business'], rooms: ['hall', 'living', 'kitchen', 'retail'], timeOfDay: 'night', crowd: 0 },
  summary: '{lt} won’t open the door. A child sleeps in the next room, and {lt.first} may be armed.',
  coldOpen: 'The warrant came out of three months of patrol stops and one lead that kept pointing at the same name. The squad was in the downstairs hall at {place} by 4:50, with the street still dark. An officer knocked on the door upstairs and called out the warrant, and for a full minute nobody answered. Then {lt.first} said “Not tonight” from just behind the door, and the strip of light under it went out. Patrol already knew who sleeps where from {landlord.first}, who owns {place}. {lt.first} rents one room up there. {parent.first} and {kid.first}, who is {kid.age}, rent the rooms beside it, and {parent.first} gets up for work at 5:15.',
  pressureLabel: '{kid.first} in the next room',
  pressure: { start: 14, perMinute: 0.18, threshold: 85, civilianPerMinute: 0.4 },
  briefing: {
    dispatchReason: 'Command has a warrant for {lt}, served by the squad before dawn. {lt.He} answered the knock with “Not tonight” and won’t come out, and a parent and child are asleep next to {lt.his} room.',
    known: [
      'The landlord says {parent.first} and {kid.first}, {kid.age}, sleep in the rooms beside {lt.first}’s, off the same landing.',
      'The landlord says {parent.first}’s alarm goes at 5:15, and {parent.he} {parent~leaves|leave} for work at 5:30.',
    ],
    unknown: ['Why {lt.first} won’t open the door'],
    responsibilities: ['Keep {parent.first} and {kid.first} safe', 'Serve the warrant on {lt.first}', 'Bring {lt.first} out alive'],
  },
  stageLabels: { assess: 'The knock', adapt: 'The landing', resolve: 'The stairs' },
  objectives: [
    { id: 'parent', label: 'Get {parent.first} out' },
    { id: 'kid', label: 'Get {kid.first} out' },
    { id: 'lt', label: 'Bring {lt.first} out alive' },
  ],
  // A handgun taken toward the family's door or raised at the officers on the landing, or a shot
  // fired: a threat to life the team has seen, so command can approve going up (sim/authorization.ts).
  // The warrant's handgun report alone is why the team is here, not a reason to go in.
  threatMarks: {
    at_family: '{lt.first} took the handgun to the door of the room where {kid.first} sleeps',
    gun_up: '{lt.first} raised the handgun at the officers on the landing',
    shot_inside: '{lt.first} fired inside the house',
  },
  facts: {
    handgun: { public: true, source: 'The warrant', label: 'The warrant’s handgun',
      claim: 'The warrant says {lt.first} carries a handgun, seen on {lt.him} last week.',
      confirmed: 'The team saw a handgun with {lt.first} upstairs.', disproved: 'The team saw {lt.first}’s hands and room, and no handgun.' },
    leaving: { label: 'The back of the house', claim: 'Whether {lt.first} means to leave another way than the stairs.',
      confirmed: '{lt.first} means to leave by the back, through the window of {parent.first}’s room.', disproved: 'The back of the house is bare. {lt.first} has no way out there.' },
    for_kid: { label: 'Who {lt.first} won’t be seen by', claim: 'Whether {lt.first} is waiting for {kid.first} to be out of sight.',
      confirmed: '{lt.first} won’t come out where {kid.first} can see {lt.him} taken.', disproved: '{lt.first} isn’t waiting on {kid.first}.' },
    witnesses: { label: 'Who {lt.first} wants watching', claim: 'Whether {lt.first} will only come out where the street can see.',
      confirmed: '{lt.first} will only come out in daylight, with someone from the street watching.', disproved: '{lt.first} doesn’t care who watches.' },
  },
  situations: [
    { note: 'Leaving. {lt.He} stood the landlord’s ladder under the family’s window last night and asked {parent.first} whether it opens. Not tonight bought {lt.him} time to dress. The way out goes through the family’s room.',
      truth: { handgun: true, leaving: true, for_kid: false, witnesses: false }, descriptors: ['injury', 'police_gunfire', 'child_at_risk'],
      selfHarmScreened: 'No loss event, goodbye or withdrawal: the want is a way out of the house, packed and dressed for tomorrow.' },
    { note: 'The kid. {lt.He} {lt~walks|walk} {kid.first} to the bus some mornings and won’t be taken where {kid.first} can see. The question about whether they are asleep was care. The handgun went back to the crew a week ago.',
      truth: { handgun: false, leaving: false, for_kid: true, witnesses: false }, descriptors: [],
      selfHarmScreened: 'No loss event, goodbye or withdrawal: the want is to spare the child the sight of the arrest.' },
    { note: 'Witnesses. A cousin was hurt in a raid like this one, in the dark. {lt.He} will walk out only in daylight with the street watching, which is the opposite of the quiet the team chose for the family.',
      truth: { handgun: true, leaving: false, for_kid: false, witnesses: true }, descriptors: ['injury', 'police_gunfire', 'child_at_risk'],
      selfHarmScreened: 'No loss event, goodbye or withdrawal: the want is to survive the arrest in front of witnesses.' },
  ],
  difficulty: { base: 48, perTier: 4 },
  root: 'the_knock',
  nodes: [...APPROACH_NODES, ...RESOLVE_NODES],
  endings: ENDINGS,
  rewards: { funding: 2600, trust: 6, xp: 45 },
};
