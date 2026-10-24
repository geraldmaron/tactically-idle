// Service jackets, batch B: person_009 through person_038 (see jackets.ts for the rules every jacket holds to).
// Written under swat-officer-stories; the officer record is docs/calls/notes/jackets-b.md.
//
// Across this batch of 30 (a few rules that held in jackets.ts for 8 officers are spread, not unique, here):
// - Noticed first: hands 4, faces 4, count 4, and exits, sound, time, gear, words, light 3 each.
// - Habit: nine of the ten approved habits appear 3 or 4 times each. "names the person" is not used because its
//   sample needs a name bound from a call's cast, and a static radio sample cannot carry one.
// - Contradiction patterns: each of the nine appears 2 to 4 times, careful here, careless there only 3.
// - Home districts: pike 8, larkin 7, harbor 5, eastgate 5, oldmill 5. An arbitrary spread, never derived from
//   culture, appearance or pronouns. Ties and openness are authored per person.
import type { Jacket } from './jackets';

export const AUTHORED_B: Jacket[] = [
  {
    personaId: 'person_009', // Harjit Singh
    page1: {
      pressureLine: 'He builds model train tracks. On a floor plan he follows the line to the dead end.',
      contradiction: 'Levels each rail to the hair. Walks in as the briefing starts.',
      pattern: 'precise with objects, loose with time',
      markers: { length: 'medium', noticesFirst: 'exits', habit: 'names the next step', grewFrom: 'train tracks and dead ends to exits, following the line to naming the next step' },
      radio: { ready: 'Loading door, east side. Shut, chain on. Back stairs next.', strained: 'Loading door, east side. Shut, chain on.', overloaded: 'Loading door. Shut.' },
    },
    page2: { line: 'He checks each doorway against the plan with a folding ruler from his jacket.', district: 'eastgate' },
    page3: { kind: 'rescue', line: 'Since {place}, he marks where the line stops on the plan before anyone asks.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'old_job'],
  },
  {
    personaId: 'person_010', // Amandeep Kaur
    page1: {
      pressureLine: 'She names birds by their songs. In a stairwell she hears how many people are moving.',
      contradiction: 'Lectures the squad on listening. Talks through every radio check.',
      pattern: 'gives advice, skips it',
      markers: { length: 'short', noticesFirst: 'sound', habit: 'counts out loud', grewFrom: 'birds by song and the stairwell to sound, how many people to counting out loud' },
      radio: { ready: 'Stairwell. Three people moving, one quiet. Holding.', strained: 'Stairwell. People moving, one quiet.', overloaded: 'Stairwell. One quiet.' },
    },
    page2: { line: 'She keeps a pocket field guide with the pages for owls folded down.', district: 'larkin' },
    page3: { kind: 'mentored', line: 'Since {place}, she lends the new officer her field guide.' },
    openToRelationship: false,
    tieKinds: ['neighbor', 'gym'],
  },
  {
    personaId: 'person_011', // Jordan Ellis
    page1: {
      pressureLine: 'They make tiny ceramic bowls. In a crowded room they check every hand before every face.',
      contradiction: 'Glazes bowls all month. Gives every one away before it cools.',
      pattern: 'keeps things, then gives them away',
      markers: { length: 'medium', noticesFirst: 'hands', habit: 'describes hands first', grewFrom: 'bowls held in the hand to hands noticed first and described first' },
      radio: { ready: 'Front room. Hands open on the table. Sitting still.', strained: 'Front room. Hands open on the table.', overloaded: 'Hands on the table.' },
    },
    page2: { line: 'They carry a smooth glazed pebble in a pocket and turn it over while others talk.', district: 'oldmill' },
    page3: { kind: 'injured', line: 'Since {place}, they check their own hands before they check the room.' },
    openToRelationship: false,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_012', // Morgan Hale
    page1: {
      pressureLine: 'They walk a different city footpath every Sunday. On a new block they find the second way out.',
      contradiction: 'Gives strangers directions all week. Their Sunday route is on no map.',
      pattern: 'open about others, closed about self',
      markers: { length: 'short', noticesFirst: 'exits', habit: 'names the street', grewFrom: 'footpaths and the second way out to exits, walking routes to naming the street' },
      radio: { ready: 'Alley to Orchard Road. Gate chained. Holding.', strained: 'Alley. Gate chained.', overloaded: 'Gate chained.' },
    },
    page2: { line: 'They keep a folded transit map in a pocket, penciled over with other ways home.', district: 'pike' },
    page3: { kind: 'first_call', line: 'Since {place}, they say the back way out before the front.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'school'],
  },
  {
    personaId: 'person_013', // Samira Haddad
    page1: {
      pressureLine: 'She notes the minute each theme enters in her soundtrack notebook, and the minute a room goes silent.',
      contradiction: 'Scores listed by year and key. Gym bag holds three left gloves.',
      pattern: 'tidy kit, chaotic locker',
      markers: { length: 'short', noticesFirst: 'time', habit: 'gives the clock time', grewFrom: 'the minute a theme enters and a room goes silent to time, noting minutes to giving the clock time' },
      radio: { ready: 'Porch, 11:05. Silence inside since ten. Holding.', strained: 'Porch, 11:05. Silence inside since ten.', overloaded: 'Porch, 11:05.' },
    },
    page2: { line: 'She carries a pencil stub and writes the time in the margin of every briefing sheet.', district: 'pike' },
    page3: { kind: 'favorable_under_pressure', line: 'Since {place}, she gives the time out loud when the room gets loud.' },
    openToRelationship: true,
    tieKinds: ['school', 'gym'],
  },
  {
    personaId: 'person_014', // Omar Farouk
    page1: {
      pressureLine: 'He repairs worn book bindings and sees the strap or hinge that is about to give.',
      contradiction: 'Waxes every van hinge. His bag never zips shut.',
      pattern: 'careful here, careless there',
      markers: { length: 'short', noticesFirst: 'gear', habit: 'reports gear before people', grewFrom: 'worn bindings and straps to gear, checking what holds to reporting gear first' },
      radio: { ready: "Garage door. Shield's here, strap worn. Holding.", strained: "Garage door. Shield's here, strap worn.", overloaded: 'Shield strap worn.' },
    },
    page2: { line: 'He mends loose straps on the spot with waxed thread from his vest.', district: 'oldmill' },
    page3: { kind: 'injured', line: 'Since {place}, he tapes a spare strap inside the van door.' },
    openToRelationship: true,
    tieKinds: ['old_job', 'neighbor'],
  },
  {
    personaId: 'person_015', // Yasmin Abdi
    page1: {
      pressureLine: 'She grows herbs in mismatched window pots. She sees which sills catch light and which stay shut.',
      contradiction: 'Waters the squad room plants. Her window pots stay dry.',
      pattern: 'fixes for others',
      markers: { length: 'short', noticesFirst: 'light', habit: 'says copy and nothing else', grewFrom: 'window pots and sills to light, short acknowledgements to copy' },
      radio: { ready: 'Fourth floor. Window lit, curtains drawn. Copy.', strained: 'Fourth floor. Window lit, curtains drawn.', overloaded: 'Fourth window lit.' },
    },
    page2: { line: 'She carries a pinch of dried thyme in a tin and smells it before a long night.', district: 'larkin' },
    page3: { kind: 'first_call', line: 'Since {place}, she notes which windows were open when she got there.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_016', // Idris Mensah
    page1: {
      pressureLine: 'He plays cooperative board games with neighbors. On a crowded porch he sees who keeps glancing back.',
      contradiction: 'Preaches taking turns. Grabs the first turn every time.',
      pattern: 'gives advice, skips it',
      markers: { length: 'short', noticesFirst: 'faces', habit: 'ends on a question', grewFrom: 'neighbors around a table to faces, asking who has not had a turn to ending on a question' },
      radio: { ready: 'Porch. Woman keeps looking away. Ask her?', strained: 'Porch. Woman keeps looking away.', overloaded: 'Woman looking away.' },
    },
    page2: { line: 'He turns a six sided die between his fingers while others decide.', district: 'pike' },
    page3: { kind: 'negotiated', line: 'Since {place}, he asks one person at a time what they need.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'school'],
  },
  {
    personaId: 'person_017', // Zainab Suleiman
    page1: {
      pressureLine: 'She collects postcards of unusual staircases. She counts the steps on any stair before she climbs it.',
      contradiction: 'Skips the gym. Takes every stair in the building at a run.',
      pattern: 'good at what they avoid',
      markers: { length: 'medium', noticesFirst: 'count', habit: 'names the next step', grewFrom: 'staircases and steps to counting, climbing in order to naming the next step' },
      radio: { ready: 'Back stairs. Two flights, one landing door. Third floor next.', strained: 'Back stairs. Two flights, one landing door.', overloaded: 'Back stairs. Two flights.' },
    },
    page2: { line: 'She tapes a postcard of a spiral stair inside her locker door.', district: 'larkin' },
    page3: { kind: 'rescue', line: 'Since {place}, she tells the next officer how many steps are left.' },
    openToRelationship: false,
    tieKinds: ['neighbor', 'old_job'],
  },
  {
    personaId: 'person_018', // Kofi Boateng
    page1: {
      pressureLine: 'He restores battered wooden chairs. When someone grips an armrest, he can tell they are about to stand.',
      contradiction: 'Reglues each squad room chair. Eats lunch on an upturned bucket.',
      pattern: 'fixes for others',
      markers: { length: 'medium', noticesFirst: 'hands', habit: 'describes hands first', grewFrom: 'chair arms and the grip on them to hands noticed first and described first' },
      radio: { ready: 'Hallway. Hands tight on the chair arms. About to rise.', strained: 'Hallway. Hands tight on the chair arms.', overloaded: 'Hands on chair arms.' },
    },
    page2: { line: 'He carries a pocket block plane to ease sticking drawers in the squad room.', district: 'harbor' },
    page3: { kind: 'mentored', line: 'Since {place}, he pulls a chair up beside the newest officer.' },
    openToRelationship: false,
    tieKinds: ['old_job', 'gym'],
  },
  {
    personaId: 'person_019', // Amina Diallo
    page1: {
      pressureLine: 'She photographs reflections after rain. In a shop window she finds the face behind the glass.',
      contradiction: 'Frames each shot to the inch. Loses track of whole afternoons.',
      pattern: 'precise with objects, loose with time',
      markers: { length: 'medium', noticesFirst: 'faces', habit: 'names the street', grewFrom: 'rain reflections in shop windows to faces, the wet street to naming the street' },
      radio: { ready: 'Alder Street side. Woman at the window watching the lot.', strained: 'Shop front. Woman at the window watching the lot.', overloaded: 'Woman at the window.' },
    },
    page2: { line: 'She wipes the van mirror at every stop with a lens cloth.', district: 'harbor' },
    page3: { kind: 'first_call', line: 'Since {place}, she names the street before she describes what she sees.' },
    openToRelationship: true,
    tieKinds: ['school', 'neighbor'],
  },
  {
    personaId: 'person_020', // Amadou Traoré
    page1: {
      pressureLine: "He builds storage boxes for his records. At a door he counts what's there first.",
      contradiction: 'Cuts each box to the sleeve. His records lean against the wall.',
      pattern: 'careful here, careless there',
      markers: { length: 'medium', noticesFirst: 'count', habit: 'reports gear before people', grewFrom: 'boxes cut to fit and a collection to counting, packing the kit to reporting gear first' },
      radio: { ready: 'Dock. Bag, handset, spare battery. Three of us.', strained: 'Dock. Three of us. Handset good.', overloaded: 'Dock. Three of us.' },
    },
    page2: { line: 'He checks every shelf he passes against the tape measure on his belt.', district: 'pike' },
    page3: { kind: 'favorable_under_pressure', line: 'Since {place}, he counts the bag twice before the doors open.' },
    openToRelationship: false,
    tieKinds: ['old_job', 'gym'],
  },
  {
    personaId: 'person_021', // Thandiwe Ndlovu
    page1: {
      pressureLine: 'She volunteers at a community seed exchange. She knows the regulars by face and spots the new one.',
      contradiction: 'Hands out seeds with planting advice. Never plants any herself.',
      pattern: 'gives advice, skips it',
      markers: { length: 'short', noticesFirst: 'faces', habit: 'counts out loud', grewFrom: 'regulars at the exchange to faces, handing out packets to counting heads' },
      radio: { ready: 'Corridor. Five people, one new face. Holding.', strained: 'Corridor. One new face. Holding.', overloaded: 'Corridor. One new face.' },
    },
    page2: { line: 'She offers a seed packet from her jacket to anyone waiting.', district: 'larkin' },
    page3: { kind: 'rescue', line: 'Since {place}, she learns every name in the room before she moves anyone.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_022', // Sipho Dlamini
    page1: {
      pressureLine: 'He assembles jigsaw puzzles of old maps. In a room he counts the people before anything else.',
      contradiction: 'Sorts puzzle pieces by shade. His duffel is one wet heap.',
      pattern: 'tidy kit, chaotic locker',
      markers: { length: 'short', noticesFirst: 'count', habit: 'gives the clock time', grewFrom: 'puzzle pieces and edges to counting, a map that fills in over time to giving the clock time' },
      radio: { ready: 'Garage, 11:20. Four cars, dome light on.', strained: 'Garage. Four cars, dome light on.', overloaded: 'Garage. Four cars.' },
    },
    page2: { line: 'He keeps a folded city map in his locker and pencils a dot for every call.', district: 'eastgate' },
    page3: { kind: 'first_call', line: 'Since {place}, he inks that dot and pencils the rest.' },
    openToRelationship: false,
    tieKinds: ['school', 'old_job'],
  },
  {
    personaId: 'person_023', // Naledi Mokoena
    page1: {
      pressureLine: 'She takes macro photographs of ordinary objects. On a shelf she counts the items and knows which moved.',
      contradiction: 'Frames a dust mote to the pixel. Misses her stop most evenings.',
      pattern: 'precise with objects, loose with time',
      markers: { length: 'medium', noticesFirst: 'count', habit: 'ends on a question', grewFrom: 'close photographs of objects to counting items, checking before touching to ending on a question' },
      radio: { ready: 'Back office. Three desks, one drawer open. Check it?', strained: 'Back office. Three desks, one drawer open.', overloaded: 'Office. One drawer open.' },
    },
    page2: { line: 'She holds a pocket ruler against anything she needs to size up.', district: 'pike' },
    page3: { kind: 'favorable_under_pressure', line: 'Since {place}, she asks what moved before she asks what is missing.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'old_job'],
  },
  {
    personaId: 'person_024', // Kabelo Molefe
    page1: {
      pressureLine: 'They keep a small balcony full of succulents and can tell how long a doorstep has gone unwatered.',
      contradiction: "Remembers every neighbor's watering day. Keeps their own address off the list.",
      pattern: 'open about others, closed about self',
      markers: { length: 'short', noticesFirst: 'time', habit: 'says copy and nothing else', grewFrom: 'watering days and a doorstep gone dry to time, short acknowledgements to copy' },
      radio: { ready: 'Stoop, 6:15. Mail piled since Friday. Copy.', strained: 'Stoop, 6:15. Mail piled since Friday.', overloaded: 'Stoop, 6:15.' },
    },
    page2: { line: 'They carry a small spray bottle and mist any plant left on a stoop.', district: 'oldmill' },
    page3: { kind: 'negotiated', line: 'Since {place}, they ask when the mail was last taken in.' },
    openToRelationship: false,
    tieKinds: ['neighbor', 'gym'],
  },
  {
    personaId: 'person_025', // Asha Mwangi
    page1: {
      pressureLine: 'She collects oral histories about local cinemas. She listens for the word a person keeps coming back to.',
      contradiction: 'Talks for hours on tape. Her call notes run one line.',
      pattern: 'loud off duty, spare on the radio',
      markers: { length: 'short', noticesFirst: 'words', habit: 'repeats the last thing said', grewFrom: 'oral histories and the word a person returns to to words, replaying to repeating the last thing said' },
      radio: { ready: "Yard. Neighbor said 'lights off.' Lights off.", strained: "Yard. Neighbor said 'lights off.'", overloaded: 'Yard. Lights off.' },
    },
    page2: { line: 'She writes one word from every briefing on the back of her left glove.', district: 'harbor' },
    page3: { kind: 'negotiated', line: 'Since {place}, she plays the last words back before she answers.' },
    openToRelationship: false,
    tieKinds: ['school', 'family_friend'],
  },
  {
    personaId: 'person_026', // Daniel Otieno
    page1: {
      pressureLine: 'He carves small abstract shapes from scrap wood. He watches the shape a hand is making.',
      contradiction: 'Dreads small talk. Strangers on landings tell him everything.',
      pattern: 'good at what they avoid',
      markers: { length: 'medium', noticesFirst: 'hands', habit: 'describes hands first', grewFrom: 'carved shapes and the shape of a hand to hands noticed first and described first' },
      radio: { ready: 'Stairs. Hands loose at the sides, empty. Not moving.', strained: 'Stairs. Hands loose at the sides, empty.', overloaded: 'Hands loose, empty.' },
    },
    page2: { line: 'He carries a smooth offcut of walnut and turns it over in his palm while waiting.', district: 'larkin' },
    page3: { kind: 'injured', line: 'Since {place}, he keeps his palms open when he speaks to a stranger.' },
    openToRelationship: false,
    tieKinds: ['neighbor', 'old_job'],
  },
  {
    personaId: 'person_027', // Selam Tesfaye
    page1: {
      pressureLine: 'She draws transit stations from memory, every platform and stair. In a lobby she finds the exits first.',
      contradiction: "Draws maps for lost tourists. Won't show anyone her sketchbook.",
      pattern: 'open about others, closed about self',
      markers: { length: 'short', noticesFirst: 'exits', habit: 'counts out loud', grewFrom: 'stations drawn from memory to exits, platforms and stairs to counting' },
      radio: { ready: 'Lobby. Three ways out, one door chained.', strained: 'Lobby. Ways out, one door chained.', overloaded: 'Lobby door chained.' },
    },
    page2: { line: 'She keeps a pad in her pocket and draws the exits on the walk in.', district: 'eastgate' },
    page3: { kind: 'mentored', line: 'Since {place}, she hands her sketch to whoever is next through the door.' },
    openToRelationship: true,
    tieKinds: ['school', 'gym'],
  },
  {
    personaId: 'person_028', // Dawit Bekele
    page1: {
      pressureLine: 'He makes playlists for long train journeys. He knows how many minutes are left to the next stop.',
      contradiction: 'Narrates whole albums on the drive. Says three words at a briefing.',
      pattern: 'loud off duty, spare on the radio',
      markers: { length: 'short', noticesFirst: 'time', habit: 'names the next step', grewFrom: 'playlists timed to the stops to time, the next stop to naming the next step' },
      radio: { ready: 'Stairwell, 7:05. Door held. Roof next.', strained: 'Stairwell, 7:05. Door held.', overloaded: 'Stairwell, 7:05.' },
    },
    page2: { line: 'He reads a worn paper timetable from his vest in any wait.', district: 'eastgate' },
    page3: { kind: 'favorable_under_pressure', line: 'Since {place}, he says the time left before he says anything else.' },
    openToRelationship: true,
    tieKinds: ['gym', 'old_job'],
  },
  {
    personaId: 'person_029', // Nuru Mfinanga
    page1: {
      pressureLine: 'They design handmade bookmarks for friends. They keep their place in a conversation to the word.',
      contradiction: 'Every bookmark cut square. Their notes live on scraps in a coat.',
      pattern: 'tidy kit, chaotic locker',
      markers: { length: 'medium', noticesFirst: 'words', habit: 'repeats the last thing said', grewFrom: 'bookmarks that hold a place to words, keeping the place in a conversation to repeating the last thing said' },
      radio: { ready: "Front step. Neighbor says 'left at nine.' Left at nine.", strained: "Front step. Neighbor says 'left at nine.'", overloaded: 'Step. Left at nine.' },
    },
    page2: { line: 'They tuck a paper bookmark into every clipboard they pick up.', district: 'oldmill' },
    page3: { kind: 'negotiated', line: 'Since {place}, they read back the last thing said before they speak.' },
    openToRelationship: true,
    tieKinds: ['school', 'neighbor'],
  },
  {
    personaId: 'person_030', // Joël Kamau
    page1: {
      pressureLine: "He collects old road atlases. He can read a caller's directions back turn by turn.",
      contradiction: 'Repairs every squad map he finds. His atlas has no cover.',
      pattern: 'fixes for others',
      markers: { length: 'medium', noticesFirst: 'words', habit: 'names the street', grewFrom: 'road atlases and directions to words, turn by turn to naming the street' },
      radio: { ready: 'Ash Court. Caller said Ash Road. Wrong block. Checking.', strained: 'Ash Court. Caller said Ash Road. Wrong block.', overloaded: 'Ash Court. Wrong block.' },
    },
    page2: { line: 'He pencils new street names into a taped up road atlas kept in the van.', district: 'eastgate' },
    page3: { kind: 'rescue', line: 'Since {place}, he writes the old street name beside the new one.' },
    openToRelationship: false,
    tieKinds: ['old_job', 'neighbor'],
  },
  {
    personaId: 'person_031', // Priya Raman
    page1: {
      pressureLine: 'She makes cyanotype prints of leaves. In a dim room she tells where the light is coming from.',
      contradiction: 'Spends weeks on one print. The first admirer gets it.',
      pattern: 'keeps things, then gives them away',
      markers: { length: 'short', noticesFirst: 'light', habit: 'says copy and nothing else', grewFrom: 'sun prints and dim rooms to light, short acknowledgements to copy' },
      radio: { ready: 'Cellar. Light under the door. Copy.', strained: 'Cellar. Light under the door.', overloaded: 'Light under the door.' },
    },
    page2: { line: 'She carries a sheet of sun paper in a dark sleeve and holds it to any window.', district: 'pike' },
    page3: { kind: 'injured', line: 'Since {place}, she points out which way the light falls before anyone moves.' },
    openToRelationship: false,
    tieKinds: ['neighbor', 'school'],
  },
  {
    personaId: 'person_032', // Arjun Desai
    page1: {
      pressureLine: 'He restores vintage desk lamps. He checks every cord, plug and switch before he trusts any of it.',
      contradiction: 'Rewires a lamp strand by strand. His lanyard is held with tape.',
      pattern: 'careful here, careless there',
      markers: { length: 'short', noticesFirst: 'gear', habit: 'reports gear before people', grewFrom: 'lamp cords and switches to gear, testing before trusting to reporting gear first' },
      radio: { ready: 'Side lot. Handset good, battery low. Holding.', strained: 'Side lot. Handset good, battery low.', overloaded: 'Handset battery low.' },
    },
    page2: { line: 'His vest holds a spool of electrical tape and a plug tester.', district: 'larkin' },
    page3: { kind: 'injured', line: 'Since {place}, he tests every flashlight on Monday.' },
    openToRelationship: true,
    tieKinds: ['old_job', 'gym'],
  },
  {
    personaId: 'person_033', // Farah Qureshi
    page1: {
      pressureLine: 'She keeps a journal of cloud formations. She can tell smoke from weather at a glance.',
      contradiction: 'Refuses to call the weather. The squad still asks her every morning.',
      pattern: 'good at what they avoid',
      markers: { length: 'medium', noticesFirst: 'light', habit: 'ends on a question', grewFrom: 'clouds and smoke against the sky to light, a call to make to ending on a question' },
      radio: { ready: 'Cellar window. Gray haze in the light. Call it in?', strained: 'Cellar window. Gray haze in the light.', overloaded: 'Haze in the light.' },
    },
    page2: { line: 'She glances at the sky before she reads the call sheet.', district: 'oldmill' },
    page3: { kind: 'rescue', line: 'Since {place}, she reports what the wind is doing at every door.' },
    openToRelationship: false,
    tieKinds: ['family_friend', 'neighbor'],
  },
  {
    personaId: 'person_034', // Imran Rahman
    page1: {
      pressureLine: 'He mends mechanical toys. In a hallway he can hear which door spring is worn.',
      contradiction: 'Warns kids never to overwind. Winds his own until the spring snaps.',
      pattern: 'gives advice, skips it',
      markers: { length: 'short', noticesFirst: 'sound', habit: 'gives the clock time', grewFrom: 'springs and mechanisms to sound, a clockwork rhythm to giving the clock time' },
      radio: { ready: 'Hall, 8:50. Noise from the door spring.', strained: 'Hall. Noise from the door spring.', overloaded: 'Hall. Door spring noise.' },
    },
    page2: { line: 'He keeps a tin of light machine oil in his bag and a wind up key on his ring.', district: 'harbor' },
    page3: { kind: 'first_call', line: 'Since {place}, he oils the van door hinges every Friday.' },
    openToRelationship: false,
    tieKinds: ['neighbor', 'old_job'],
  },
  {
    personaId: 'person_035', // Nisha Perera
    page1: {
      pressureLine: 'She makes illustrated recipe cards, drawing the hands in each step. She notices what a hand carries.',
      contradiction: 'Won\'t cook. Her recipe cards are everyone\'s favorite.',
      pattern: 'good at what they avoid',
      markers: { length: 'medium', noticesFirst: 'hands', habit: 'describes hands first', grewFrom: 'drawn hands in every recipe step to hands noticed first and described first' },
      radio: { ready: 'Doorway. Hands full with a laundry basket. Coming out.', strained: 'Doorway. Hands full with a laundry basket.', overloaded: 'Hands full, basket.' },
    },
    page2: { line: 'She writes the next step on a blank recipe card from her vest.', district: 'pike' },
    page3: { kind: 'mentored', line: 'Since {place}, she passes across a card with one step on it.' },
    openToRelationship: true,
    tieKinds: ['family_friend', 'school'],
  },
  {
    personaId: 'person_036', // Sahan Fernando
    page1: {
      pressureLine: 'He builds simple kites from recycled paper. He hears a draft and knows which door is open.',
      contradiction: 'Builds a kite all weekend. Hands it to a kid by dinner.',
      pattern: 'keeps things, then gives them away',
      markers: { length: 'medium', noticesFirst: 'sound', habit: 'ends on a question', grewFrom: 'kites and the wind to sound, trying a door to ending on a question' },
      radio: { ready: 'Back hall. Cold draft, no sound inside. Check it?', strained: 'Back hall. Cold draft, no sound inside.', overloaded: 'Draft, no sound.' },
    },
    page2: { line: 'He ties down anything loose with a short spool of kite string.', district: 'pike' },
    page3: { kind: 'favorable_under_pressure', line: 'Since {place}, he tries every door for a draft before he reports it shut.' },
    openToRelationship: false,
    tieKinds: ['neighbor', 'gym'],
  },
  {
    personaId: 'person_037', // Anika Shrestha
    page1: {
      pressureLine: 'She collects photographs of public fountains. In a plaza she notices who keeps returning to the same spot.',
      contradiction: 'Shares every fountain photo with strangers. Never shows a picture of herself.',
      pattern: 'open about others, closed about self',
      markers: { length: 'medium', noticesFirst: 'faces', habit: 'repeats the last thing said', grewFrom: 'fountains and the people who return to them to faces, replaying a visit to repeating the last thing said' },
      radio: { ready: "Plaza. Woman says 'not yet.' Not yet. Watching her.", strained: "Plaza. Woman says 'not yet.' Watching her.", overloaded: 'Plaza. Woman watching.' },
    },
    page2: { line: 'She tosses a coin into any fountain she passes and watches who looks up.', district: 'larkin' },
    page3: { kind: 'negotiated', line: 'Since {place}, she greets the one watching from the edge.' },
    openToRelationship: true,
    tieKinds: ['neighbor', 'family_friend'],
  },
  {
    personaId: 'person_038', // Tenzin Dorje
    page1: {
      pressureLine: 'He repairs and shares old bicycles. He sees which bolt is loose before the wheel wobbles.',
      contradiction: 'Trues wheels for the whole block. His front wheel rubs the fork.',
      pattern: 'fixes for others',
      markers: { length: 'medium', noticesFirst: 'gear', habit: 'counts out loud', grewFrom: 'bicycles and loose bolts to gear, counting spokes and bikes to counting out loud' },
      radio: { ready: 'Shed. Four bikes, one wheel loose. Bag and handset set.', strained: 'Shed. Bikes, one wheel loose. Bag and handset set.', overloaded: 'Bag and handset set.' },
    },
    page2: { line: 'He lends a small wrench and a patch kit to anyone with a soft tire.', district: 'harbor' },
    page3: { kind: 'mentored', line: 'Since {place}, he tightens the van mirror bolts at the start of every shift.' },
    openToRelationship: false,
    tieKinds: ['gym', 'neighbor'],
  },
];
