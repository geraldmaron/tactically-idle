# Scene-pass provenance

The current blue-hour station and currency exports were recorded on 2026-10-22. The original
generation messages are not available in this record, and the source PNGs contain no prompt
metadata. [blue-hour-prompts.json](blue-hour-prompts.json) therefore records **reconstructed intent**,
not verbatim historical prompts. The session continuity record supplies the source filenames, crop
and encoding quality; Pillow inspection confirms the source and runtime dimensions, colour modes
and alpha ranges below.

## Current assets

| Asset | Generated source PNG | Inspected master | Runtime export | Inspected export |
| --- | --- | --- | --- | --- |
| Station exterior | `exec-b59d5198-34db-46ed-a053-3d4f496a16d8.png` | 1536 × 1024, RGB | `public/art/plates/hub_hq.webp` | 1200 × 800, RGB |
| Fictional currency bundle | `exec-53ac1981-af5d-473f-9959-088ef0706b9c.png` | 1536 × 1024, RGBA | `public/art/plates/tex_cash.webp` | 384 × 300, RGBA |

Both masters remain outside the repository under
`/Users/geralddagher/.codex/generated_images/01a1658f-878a-7081-b3f9-9e2827e111e4/`.
The current runtime files are listed in `public/art/plates/manifest.json`. Its top-level width and
height are legacy plate defaults; the two exports above have the individually inspected dimensions
shown here.

## Reconstructed intent and processing

**`hub_hq`.** An original painted urban department at blue hour, with warm dispatch windows, a garage
and a blue van. Broad silhouettes should read at phone size. The composition is 3:2, with a dark lower
left area for department identity and state. No text, interface graphics, logos or weapons are part
of the intended illustration. This is the intent reconstructed from the session record, not a quote
from the generation request.

The session record describes resizing the 1536 × 1024 master to 1200 × 800 and WebP encoding at
quality 88. The current file dimensions and RGB mode were inspected. The exact resize command and
resampling filter are not recorded here; encoding quality is supplied by the session record and
cannot be recovered from the inspected metadata alone.

**`tex_cash`.** A fictional mint banknote bundle with an ivory band, painted as a chunky 2.5D object
that can read at 24 to 48px. The intent calls for alpha, no lettering, and no floating coins or
sparkle effects. This describes the intended object; it is not a verbatim generation prompt.

The session record gives the master crop rectangle as `(320, 160, 920, 720)` in source pixels
`(left, top, right, bottom)`, a 600 × 560 region, followed by a 384 × 300 export at WebP quality 90.
The exact resize command and resampling filter are not recorded. Inspection confirms RGBA in both
master and export, each with alpha values ranging from 0 to 254. Encoding quality and crop coordinates
come from the session record; the metadata inspection independently confirms the final dimensions
and retained alpha channel.

## History and runtime use

[hub-prompts.json](hub-prompts.json) preserves the earlier multi-room cutaway prompt. It is
superseded for the current `hub_hq` file. [generation-prompts.json](generation-prompts.json) preserves
the earlier scene, banner and paper-texture prompts; it does not contain the current station or
currency request.

`Hub.tsx` uses the station as atmosphere behind identity and actual state chips. The positions of
those chips are not a map of the building. `TopBar.tsx`, `TapEarn.tsx` and `Finance.tsx` use the banknote
bundle for funding and confirmed collection feedback. Its historical `tex_` filename is retained,
but the image is an object with alpha, not a tiling background texture.

## Operational interiors (2026-10-22)

Four new environment plates extend the current station exterior without replacing it. Their exact
built-in image generation prompts, master paths, inspected dimensions, export settings and intended
placements are in [operations-prompts.json](operations-prompts.json).

| Runtime plate | Intended surface | Master | Export |
| --- | --- | --- | --- |
| `scene_command_room.webp` | Command, briefing and dispatch | 1536 × 1024 RGB | 1200 × 800 RGB |
| `scene_patrol_garage.webp` | Patrol, preparation and departure | 1536 × 1024 RGB | 1200 × 800 RGB |
| `scene_facilities_plan.webp` | Build, facilities planning | 1536 × 1024 RGB | 1200 × 800 RGB |
| `scene_armory_counter.webp` | Store, equipment provisioning | 1536 × 1024 RGB | 1200 × 800 RGB |

All four use cobalt dusk through ordinary station windows, warm practical lamps, navy/slate
materials and clear physical props. The room objects establish the activity before text. Current
call status, patrol readiness, upgrade progress and stock must come from live UI overlays; the
painted object counts and model rooms do not represent simulation totals. No text, logos, badges,
firearms, HUD graphics, coins or particle effects were observed in the inspected generated masters.

Exports use Pillow LANCZOS resizing and WebP quality 88, method 6. The source masters remain in the
image generator output directory named in the prompt record. This asset pass does not change
screen components, so integrated phone-width placement remains the consuming UI pass's check.
