# Station rebuild art

Delivered 2026-10-23 for the Build and Team rebuild: 12 room vignettes, one dark diorama, one Team header plate, four squad crests and two Command Staff portraits. Nothing existing was replaced; every file is new and registered in its folder's `manifest.json`. `npm run check:art` covers all of it.

## Method

Each image was generated separately with Codex's built-in image generation (`codex exec`, configured default model, read-only sandbox, stdin closed), one image per call, with existing project art attached as the style reference. No stock, photograph or third-party art. The PNG masters stay outside the repository in `~/.codex/generated_images/`. Export is Pillow (Lanczos) resize, then `cwebp -m 6`; crests use `-alpha_q 100 -exact` as the emblems do. 22 generation calls in all (12 rooms, 1 diorama, 1 locker, 4 crests plus 2 redos, 2 portraits).

## Files

| File | Size | Notes |
| --- | --- | --- |
| `plates/room_<room>_lit.webp` and `_dark.webp` for personnel, training, information, recovery, equipment, garage | 1200 x 800 RGB, 48 to 92 KB | One roofless room of the same tabletop station model as `scene_facilities_plan`. Lit is warm and furnished with one sign of use; dark is the same camera and room, cool dusk light only, furniture under dust sheets or removed, two strips of masking tape across the opening |
| `plates/scene_facilities_plan_dark.webp` | 1200 x 800 RGB, 98 KB | The diorama with every room unlit. See alignment below |
| `plates/scene_swat_locker.webp` | 1200 x 517 RGB, 62 KB | Locker and briefing room, cropped to the 390 x 168 header ratio; the lower third is empty concrete floor for text |
| `crests/alpha.webp` fox, `bravo.webp` owl, `charlie.webp` bear, `delta.webp` stag | 512 x 512 RGBA, 65 to 92 KB | Round enamel medallions in the emblem finish, rim colour amber, cobalt, teal-green, dusty violet. Alpha range 0 to 255, corners fully transparent |
| `managers/recruiter.webp`, `peer_support_lead.webp` | 512 x 532 RGB, 15 to 17 KB | Same frame as the three existing managers |

New folder `public/art/crests/` is registered in `scripts/validate-art.mjs` (ids `alpha`, `bravo`, `charlie`, `delta`) and in the test fixture in `src/ui/art/validate-art.test.ts`. The plate id pattern now accepts `room_<personnel|training|information|recovery|equipment|garage>_<lit|dark>`, and the manager id list gains `recruiter` and `peer_support_lead`. The sim's staff pool (`src/sim/staff-pool.ts`) was not touched: the two portraits are art for the posts, and the names below are art-direction proposals.

## Room vignettes

Lit prompt: the attached `scene_facilities_plan` as reference, then

> Use case: stylized-concept. Single 3:2 landscape illustration, 1536 by 1024. The reference shows the established look: a hand-painted tabletop architectural model of a municipal station at blue hour, roof removed, thin ivory plaster and wood model walls, warm amber practical lamps, cobalt dusk, deep navy surroundings. Match that painted look exactly. Primary request: a close-up of ONE room of that same miniature model, `<room>`, in its LIT, OPEN state. Elevated three-quarter view into the roofless model room, thin model walls on two sides, a sliver of ivory plan paper and dark navy desk at the edges. Inside: `<cue>`. No people. Composition: the room fills the centre, main content in the middle horizontal band so it reads as a short wide strip or a small near-square card. No text. Avoid text, numerals, logos, badges, insignia, flags, weapons, people, neon, HUDs, coins, particles, clutter.

Cues: personnel office, a front desk with closed laptop and green-shaded lamp, sign-in tray, filing cabinets with one drawer open, shelved box files, a mug and an open folder; training floor, navy mats, a freestanding wooden mock door frame, a bench with towel and bottles, a blank whiteboard, boots and a skipping rope; information room, a pinboard of blank sheets and an abstract floor plan, a work table with laptop, lamp and folders, record boxes, a coffee cup on an open plan; equipment bay, navy lockers with one ajar, a wire kit cage of blank hard cases and radio docks, a bench with a folded vest and a closed pouch; garage, an unmarked blue van in the right bay, roll-up doors open on the street, a workbench and coiled hose; recovery room, two armchairs, low table, kettle and mugs, a blanket and a draped jacket, a floor lamp and a plant. The first recovery run used a slightly shorter phrasing of the same prompt.

Dark prompt: the lit image attached, then "Edit the attached image: create the SAME room, identical camera angle, framing, walls, window position, model base, plan paper and desk surroundings, in its DARK, CLOSED state. All warm lamps off, lit only by faint cool cobalt dusk through the window, `<what is removed or covered>`, two crossed strips of pale masking tape over the near opening to mark it taped off. Same painted style. No people. No text." The removals were per room: front desk bare and files under a dust sheet; mats rolled and the mock door under a sheet; planning wall bare and boxes sheeted; lockers padlocked and the cage chained and empty; van gone and roll-up doors down; chairs sheeted and rug rolled.

Each lit and dark pair keeps the same camera, walls, window and base, so swapping one for the other does not shift the picture. Previewed as a 390 x 150 cover crop and a 76 x 60 cover crop: the room reads in all twelve. The personnel pair is framed larger than the others and the garage shows only a plain bay; both still read.

## Facilities diorama, dark

The generator edits the whole image, not a masked region, so this is a re-render of the existing diorama with the interior and entrance lamps off. Geometry holds: edge correlation against the 1536 x 1024 master peaks at zero offset (within a 1 px search at 768 px width) in the window, desk, lamp and model-wall regions. Fine texture (foliage, wood grain, paper lines) differs from the original, so a cross-fade between the two shimmers slightly in those areas. A hard swap or a short fade is fine; a long cross-fade may show it.

## Team header plate

Reference `banner_squad` and the diorama. Prompt in brief: the SWAT team's locker and briefing room at blue hour; a wall of dark navy lockers with plain jackets on hangers and kit bags, a worn bench with towel, thermos and mugs, a briefing corner with a folder stack and a blank whiteboard, two chairs pushed back, a tall window on cobalt dusk, no people; all interest in the upper two thirds, the lower third calm dark concrete; the middle band rich enough to read as a wide strip. Export crops the 1536 x 1024 master to the 390:168 ratio (rows 70 to 732) and resizes to 1200 x 517.

## Squad crests

References `emblems/branch_field` and `emblems/entry_course`. Prompt in brief: one round medallion, dark navy and graphite enamel disc with a brushed rim, a single bold animal-head pictogram in warm chalk white with one small accent of the rim colour, soft light from the upper left, readable at 48 px, true alpha, no shield, star, chevron, eagle, wreath, flag, ribbon, red cross or weapon, no text. Subjects: Alpha a fox head in profile, Bravo a front-facing owl, Charlie a three-quarter bear head, Delta a front-facing stag with broad antlers.

Delta was redone. The first pass was a raven in profile with a white head and heavy hooked beak, which read too close to an eagle; the second call repeated it by mistake; the third, the stag, is the one kept. At 48 px all four read as distinct silhouettes; the bear and the stag are the least contrasty because their rims are the muted colours. None resembles a real agency insignia.

## Portraits

Reference `managers/quartermaster`; the prompt uses the officer-portrait frame from `docs/art/portrait-style.txt` word for word around each brief. Neither person wears any role cue.

| Post | Brief | Result |
| --- | --- | --- |
| Recruiter, Ines Carvalho (she, 41) | Brazilian woman of Portuguese descent, light olive-tan skin, oval face with high cheekbones, dark hazel eyes, thick dark-brown wavy hair in a loose low ponytail with one curl at the temple, small gold hoops, laugh lines, no glasses, an open attentive half-smile | Matches |
| Peer Support Lead, Anders Holm (he, 58) | Man of Swedish descent, fair ruddy skin, long rounded face, pale blue-grey eyes, thinning white-blond hair brushed back, trimmed white beard, deep smile creases, no glasses, a gentle steady listening expression | Matches |

The first choice for the recruiter, Priya Raman, is already one of the 100 officer personas, so it was dropped. The two names were checked against `src/content/personas.json`: no first-name and surname match. The look-alike check against the roster and the three existing managers was by eye only, not a structured pass.

## Skipped

Nothing in the brief was skipped. The cut points are the ones above: the diorama dark state is a full re-render and not a pixel-exact mask edit.
