// Service jackets, batch D (person_070 to person_100). See jackets.ts for the rules every jacket holds to.
// Authored under swat-officer-stories; the officer record is docs/calls/notes/jackets-d.md.
import type { Jacket } from './jackets';

export const AUTHORED_D: Jacket[] = [
  {
    personaId: 'person_070', // Eitan Levi
    page1: {
      pressureLine: "He catalogs old photographs of his neighborhood. In any room he counts the people first.",
      contradiction: "Numbers every print. Gives the originals to whoever knows the corner.",
      pattern: "keeps things, then gives them away",
      markers: { length: 'medium', noticesFirst: 'count', habit: "counts out loud", grewFrom: "counting the people in a room to counting out loud, cataloguing to the count" },
      radio: { ready: "Living room. Two on the couch, one standing. Holding.", strained: "Living room. Two on the couch, one standing.", overloaded: "Two on the couch." },
    },
    page2: { line: "His jacket holds a tally card with one punched hole for each person.", district: 'larkin' },
    page3: { kind: 'first_call', line: "Since {place}, he writes the first count of every call on his tally card." },
    openToRelationship: true,
    tieKinds: ['neighbor', 'school'],
  },
  {
    personaId: 'person_071', // Miriam Rosen
    page1: {
      pressureLine: "She hand-paints signs for a community garden. On a landing she reads every notice.",
      contradiction: "Paints a sign for every plot. Her own plot has none.",
      pattern: "fixes for others",
      markers: { length: 'medium', noticesFirst: 'words', habit: "repeats the last thing said", grewFrom: "signs and notices to words, reading a sign back to repeating it" },
      radio: { ready: "Hallway. Sign says 'closed today.' Closed today. Holding.", strained: "Hallway. Sign says 'closed today.' Holding.", overloaded: "Sign says closed." },
    },
    page2: { line: "She carries a wide brush in her jacket, the bristles tucked into a paper napkin.", district: 'oldmill' },
    page3: { kind: 'negotiated', line: "Since {place}, she reads the sign by the door aloud before anyone knocks." },
    openToRelationship: false,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_072', // Aleksei Morozov
    page1: {
      pressureLine: "He records odd machine noises and can pick a running engine out of a whole street.",
      contradiction: "Records every engine on the block. Plays his tapes for nobody.",
      pattern: "open about others, closed about self",
      markers: { length: 'medium', noticesFirst: 'sound', habit: "names the street", grewFrom: "machine noises to sound, picking one engine out of a whole street to naming the street" },
      radio: { ready: "Lot off Mercer Street. Engine running, nobody in it. Holding.", strained: "Back lot. Engine running, nobody in it.", overloaded: "Engine still running." },
    },
    page2: { line: "He carries a pocket recorder, the red light covered with electrical tape.", district: 'eastgate' },
    page3: { kind: 'favorable_under_pressure', line: "After {place}, he gives the street name before he gives the sound." },
    openToRelationship: false,
    tieKinds: ['old_job', 'gym'],
  },
  {
    personaId: 'person_073', // Kateryna Bondar
    page1: {
      pressureLine: "She designs small balcony bird feeders. In a courtyard she hears the birds go quiet first.",
      contradiction: "Tells neighbors to rinse feeders. Hers sits crusted all summer.",
      pattern: "gives advice, skips it",
      markers: { length: 'medium', noticesFirst: 'sound', habit: "names the next step", grewFrom: "birds going quiet to sound, watching a courtyard from the feeder to naming the next floor" },
      radio: { ready: "Courtyard. Birds gone quiet, third floor window open. Stairs next.", strained: "Courtyard. Birds gone quiet, third floor window open.", overloaded: "Birds gone quiet." },
    },
    page2: { line: "A paper cone of sunflower seed rides in her jacket pocket.", district: 'pike' },
    page3: { kind: 'rescue', line: "After {place}, she hangs a feeder outside the garage and fills it first." },
    openToRelationship: true,
    tieKinds: ['school', 'gym'],
  },
  {
    personaId: 'person_074', // Mateusz Zieliński
    page1: {
      pressureLine: "He restores old wooden picture frames and runs a thumb along every doorframe for pry marks.",
      contradiction: "Cuts a mitre true to the hair. Delivers frames a year late.",
      pattern: "precise with objects, loose with time",
      markers: { length: 'short', noticesFirst: 'exits', habit: "says copy and nothing else", grewFrom: "doorframes to exits, a frame restorer working in few words to copy" },
      radio: { ready: "Back door, fresh scratches. Copy.", strained: "Back door, fresh scratches.", overloaded: "Back door scratched." },
    },
    page2: { line: "His coat holds a tin of beeswax for any squeaking hinge.", district: 'harbor' },
    page3: { kind: 'first_call', line: "After {place}, he checks the frame of the first door he reaches." },
    openToRelationship: false,
    tieKinds: ['old_job', 'neighbor'],
  },
  {
    personaId: 'person_075', // Ivana Kovač
    page1: {
      pressureLine: "She draws unusual public benches. In a waiting room she notices who sits alone.",
      contradiction: "Draws each bench to scale. The drawings live loose in a shoebox.",
      pattern: "tidy kit, chaotic locker",
      markers: { length: 'medium', noticesFirst: 'faces', habit: "ends on a question", grewFrom: "who sits on the bench to faces, noticing someone alone to asking about them" },
      radio: { ready: "Lobby. Man alone by the door, watching us. Ask him?", strained: "Lobby. Man alone by the door, watching us.", overloaded: "Man alone, watching." },
    },
    page2: { line: "Her pocket sketchbook has one bench to a page.", district: 'oldmill' },
    page3: { kind: 'negotiated', line: "After {place}, she takes the seat at the end of the row." },
    openToRelationship: true,
    tieKinds: ['school', 'neighbor'],
  },
  {
    personaId: 'person_076', // Luka Petrović
    page1: {
      pressureLine: "He shapes small clay animals. In a room he looks at hands before faces.",
      contradiction: "Makes a clay fox a shift. Gives it away by the next.",
      pattern: "keeps things, then gives them away",
      markers: { length: 'short', noticesFirst: 'hands', habit: "describes hands first", grewFrom: "shaping clay to hands, looking at hands before faces to describing hands first" },
      radio: { ready: "Landing. Hands empty, on the rail. Holding.", strained: "Landing. Hands empty, on the rail.", overloaded: "Hands empty." },
    },
    page2: { line: "He warms a lump of clay in his coat pocket on every ride out.", district: 'pike' },
    page3: { kind: 'injured', line: "After {place}, he carries a spare clay animal for whoever sits down first." },
    openToRelationship: false,
    tieKinds: ['gym', 'neighbor'],
  },
  {
    personaId: 'person_077', // Eszter Varga
    page1: {
      pressureLine: "She makes colorful covers for secondhand notebooks and reads what the last owner wrote.",
      contradiction: "Cuts covers to the millimeter. Her own notebook goes bare.",
      pattern: "careful here, careless there",
      markers: { length: 'medium', noticesFirst: 'words', habit: "repeats the last thing said", grewFrom: "what the last owner wrote to words, reading it back to repeating it" },
      radio: { ready: "Kitchen. Note on the table says 'back soon.' Back soon.", strained: "Kitchen. Note on the table says 'back soon.'", overloaded: "Note says back soon." },
    },
    page2: { line: "Scraps of bright paper ride in her pocket, folded small.", district: 'larkin' },
    page3: { kind: 'mentored', line: "After {place}, she covers a notebook in bright paper for each newcomer." },
    openToRelationship: true,
    tieKinds: ['gym', 'family_friend'],
  },
  {
    personaId: 'person_078', // Nikos Papadakis
    page1: {
      pressureLine: "He restores old kitchen scales. He can tell what a bag weighs by lifting it.",
      contradiction: "Every brass weight is polished and boxed. His locker door won't shut.",
      pattern: "tidy kit, chaotic locker",
      markers: { length: 'medium', noticesFirst: 'gear', habit: "reports gear before people", grewFrom: "what a bag weighs to gear, weighing the load first to reporting gear before people" },
      radio: { ready: "Side steps. Bag and shield here. Two of us.", strained: "Side steps. Bag and shield here.", overloaded: "Bag and shield." },
    },
    page2: { line: "He turns a brass gram weight over in his trouser pocket while he waits.", district: 'oldmill' },
    page3: { kind: 'rescue', line: "Since {place}, he stows a spare case of water bottles behind the van seat." },
    openToRelationship: false,
    tieKinds: ['old_job', 'neighbor'],
  },
  {
    personaId: 'person_079', // Francesca Moretti
    page1: {
      pressureLine: "She keeps a train station journal. In any building she asks where each exit leads.",
      contradiction: "Hates a crowded platform. Still the one who finds the right exit.",
      pattern: "good at what they avoid",
      markers: { length: 'medium', noticesFirst: 'exits', habit: "gives the clock time", grewFrom: "stations and platforms to exits, a station journal kept by departure time to the clock time" },
      radio: { ready: "Rear door, 6:40. Locked from outside. Fire stairs open.", strained: "Rear door. Locked from outside. Fire stairs open.", overloaded: "Rear door locked." },
    },
    page2: { line: "She carries a folded transit map with a station circled in pencil.", district: 'eastgate' },
    page3: { kind: 'rescue', line: "After {place}, she writes the exit the resident used in her journal." },
    openToRelationship: false,
    tieKinds: ['family_friend', 'old_job'],
  },
  {
    personaId: 'person_080', // Luca Romano
    page1: {
      pressureLine: "They make small lamps from discarded glass jars. At night they notice which window is lit.",
      contradiction: "Labels every lamp cord. Their duffel is a nest of loose bulbs.",
      pattern: "tidy kit, chaotic locker",
      markers: { length: 'short', noticesFirst: 'light', habit: "says copy and nothing else", grewFrom: "lamps and windows to light, short acknowledgements to copy" },
      radio: { ready: "Alley, second floor. One lamp lit. Copy.", strained: "Alley, second floor. One lamp lit.", overloaded: "One lamp lit." },
    },
    page2: { line: "They carry a spare bulb in their jacket, wrapped in a sock.", district: 'pike' },
    page3: { kind: 'first_call', line: "Since {place}, they ask which lamp was on when the call came in." },
    openToRelationship: true,
    tieKinds: ['neighbor', 'school'],
  },
  {
    personaId: 'person_081', // Camille Dubois
    page1: {
      pressureLine: "They photograph weathered painted walls in raking light and spot fresh paint across the street.",
      contradiction: "Hate being in photographs. Take the squad picture every year.",
      pattern: "good at what they avoid",
      markers: { length: 'medium', noticesFirst: 'light', habit: "names the street", grewFrom: "raking light to light, spotting a coat from across the street to naming the street" },
      radio: { ready: "Alder Street side. Light on in the cellar window.", strained: "Side wall. Light on in the cellar window.", overloaded: "Cellar light on." },
    },
    page2: { line: "A paint chip card lives in their pocket, and they hold it against any wall.", district: 'larkin' },
    page3: { kind: 'favorable_under_pressure', line: "Since {place}, they hold the paint card to the wall before they move." },
    openToRelationship: false,
    tieKinds: ['neighbor', 'old_job'],
  },
  {
    personaId: 'person_082', // Étienne Laurent
    page1: {
      pressureLine: "He collects old pocket dictionaries and writes down any word a caller uses twice.",
      contradiction: "Looks up words squadmates coin. Keeps his own to himself.",
      pattern: "open about others, closed about self",
      markers: { length: 'medium', noticesFirst: 'words', habit: "repeats the last thing said", grewFrom: "dictionary words and a caller using one twice to words, noting it down to repeating it" },
      radio: { ready: "Landing. Caller says 'asleep.' Asleep. Door is shut.", strained: "Landing. Caller says 'asleep.' Door is shut.", overloaded: "Caller says asleep." },
    },
    page2: { line: "He keeps a pocket dictionary in his vest with an elastic cord around it.", district: 'oldmill' },
    page3: { kind: 'negotiated', line: "Since {place}, he hands the caller's last word back before he says his own." },
    openToRelationship: true,
    tieKinds: ['school', 'old_job'],
  },
  {
    personaId: 'person_083', // Inés García
    page1: {
      pressureLine: "She restores faded family photographs. In a crowded room she finds the face that looks away.",
      contradiction: "Restores neighbors' photographs for free. Her own albums fade in a drawer.",
      pattern: "fixes for others",
      markers: { length: 'medium', noticesFirst: 'faces', habit: "names the next step", grewFrom: "faces in old photographs to faces, working through a room one person at a time to the next step" },
      radio: { ready: "Hall. Woman at the end looking away. Kitchen next.", strained: "Hall. Woman at the end looking away.", overloaded: "Woman looking away." },
    },
    page2: { line: "White cotton gloves are tucked in her belt.", district: 'pike' },
    page3: { kind: 'person_lost', line: "After {place}, she kept one faded photograph unrestored in her back pocket." },
    openToRelationship: true,
    tieKinds: ['family_friend', 'neighbor'],
  },
  {
    personaId: 'person_084', // Rafael Costa
    page1: {
      pressureLine: "He stacks beach pebbles into small sculptures. He notices a hand that goes into a pocket.",
      contradiction: "Keeps each pebble sculpture a week. Then leaves it on someone's desk.",
      pattern: "keeps things, then gives them away",
      markers: { length: 'short', noticesFirst: 'hands', habit: "describes hands first", grewFrom: "stacking pebbles by hand to hands, a hand going into a pocket to describing hands first" },
      radio: { ready: "Stoop. Hands in pockets, one moving. Holding.", strained: "Stoop. Hands in pockets, one moving.", overloaded: "Hands in pockets." },
    },
    page2: { line: "He turns a smooth pebble over in his pocket with his thumb.", district: 'eastgate' },
    page3: { kind: 'favorable_under_pressure', line: "After {place}, he rides with the pebble held in his hand, not his pocket." },
    openToRelationship: true,
    tieKinds: ['gym', 'neighbor'],
  },
  {
    personaId: 'person_085', // Luiza Almeida
    page1: {
      pressureLine: "She collects unusual postage stamps, postmark first. In every room she looks for a clock.",
      contradiction: "Mounts every stamp square to the page. Seals her own envelopes crooked.",
      pattern: "careful here, careless there",
      markers: { length: 'short', noticesFirst: 'time', habit: "says copy and nothing else", grewFrom: "reading the postmark first to time, a collector who files and moves on to copy" },
      radio: { ready: "Fourth floor door, 11:05. No answer. Copy.", strained: "Fourth floor door, 11:05. No answer.", overloaded: "Door, 11:05." },
    },
    page2: { line: "She keeps a pair of stamp tweezers in her vest pocket.", district: 'oldmill' },
    page3: { kind: 'injured', line: "After {place}, she says the hour aloud each time the position changes." },
    openToRelationship: false,
    tieKinds: ['old_job', 'neighbor'],
  },
  {
    personaId: 'person_086', // Valentina Rojas
    page1: {
      pressureLine: "She makes handmade paper with flower petals. In a dark room she finds the window.",
      contradiction: "Insists everyone write it down. Writes hers on her hand.",
      pattern: "gives advice, skips it",
      markers: { length: 'medium', noticesFirst: 'light', habit: "ends on a question", grewFrom: "holding a sheet to the window to light, checking what is pressed in it to asking" },
      radio: { ready: "Back room. Light under the door, shades down. Knock first?", strained: "Back room. Light under the door, shades down.", overloaded: "Light under the door." },
    },
    page2: { line: "She carries a folded sheet of handmade paper in her notebook.", district: 'harbor' },
    page3: { kind: 'favorable_under_pressure', line: "Since {place}, she asks for the shades up before she asks anything else." },
    openToRelationship: true,
    tieKinds: ['family_friend', 'neighbor'],
  },
  {
    personaId: 'person_087', // Mateo Álvarez
    page1: {
      pressureLine: "He builds miniature cardboard theaters. In a new place he finds the wings and back door.",
      contradiction: "Plays every part at lunch. Dispatch gets a few words.",
      pattern: "loud off duty, spare on the radio",
      markers: { length: 'medium', noticesFirst: 'exits', habit: "names the next step", grewFrom: "wings and back doors to exits, blocking a scene to naming the next step" },
      radio: { ready: "Lobby. Side door propped open, stairs behind it. Basement next.", strained: "Lobby. Side door propped open, stairs behind it.", overloaded: "Side door propped open." },
    },
    page2: { line: "A tiny cardboard stage rides in his bag, the curtain tied back.", district: 'larkin' },
    page3: { kind: 'rescue', line: "After {place}, he adds a door to the back wall of his cardboard stage." },
    openToRelationship: false,
    tieKinds: ['school', 'family_friend'],
  },
  {
    personaId: 'person_088', // Emilio Vargas
    page1: {
      pressureLine: "He polishes old hand tools and knows which one is missing from the bag.",
      contradiction: "Hangs every tool on its painted outline. Never closes his own drawer.",
      pattern: "careful here, careless there",
      markers: { length: 'medium', noticesFirst: 'gear', habit: "reports gear before people", grewFrom: "a missing tool to gear, a bench count to reporting gear before people" },
      radio: { ready: "Van. Shield, bag and spare radio here. Two of us.", strained: "Van. Shield, bag and spare radio here.", overloaded: "Shield, bag, radio." },
    },
    page2: { line: "He keeps a rag soaked in linseed oil in a jam jar.", district: 'pike' },
    page3: { kind: 'mentored', line: "After {place}, he lays the bag out for whoever joins, item by item." },
    openToRelationship: false,
    tieKinds: ['old_job', 'gym'],
  },
  {
    personaId: 'person_089', // Lucía Quispe
    page1: {
      pressureLine: "She photographs small wildflowers growing through sidewalk cracks and spots who stopped to look.",
      contradiction: "Can name a flower from one leaf. Loses track of the month.",
      pattern: "precise with objects, loose with time",
      markers: { length: 'medium', noticesFirst: 'faces', habit: "counts out loud", grewFrom: "people stopping at a flower to faces, counting what is in a frame to counting out loud" },
      radio: { ready: "Corner. Three watching from the stoop, one by the car.", strained: "Corner. Three watching from the stoop.", overloaded: "Three watching." },
    },
    page2: { line: "She wears a coin-sized magnifier on a cord around her neck.", district: 'eastgate' },
    page3: { kind: 'first_call', line: "Since {place}, she looks at the crowd first and the ground second." },
    openToRelationship: true,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_090', // Thomas Beaulieu
    page1: {
      pressureLine: "He catalogs old local radio recordings by broadcast time. At any door he notes the hour.",
      contradiction: "Talks old call-in shows all lunch. Radio gets the time only.",
      pattern: "loud off duty, spare on the radio",
      markers: { length: 'medium', noticesFirst: 'time', habit: "gives the clock time", grewFrom: "broadcast times to time, logging each recording to giving the clock time" },
      radio: { ready: "Hall, 11:20. Nobody on the stairs. Basement door shut.", strained: "Hall. Nobody on the stairs. Basement door shut.", overloaded: "Hall, 11:20." },
    },
    page2: { line: "He keeps index cards in his shirt pocket, each one headed with a time.", district: 'harbor' },
    page3: { kind: 'person_lost', line: "He still carries the card from {place}, with only the time written on it." },
    openToRelationship: false,
    tieKinds: ['old_job', 'neighbor'],
  },
  {
    personaId: 'person_091', // Marisol Nez
    page1: {
      pressureLine: "She embroiders tiny pictures of everyday objects. She sees what is in people's hands first.",
      contradiction: "Stitches every squadmate's loose button. Her own cuff hangs by a thread.",
      pattern: "fixes for others",
      markers: { length: 'medium', noticesFirst: 'hands', habit: "reports gear before people", grewFrom: "stitched everyday objects to hands, naming the object held before the person to gear first" },
      radio: { ready: "Hallway. Bag by his feet, hands empty. Holding.", strained: "Hallway. Bag by his feet, hands empty.", overloaded: "Hands empty." },
    },
    page2: { line: "A needle threaded in black sits through the lapel of her coat.", district: 'oldmill' },
    page3: { kind: 'negotiated', line: "After {place}, she keeps her hands where the person can see them." },
    openToRelationship: true,
    tieKinds: ['neighbor', 'school'],
  },
  {
    personaId: 'person_092', // Evan Thomas
    page1: {
      pressureLine: "He restores secondhand acoustic guitars. In a quiet house he hears what is off.",
      contradiction: "Hates being asked to play. Everyone brings him a guitar anyway.",
      pattern: "good at what they avoid",
      markers: { length: 'short', noticesFirst: 'sound', habit: "ends on a question", grewFrom: "a note that is off to sound, asking whether it should be checked to ending on a question" },
      radio: { ready: "Upstairs. Floorboard creaking, then quiet. Listen longer?", strained: "Upstairs. Floorboard creaking, then quiet.", overloaded: "Floorboard, then quiet." },
    },
    page2: { line: "He carries a tuning fork and taps it on his knee in the van.", district: 'larkin' },
    page3: { kind: 'favorable_under_pressure', line: "Since {place}, he strikes the fork once at the door and listens." },
    openToRelationship: false,
    tieKinds: ['gym', 'old_job'],
  },
  {
    personaId: 'person_093', // Talia Williams
    page1: {
      pressureLine: "She keeps a scrapbook of packaging designs and reads every label before she touches a box.",
      contradiction: "Sorts wrappers by shape and year. Her desk drifts with foil.",
      pattern: "tidy kit, chaotic locker",
      markers: { length: 'medium', noticesFirst: 'gear', habit: "names the next step", grewFrom: "labels and boxes to gear, reading before touching to naming the next step" },
      radio: { ready: "Garage. Shield and bag by the door. Back stairs next.", strained: "Garage. Shield and bag by the door.", overloaded: "Shield and bag." },
    },
    page2: { line: "A folded paper bag waits in her coat for whatever she finds.", district: 'pike' },
    page3: { kind: 'injured', line: "Since {place}, she dates the bag before she packs it." },
    openToRelationship: true,
    tieKinds: ['school', 'gym'],
  },
  {
    personaId: 'person_094', // André Baptiste
    page1: {
      pressureLine: "He repairs old music boxes for friends and counts a room like comb teeth.",
      contradiction: "Rebuilds a music box for months. Hands it over by evening.",
      pattern: "keeps things, then gives them away",
      markers: { length: 'short', noticesFirst: 'count', habit: "counts out loud", grewFrom: "counting comb teeth to count, counting a room to saying the count" },
      radio: { ready: "Back stairs. Four going up. Holding.", strained: "Back stairs. Four going up.", overloaded: "Four going up." },
    },
    page2: { line: "A small music box comb lives in a matchbox in his breast pocket.", district: 'harbor' },
    page3: { kind: 'mentored', line: "Since {place}, he lets the newest squadmate give the count first." },
    openToRelationship: false,
    tieKinds: ['old_job', 'gym'],
  },
  {
    personaId: 'person_095', // Hugo O'Connell
    page1: {
      pressureLine: "He collects sketches of unusual rooftop shapes. On a block he looks up for roof doors.",
      contradiction: "Draws rooftops for strangers on napkins. Shows nobody the sketchbook.",
      pattern: "open about others, closed about self",
      markers: { length: 'medium', noticesFirst: 'exits', habit: "names the street", grewFrom: "rooftop shapes and a roof door to exits, a block seen from above to naming the street" },
      radio: { ready: "Linden Avenue. Roof door open, fire escape down.", strained: "Roof door open, fire escape down.", overloaded: "Roof door open." },
    },
    page2: { line: "He keeps a short pencil and a folded napkin in his back pocket.", district: 'oldmill' },
    page3: { kind: 'injured', line: "Since {place}, he finds the roof access before he crosses the street." },
    openToRelationship: false,
    tieKinds: ['neighbor', 'school'],
  },
  {
    personaId: 'person_096', // Isaac Bell
    page1: {
      pressureLine: "He designs puzzles for friends to solve. At a door he finds the clue nobody read.",
      contradiction: "Swears by reading the clue twice. Skims his own.",
      pattern: "gives advice, skips it",
      markers: { length: 'medium', noticesFirst: 'words', habit: "ends on a question", grewFrom: "clues and the written word to words, setting a puzzle to asking the next question" },
      radio: { ready: "Gate. Sign says 'beware of dog.' Where is the dog?", strained: "Gate. Sign says 'beware of dog.'", overloaded: "Sign says beware." },
    },
    page2: { line: "He tucks a one-line riddle in his glove, ready for a friend to find.", district: 'harbor' },
    page3: { kind: 'negotiated', line: "Since {place}, he asks the question nobody thought to ask." },
    openToRelationship: true,
    tieKinds: ['school', 'gym'],
  },
  {
    personaId: 'person_097', // Hana Te Rangi
    page1: {
      pressureLine: "She keeps heirloom vegetable seeds in paper envelopes. She can hear a room go empty.",
      contradiction: "Writes the year on every envelope. Cannot say what month it is.",
      pattern: "precise with objects, loose with time",
      markers: { length: 'short', noticesFirst: 'sound', habit: "says copy and nothing else", grewFrom: "shaking an envelope to hear it to sound, a gardener working quietly to copy" },
      radio: { ready: "Back yard. Windows quiet, nothing running. Copy.", strained: "Back yard. Windows quiet, nothing running.", overloaded: "Nothing running." },
    },
    page2: { line: "She keeps one seed envelope in her breast pocket, labeled in pencil.", district: 'larkin' },
    page3: { kind: 'mentored', line: "After {place}, she sits the latest hire by the window and listens beside them." },
    openToRelationship: true,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_098', // Sione Tui
    page1: {
      pressureLine: "He carves simple wooden spoons. In a kitchen he sees what every hand can reach.",
      contradiction: "Carves spoons for the whole shift. Eats with a plastic fork.",
      pattern: "fixes for others",
      markers: { length: 'short', noticesFirst: 'hands', habit: "describes hands first", grewFrom: "carving by hand to hands, what is within reach of a hand to describing hands first" },
      radio: { ready: "Kitchen. Hands on the table, palms down.", strained: "Kitchen. Hands on the table.", overloaded: "Hands on the table." },
    },
    page2: { line: "A half-finished spoon rides in his bag, a clean sock pulled over the bowl.", district: 'pike' },
    page3: { kind: 'rescue', line: "After {place}, he keeps a finished spoon in the van for anyone to hold." },
    openToRelationship: false,
    tieKinds: ['neighbor', 'gym'],
  },
  {
    personaId: 'person_099', // Moana Faumuina
    page1: {
      pressureLine: "She keeps a photo journal of harbor light. On a call she names the hour first.",
      contradiction: "Describes every sunset at lunch. Starts every radio call with the hour.",
      pattern: "loud off duty, spare on the radio",
      markers: { length: 'short', noticesFirst: 'time', habit: "gives the clock time", grewFrom: "a journal marked to the minute to time, saying the hour to giving the clock time" },
      radio: { ready: "4:50, dock office. Light still on. Holding.", strained: "Dock office. Light still on.", overloaded: "Dock office, 4:50." },
    },
    page2: { line: "A worn tide table is folded in her bag, with times circled.", district: 'eastgate' },
    page3: { kind: 'favorable_under_pressure', line: "After {place}, she photographs the last light from the van and writes the minute." },
    openToRelationship: true,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_100', // Noah Wilson
    page1: {
      pressureLine: "He makes small illustrated guides to neighborhood trees. He counts them on every block.",
      contradiction: "Urges walkers to look up. Keeps his own eyes on his boots.",
      pattern: "gives advice, skips it",
      markers: { length: 'short', noticesFirst: 'count', habit: "names the street", grewFrom: "counting the trees on a block to count, knowing a street by its trees to naming the street" },
      radio: { ready: "Maple Street. Four trees down, gate open.", strained: "Four trees down, gate open.", overloaded: "Four trees down." },
    },
    page2: { line: "He presses a leaf from each street into the back of his notebook.", district: 'harbor' },
    page3: { kind: 'mentored', line: "Since {place}, he points whoever is new to the tree on every corner." },
    openToRelationship: true,
    tieKinds: ['neighbor', 'school'],
  },
];
