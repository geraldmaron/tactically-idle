// Service jackets, batch C: person_039 through person_069 (see jackets.ts for the rules every jacket holds to).
// Written under the swat-officer-stories skill. Record: docs/calls/notes/jackets-c.md.
//
// Across a batch this size the one-per-batch rules in the jackets.ts header cannot hold. Contradiction
// patterns and noticed-first markers are spread as evenly as the batch allows instead of never repeating
// (careful here, careless there stays at three of 31). A "names the person" radio sample uses the placeholder
// surname Ruiz, which is bound to the call's cast at display time and is not in the roster.
import type { Jacket } from './jackets';

export const AUTHORED_C: Jacket[] = [
  {
    personaId: 'person_039', // Riya Chakraborty, they
    page1: {
      pressureLine: 'They shoot stop-motion films with household objects. Inside a house they see whose hands move, and how little.',
      contradiction: 'Plans each frame exactly. Shows up to dinner an hour behind.',
      pattern: 'precise with objects, loose with time',
      markers: { length: 'medium', noticesFirst: 'hands', habit: 'names the next step', grewFrom: 'moving objects a hair at a time to hands, planning every frame to naming the next step' },
      radio: { ready: 'Front room. Man seated, hands on the table. Hall next.', strained: 'Front room. Man seated, hands on the table.', overloaded: 'Hands on table.' },
    },
    page2: { line: 'A lump of putty stays in their jacket pocket, pressed flat while they listen.', district: 'harbor' },
    page3: { kind: 'first_call', line: 'After {place}, they set a putty figure on the van dash and have kept one there since.' },
    openToRelationship: true,
    tieKinds: ['school', 'neighbor'],
  },
  {
    personaId: 'person_040', // Balpreet Sethi, they
    page1: {
      pressureLine: 'They sketch imaginary railway stations. In a strange building they find the way out before the way in.',
      contradiction: 'Urges friends to check the timetable first. Boards whatever train is standing.',
      pattern: 'gives advice, skips it',
      markers: { length: 'short', noticesFirst: 'exits', habit: 'names the street', grewFrom: 'stations and finding the way out to exits, platforms and routes to naming the street' },
      radio: { ready: 'Rear gate, Fennel Street. Padlock hanging open.', strained: 'Rear gate. Padlock hanging open.', overloaded: 'Gate. Padlock open.' },
    },
    page2: { line: 'Their transit map is folded in quarters, and they read the stops with a thumb.', district: 'eastgate' },
    page3: { kind: 'rescue', line: "Their sketch of {place} hangs by the van's sliding door." },
    openToRelationship: false,
    tieKinds: ['old_job', 'gym'],
  },
  {
    personaId: 'person_041', // Linh Nguyen, she
    page1: {
      pressureLine: 'She collects unusual buttons in frames of twelve. She counts heads in a full room before anything else.',
      contradiction: 'Mounts each button dead straight. The coat she wears is missing two.',
      pattern: 'careful here, careless there',
      markers: { length: 'medium', noticesFirst: 'count', habit: 'counts out loud', grewFrom: 'frames of twelve to count, counting heads to counting out loud' },
      radio: { ready: 'Front room. Four people, three sitting, one by the window.', strained: 'Front room. Four people, three sitting.', overloaded: 'Four people.' },
    },
    page2: { line: 'One odd button rides in her breast pocket, and she turns it over while she waits.', district: 'pike' },
    page3: { kind: 'mentored', line: 'Since {place}, she says the count aloud for whoever stands next to her.' },
    openToRelationship: false,
    tieKinds: ['family_friend', 'neighbor'],
  },
  {
    personaId: 'person_042', // Minh Pham, he
    page1: {
      pressureLine: 'He draws imaginary creatures in notebook margins. In a crowd he remembers each face as a sketch.',
      contradiction: 'Sketches the person across the table. Keeps his own pages face down.',
      pattern: 'open about others, closed about self',
      markers: { length: 'medium', noticesFirst: 'faces', habit: 'ends on a question', grewFrom: 'sketching creatures to faces, drawing from memory to asking before acting' },
      radio: { ready: 'Side lot. Woman at the fence, lips moving. Ask her?', strained: 'Side lot. Woman at the fence, lips moving.', overloaded: 'Woman at the fence.' },
    },
    page2: { line: 'His notebook is held shut with a red rubber band.', district: 'oldmill' },
    page3: { kind: 'injured', line: 'He has drawn a small door at the bottom of every page since {place}.' },
    openToRelationship: true,
    tieKinds: ['school', 'gym'],
  },
  {
    personaId: 'person_043', // Sora Kim, they
    page1: {
      pressureLine: 'They keep tiny pressed flowers, each dated. In a kitchen they know how long a kettle has sat.',
      contradiction: "Recites each flower's date by heart. Forgets which day the squad meets.",
      pattern: 'precise with objects, loose with time',
      markers: { length: 'short', noticesFirst: 'time', habit: 'gives the clock time', grewFrom: 'dated flowers and how long the kettle has sat to time, dating to giving the clock time' },
      radio: { ready: 'Back room, 8:05. Kettle cold. Holding.', strained: 'Back room. Kettle cold.', overloaded: 'Back room, 8:05.' },
    },
    page2: { line: 'A tin of paper slips sits in their bag, each marked with the day and the hour.', district: 'larkin' },
    page3: { kind: 'negotiated', line: 'Following {place}, they write the hour the talking began on a slip and keep it.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'old_job'],
  },
  {
    personaId: 'person_044', // Joon Seo, he
    page1: {
      pressureLine: 'He builds simple acoustic instruments. In a stairwell he hears which door is hollow and which is solid.',
      contradiction: "Won't sing in public. Hears a flat note across a workshop.",
      pattern: 'good at what they avoid',
      markers: { length: 'short', noticesFirst: 'sound', habit: 'says copy and nothing else', grewFrom: 'instruments and hollow doors to sound, a maker who listens more than he talks to copy' },
      radio: { ready: 'Stairwell. Third floor quiet, hollow door. Copy.', strained: 'Stairwell. Third floor quiet, hollow door.', overloaded: 'Third floor quiet.' },
    },
    page2: { line: 'A tuning fork lives in his shirt pocket, and he taps it against the door of the van.', district: 'harbor' },
    page3: { kind: 'favorable_under_pressure', line: 'Ever since {place}, he taps the fork once on the stair rail before he moves.' },
    openToRelationship: false,
    tieKinds: ['gym', 'family_friend'],
  },
  {
    personaId: 'person_045', // Yuki Tanaka, she
    page1: {
      pressureLine: 'She follows the history of street names. When a caller gives an old landmark, she knows the corner.',
      contradiction: "Can give any corner's three old names. Forgets her own street number.",
      pattern: 'careful here, careless there',
      markers: { length: 'medium', noticesFirst: 'words', habit: 'names the street', grewFrom: 'street names and the caller giving an old landmark to words, knowing the corner to naming the street' },
      radio: { ready: 'Alder Street corner. Caller said bakery, same spot. Holding.', strained: 'Alder corner. Caller said bakery, same spot.', overloaded: 'Caller said bakery.' },
    },
    page2: { line: 'Her street index has the old names penciled in beside the new.', district: 'eastgate' },
    page3: { kind: 'negotiated', line: 'From {place} on, she asks every caller what the street used to be called.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'school'],
  },
  {
    personaId: 'person_046', // Ren Watanabe, he
    page1: {
      pressureLine: 'He binds notebooks from reclaimed paper by hand. At a tense door he reads hands before faces.',
      contradiction: 'Awl and needles sorted by size. The rest lives in a heap.',
      pattern: 'tidy kit, chaotic locker',
      markers: { length: 'short', noticesFirst: 'hands', habit: 'describes hands first', grewFrom: 'binding by hand to hands, reading a room to describing hands first' },
      radio: { ready: 'Cellar door. Both hands empty, palms out.', strained: 'Cellar door. Both hands empty.', overloaded: 'Hands empty.' },
    },
    page2: { line: 'He creases every paper form flat with a bone folder from his jacket.', district: 'larkin' },
    page3: { kind: 'injured', line: 'He bound a new notebook once {place} was closed and left the first page blank.' },
    openToRelationship: false,
    tieKinds: ['old_job', 'family_friend'],
  },
  {
    personaId: 'person_047', // Haru Mori, they
    page1: {
      pressureLine: 'They paint small watercolors of bridges. At a window they say which way the light is coming from.',
      contradiction: 'Talks arches all evening. Reports in fragments.',
      pattern: 'loud off duty, spare on the radio',
      markers: { length: 'medium', noticesFirst: 'light', habit: 'names the next step', grewFrom: 'watercolor and where the light comes from to light, painting a span at a time to naming the next step' },
      radio: { ready: 'Side stairs. Lamp lit on two. Floor three next.', strained: 'Side stairs. Lamp lit on two.', overloaded: 'Lamp lit on two.' },
    },
    page2: { line: 'Their watercolor tin is the size of a matchbook and fits a shirt pocket.', district: 'pike' },
    page3: { kind: 'first_call', line: 'They painted the front of {place} inside the lid of the paint tin.' },
    openToRelationship: false,
    tieKinds: ['school', 'family_friend'],
  },
  {
    personaId: 'person_048', // Wen Liu, she
    page1: {
      pressureLine: 'She mends split ceramic ornaments. In a hallway she spots what was already chipped before the call.',
      contradiction: "Glues the squad's chipped plates back whole. Eats off the worst one.",
      pattern: 'fixes for others',
      markers: { length: 'medium', noticesFirst: 'gear', habit: 'names the person', grewFrom: 'mending ornaments and spotting the old chip to gear, a shelf kept by name to naming the person' },
      radio: { ready: 'Hall. Bag split open, Ruiz beside it. Holding.', strained: 'Hall. Bag split open, Ruiz beside it.', overloaded: 'Bag split open.' },
    },
    page2: { line: 'Her bag holds a pot of glue and a toothpick.', district: 'harbor' },
    page3: { kind: 'mentored', line: 'Her partner glued the first seam at {place}, and now whoever stands beside her does.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'gym'],
  },
  {
    personaId: 'person_049', // Jian Wu, he
    page1: {
      pressureLine: "He shoots long exposures of city lights. At a shut door he knows how long it's been shut.",
      contradiction: 'Has everyone hold still for a shot. Fidgets through his own.',
      pattern: 'gives advice, skips it',
      markers: { length: 'short', noticesFirst: 'time', habit: 'gives the clock time', grewFrom: 'long exposures to time, counting seconds without a watch to giving the clock time' },
      radio: { ready: 'Gate chained at 11:40. Rear lot empty.', strained: 'Gate chained. Rear lot empty.', overloaded: 'Rear lot, 11:40.' },
    },
    page2: { line: 'A small kitchen timer hangs on a lanyard under his shirt.', district: 'oldmill' },
    page3: { kind: 'favorable_under_pressure', line: 'Now he glances at the timer once a call, after he stopped watching it at {place}.' },
    openToRelationship: false,
    tieKinds: ['old_job', 'school'],
  },
  {
    personaId: 'person_050', // Alina Zhang, she
    page1: {
      pressureLine: "She cuts collage postcards from old magazines. Across a room she spots the one thing that doesn't match.",
      contradiction: 'Cuts a clean edge freehand. Mails each card weeks after writing it.',
      pattern: 'precise with objects, loose with time',
      markers: { length: 'medium', noticesFirst: 'gear', habit: 'ends on a question', grewFrom: 'collage and the one piece that does not match to gear, cutting before pasting to asking before acting' },
      radio: { ready: 'Hall. Bag by the door, zipper open. Check it?', strained: 'Hall. Bag by the door, zipper open.', overloaded: 'Bag by the door.' },
    },
    page2: { line: 'Small scissors hang from a string around her neck.', district: 'eastgate' },
    page3: { kind: 'rescue', line: 'After {place}, she hands each resident a blank postcard to write on while they wait.' },
    openToRelationship: true,
    tieKinds: ['family_friend', 'gym'],
  },
  {
    personaId: 'person_051', // Siti Prasetyo, she
    page1: {
      pressureLine: 'She grows miniature tomatoes on a balcony. She knows which windows in a block get the sun.',
      contradiction: 'Dislikes tomatoes. Picks the ripest one every time.',
      pattern: 'good at what they avoid',
      markers: { length: 'short', noticesFirst: 'light', habit: 'says copy and nothing else', grewFrom: 'a sunny balcony and windows that get the sun to light, a gardener who waits to copy' },
      radio: { ready: 'Third floor. Lamp on, curtain pulled. Copy.', strained: 'Third floor. Lamp on, curtain pulled.', overloaded: 'Third floor, lamp on.' },
    },
    page2: { line: 'A packet of tomato seeds rides in the lining of her coat.', district: 'harbor' },
    page3: { kind: 'injured', line: 'She has opened the blinds first thing every morning since {place}.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_052', // Aditya Santoso, he
    page1: {
      pressureLine: 'He repairs secondhand portable speakers. In a house he picks out the one appliance that has gone quiet.',
      contradiction: 'Plays bench speakers at full volume. Gives the handset one clipped line.',
      pattern: 'loud off duty, spare on the radio',
      markers: { length: 'short', noticesFirst: 'sound', habit: 'reports gear before people', grewFrom: 'repairing speakers and a humming appliance to sound, testing the equipment first to reporting gear before people' },
      radio: { ready: 'Garage. Handset good, bag here. Compressor running.', strained: 'Garage. Compressor running.', overloaded: 'Compressor running.' },
    },
    page2: { line: 'His bag holds side cutters and a coil of solder.', district: 'larkin' },
    page3: { kind: 'first_call', line: "He taped a spare fuse behind the van's rear light after {place}." },
    openToRelationship: false,
    tieKinds: ['gym', 'old_job'],
  },
  {
    personaId: 'person_053', // Nur Aisyah Rahim, she
    page1: {
      pressureLine: "She logs one autumn tree's colors daily. She can tell how long ago a room last changed.",
      contradiction: 'Nags everyone to log things fresh. Her log trails a week.',
      pattern: 'gives advice, skips it',
      markers: { length: 'medium', noticesFirst: 'time', habit: 'gives the clock time', grewFrom: 'logging a tree daily to time, dating every entry to giving the clock time' },
      radio: { ready: 'Walkway, 4:50. Back door shut ten minutes now. Holding.', strained: 'Walkway. Back door shut ten minutes now.', overloaded: 'Walkway, 4:50.' },
    },
    page2: { line: 'Her notebook has a pencil on a string and a date on every page.', district: 'eastgate' },
    page3: { kind: 'favorable_under_pressure', line: 'She writes the hour at the top of a fresh page before each call, a change from {place}.' },
    openToRelationship: false,
    tieKinds: ['school', 'neighbor'],
  },
  {
    personaId: 'person_054', // Amir Lim, he
    page1: {
      pressureLine: 'He pockets pebbles on walks and knows the count by feel. In a doorway he has the headcount.',
      contradiction: 'Keeps a jar of pebbles. Leaves the best one on a bench.',
      pattern: 'keeps things, then gives them away',
      markers: { length: 'short', noticesFirst: 'count', habit: 'counts out loud', grewFrom: 'pebbles in a pocket to count, knowing the number by feel to counting out loud' },
      radio: { ready: 'Side yard. Three on the porch.', strained: 'Side yard. Three people.', overloaded: 'Three people.' },
    },
    page2: { line: 'A pebble rides in each of his jacket pockets, clicked together while he waits.', district: 'pike' },
    page3: { kind: 'rescue', line: 'He leaves a pebble on the nearest sill once the last resident is out, starting with {place}.' },
    openToRelationship: true,
    tieKinds: ['gym', 'neighbor'],
  },
  {
    personaId: 'person_055', // Chenda Sok, she
    page1: {
      pressureLine: 'She weaves small baskets from paper strips. On a landing she watches what people do with their hands.',
      contradiction: 'Weaves a basket for every desk. Her desk stays bare.',
      pattern: 'fixes for others',
      markers: { length: 'medium', noticesFirst: 'hands', habit: 'describes hands first', grewFrom: 'weaving by hand to hands, watching what hands do to describing hands first' },
      radio: { ready: 'Back door. Hands loose at the sides, nothing in them.', strained: 'Back door. Hands loose at the sides.', overloaded: 'Hands loose, empty.' },
    },
    page2: { line: 'She weaves a few rows from a bag of paper strips when the van is parked.', district: 'oldmill' },
    page3: { kind: 'mentored', line: 'She passes a paper strip to whoever waits beside her, as she first did with her partner at {place}.' },
    openToRelationship: false,
    tieKinds: ['family_friend', 'school'],
  },
  {
    personaId: 'person_056', // Dara Vann, they
    page1: {
      pressureLine: "They keep a notebook of overheard phrases. On a call they can give a caller's words back exactly.",
      contradiction: "Writes down strangers' best lines. Has never read one aloud.",
      pattern: 'open about others, closed about self',
      markers: { length: 'medium', noticesFirst: 'words', habit: 'repeats the last thing said', grewFrom: 'a notebook of overheard phrases to words, giving a caller back exactly to repeating the last thing said' },
      radio: { ready: "Garage. Caller said 'on the left.' On the left. Holding.", strained: "Garage. Caller said 'on the left.' Holding.", overloaded: 'Caller said left.' },
    },
    page2: { line: 'Their notebook travels in a zippered bag with a golf pencil.', district: 'harbor' },
    page3: { kind: 'negotiated', line: 'They started shutting the notebook on the last thing said at {place}.' },
    openToRelationship: false,
    tieKinds: ['old_job', 'neighbor'],
  },
  {
    personaId: 'person_057', // Kanya Chaiyaporn, she
    page1: {
      pressureLine: 'She builds tiny cardboard furniture for miniature rooms. In any room she sees which chair blocks the door.',
      contradiction: 'Sets every model chair square. Never pushes in her own.',
      pattern: 'careful here, careless there',
      markers: { length: 'short', noticesFirst: 'exits', habit: 'names the next step', grewFrom: 'furniture placed in a room to exits, building a room one piece at a time to naming the next step' },
      radio: { ready: 'Den. Chair against side door. Kitchen next.', strained: 'Den. Chair against side door.', overloaded: 'Chair blocks side door.' },
    },
    page2: { line: 'A folding ruler and masking tape ride in her bag.', district: 'eastgate' },
    page3: { kind: 'injured', line: 'She checks the floor before stepping through a doorway, as she began to do after {place}.' },
    openToRelationship: true,
    tieKinds: ['school', 'gym'],
  },
  {
    personaId: 'person_058', // Niran Srisai, he
    page1: {
      pressureLine: 'He tends a communal pond garden. In a quiet block he hears the moment the frogs go silent.',
      contradiction: "Weeds everyone's plot first. His own is knee-high.",
      pattern: 'fixes for others',
      markers: { length: 'medium', noticesFirst: 'sound', habit: 'names the person', grewFrom: 'a pond garden to sound, knowing the neighbors by name to naming the person' },
      radio: { ready: 'Back lot. Frogs gone quiet. Ruiz by the shed.', strained: 'Back lot. Frogs gone quiet.', overloaded: 'Frogs gone quiet.' },
    },
    page2: { line: 'A pair of waders stays folded behind the van seat.', district: 'larkin' },
    page3: { kind: 'favorable_under_pressure', line: "He asks the neighbors' names while the others set up, something he began at {place}." },
    openToRelationship: true,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_059', // May Thiri Aung, she
    page1: {
      pressureLine: 'She collects illustrated field guides. At a large scene she tells people apart by one small mark each.',
      contradiction: 'Guides shelved by habitat and season. Receipts live loose in her pocket.',
      pattern: 'tidy kit, chaotic locker',
      markers: { length: 'medium', noticesFirst: 'faces', habit: 'ends on a question', grewFrom: 'field guides and small marks to faces, naming a species by checking to asking before acting' },
      radio: { ready: 'Lobby. Man in yellow keeps glancing up. Ask him?', strained: 'Lobby. Man in yellow keeps glancing up.', overloaded: 'Man in yellow.' },
    },
    page2: { line: 'A worn pocket bird guide lives in her jacket.', district: 'harbor' },
    page3: { kind: 'first_call', line: 'She wrote the address of {place} on the first free line of her field guide.' },
    openToRelationship: false,
    tieKinds: ['old_job', 'school'],
  },
  {
    personaId: 'person_060', // Andrei Bautista, he
    page1: {
      pressureLine: 'He rebuilds old film cameras and feels a half second pass. He knows the minute without a clock.',
      contradiction: 'Rebuilds cameras all winter. Passes each on before one roll is shot.',
      pattern: 'keeps things, then gives them away',
      markers: { length: 'short', noticesFirst: 'time', habit: 'names the next step', grewFrom: 'shutter speeds to time, setting each part in order to naming the next step' },
      radio: { ready: 'Porch, 3:20. Screen door ajar. Yard next.', strained: 'Porch, 3:20. Screen door ajar.', overloaded: 'Porch, 3:20.' },
    },
    page2: { line: 'Black tape on his belt closes any gap that lets light through.', district: 'pike' },
    page3: { kind: 'mentored', line: 'At {place} he called out the minute beside a colleague, and the squad calls it now.' },
    openToRelationship: true,
    tieKinds: ['gym', 'family_friend'],
  },
  {
    personaId: 'person_061', // Leila Benali, she
    page1: {
      pressureLine: "She draws maps of towns that don't exist. On arrival she asks what the real map left out.",
      contradiction: "Never drives. Reads every street sign aloud from the passenger seat.",
      pattern: 'good at what they avoid',
      markers: { length: 'medium', noticesFirst: 'exits', habit: 'names the street', grewFrom: 'drawing a town to exits, knowing what the map left out to naming the street' },
      radio: { ready: 'Alley, Pell Road side. Gate open, yard empty. Holding.', strained: 'Alley. Gate open, yard empty.', overloaded: 'Alley. Gate open.' },
    },
    page2: { line: 'Her made-up town sits folded in a back pocket, with the margins full of streets.', district: 'eastgate' },
    page3: { kind: 'rescue', line: 'She added the back lane of {place} to her map, in red.' },
    openToRelationship: false,
    tieKinds: ['family_friend', 'old_job'],
  },
  {
    personaId: 'person_062', // Youssef Mansouri, he
    page1: {
      pressureLine: 'He collects and repairs old fountain pens. At a scene he reads a hurried note at a glance.',
      contradiction: "Refills pens for the whole floor. Signs his own forms in pencil.",
      pattern: 'fixes for others',
      markers: { length: 'medium', noticesFirst: 'words', habit: 'repeats the last thing said', grewFrom: 'fountain pens and hurried handwriting to words, reading a note back to repeating the last thing said' },
      radio: { ready: "Table. Note says 'back in five.' Back in five. Holding.", strained: "Table. Note says 'back in five.'", overloaded: 'Note says five.' },
    },
    page2: { line: 'His fountain pen is always loaded, and a blotter rides in his bag.', district: 'oldmill' },
    page3: { kind: 'negotiated', line: "He has written down the caller's last sentence before answering since {place}." },
    openToRelationship: true,
    tieKinds: ['school', 'old_job'],
  },
  {
    personaId: 'person_063', // Nour Khoury, they
    page1: {
      pressureLine: 'They photograph the shadows railings cast. On a stair they see a shadow move when nothing else does.',
      contradiction: 'Mounts prints dead level. Their kit bag is a jumble.',
      pattern: 'tidy kit, chaotic locker',
      markers: { length: 'medium', noticesFirst: 'light', habit: 'says copy and nothing else', grewFrom: 'railing shadows to light, a photographer who waits for the frame to copy' },
      radio: { ready: 'Stairs. Dark on the landing, shadow moving. Copy.', strained: 'Stairs. Dark on the landing, shadow moving.', overloaded: 'Dark landing, shadow moving.' },
    },
    page2: { line: 'They sweep a pocket flashlight low along the wall.', district: 'harbor' },
    page3: { kind: 'favorable_under_pressure', line: 'They held the light low at {place} while the clock ran high.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'gym'],
  },
  {
    personaId: 'person_064', // Dalia Nasser, she
    page1: {
      pressureLine: 'She keeps a lending shelf of travel essays. In a hall she remembers who came in with what.',
      contradiction: 'Lends out her favorite essays. Has stopped counting which are gone.',
      pattern: 'keeps things, then gives them away',
      markers: { length: 'medium', noticesFirst: 'faces', habit: 'repeats the last thing said', grewFrom: 'a lending shelf to faces and who holds what, passing a book along to repeating the last thing said' },
      radio: { ready: "Hall door. Woman said 'two minutes.' Two minutes. Holding.", strained: "Hall door. Woman said 'two minutes.'", overloaded: 'Woman at the door.' },
    },
    page2: { line: 'Three paperback essays sit in her satchel, each with a name on the flyleaf.', district: 'eastgate' },
    page3: { kind: 'first_call', line: 'She left a travel essay on the break room shelf after {place}, for whoever wants one.' },
    openToRelationship: false,
    tieKinds: ['family_friend', 'school'],
  },
  {
    personaId: 'person_065', // Reza Mehr, he
    page1: {
      pressureLine: 'He folds geometric paper constructions. He counts the corners of a room, and who is standing in each.',
      contradiction: 'Teaches anyone a fold. Shows no one his best piece.',
      pattern: 'open about others, closed about self',
      markers: { length: 'short', noticesFirst: 'count', habit: 'names the person', grewFrom: 'folding to count, a piece made for one person to naming the person' },
      radio: { ready: 'Den. Three here. Ruiz standing, two seated.', strained: 'Den. Three here, two seated.', overloaded: 'Three here.' },
    },
    page2: { line: 'A stack of precut paper squares fills his breast pocket.', district: 'pike' },
    page3: { kind: 'negotiated', line: 'Whenever the line is open, he folds a small paper box, as he first did at {place}.' },
    openToRelationship: false,
    tieKinds: ['old_job', 'gym'],
  },
  {
    personaId: 'person_066', // Shirin Azadi, she
    page1: {
      pressureLine: 'She collects small stories about lost objects. When she arrives she asks first what someone left behind.',
      contradiction: 'Logs each lost thing. Mails the page to its owner.',
      pattern: 'keeps things, then gives them away',
      markers: { length: 'medium', noticesFirst: 'gear', habit: 'reports gear before people', grewFrom: 'stories of lost objects to gear, asking what was left behind to reporting gear before people' },
      radio: { ready: 'Landing. Bag on the stairs, owner two steps up. Holding.', strained: 'Landing. Bag on the stairs, owner two steps up.', overloaded: 'Bag on the stairs.' },
    },
    page2: { line: 'Her notebook says where every lost item was found.', district: 'larkin' },
    page3: { kind: 'rescue', line: 'A page in her notebook lists what each resident carried out of {place}.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'old_job'],
  },
  {
    personaId: 'person_067', // Aram Sarkisian, he
    page1: {
      pressureLine: 'He repairs chess sets with pieces missing. In a room he counts who is here before who left.',
      contradiction: 'Explains openings the whole ride in. Radio traffic is one number.',
      pattern: 'loud off duty, spare on the radio',
      markers: { length: 'medium', noticesFirst: 'count', habit: 'counts out loud', grewFrom: 'sets with pieces missing to count, counting what is on the board to counting out loud' },
      radio: { ready: 'Basement. Eight steps down, two doors, one open.', strained: 'Basement. Eight steps down, two doors.', overloaded: 'Two doors.' },
    },
    page2: { line: 'He sets a handmade pawn on the dash at the start of every shift.', district: 'oldmill' },
    page3: { kind: 'injured', line: 'After {place}, he lays the pawn on its side and stands it up before the next call.' },
    openToRelationship: false,
    tieKinds: ['school', 'family_friend'],
  },
  {
    personaId: 'person_068', // Elif Demir, she
    page1: {
      pressureLine: 'She photographs colorful doors. At a threshold she says which way a door swings before anyone touches it.',
      contradiction: 'Shows everyone her door photos. Never says which one is hers.',
      pattern: 'open about others, closed about self',
      markers: { length: 'medium', noticesFirst: 'exits', habit: 'names the person', grewFrom: 'photographing doors to exits, a photographer who knows each door to naming the person' },
      radio: { ready: 'Side entrance. Door opens out. Ruiz holds the door.', strained: 'Side entrance. Door opens out.', overloaded: 'Door opens out.' },
    },
    page2: { line: 'Her paint chip card has her favorite door colors circled.', district: 'harbor' },
    page3: { kind: 'favorable_under_pressure', line: 'At {place} she began naming the swing of each door before anyone stepped up.' },
    openToRelationship: true,
    tieKinds: ['gym', 'school'],
  },
  {
    personaId: 'person_069', // Deniz Kaya, they
    page1: {
      pressureLine: 'They build custom organizers for art supplies. In a van they see at once which slot is empty.',
      contradiction: "Dreads filing. The whole squad's paperwork lives in their organizer.",
      pattern: 'good at what they avoid',
      markers: { length: 'medium', noticesFirst: 'gear', habit: 'reports gear before people', grewFrom: 'organizers for supplies to gear, a slot for every item to reporting gear before people' },
      radio: { ready: 'Staging. Shield and bag here, one handset short. Holding.', strained: 'Staging. Shield and bag here, one handset short.', overloaded: 'One handset short.' },
    },
    page2: { line: 'A roll of labeled tape marks any slot that changed.', district: 'eastgate' },
    page3: { kind: 'mentored', line: "They labeled a slot in the bag with their partner's name after {place}." },
    openToRelationship: false,
    tieKinds: ['old_job', 'neighbor'],
  },
];
