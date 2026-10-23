# Art style: one style per set

Written 2026-10-23 for backlog `ui-surfaces` P8. Each art set has one look, one canvas and one kind of
background. A screen may put two sets side by side; it never puts two looks in one set, and a thing that
has no painting is not drawn as a line icon beside paintings of its siblings.

`scripts/validate-art.mjs` (`npm run check:art`) enforces the mechanical half: the canvas and the alpha
channel of every file against its manifest, no file the manifest does not list, and a painting for every
item, course, branch, call type, squad and manager the game defines. Adding one of those takes its art in the
same change.

## The sets

| Set | Look | Canvas | Background | Fit | Where the UI draws it |
|---|---|---|---|---|---|
| `portraits`, `managers` | Photographic head and shoulders, plain navy overshirt, dark studio backdrop | 512 x 532 | Opaque | `cover`, top centre | `Face`, `Portrait`, `ManagerPortrait` |
| `gear` | Painted product cutout: graphite and navy with small amber accents, upper-left light, three-quarter view | 512 x 512 | Alpha | `contain` | `GearArt`, `GearArtFrame` |
| `emblems`, `crests` | Cream glyph on a dark enamel disc in a worn metal rim (gold rim for branches, steel for courses, a squad colour for crests) | 512 x 512 | Alpha | `contain` | `EmblemArt`, `SquadCrest` |
| `medallions` | A scene plate cropped to a round disc, graphite rim, a thin ring in the call type's hue | 512 x 512 | Alpha | `contain` | `CallTypeBadge` at 40px and up |
| `plates` | Painted night scenes and rooms; textures for the skin | 1200 wide, three heights; textures and the hub art differ | Opaque (one cutout) | `cover` | `PlateArt`, `ScreenBanner`, `TabPlate` |
| `materials` | Photographic wall-material swatches, reference only | 256 x 256 | Opaque | `cover` | `MaterialGuide` (72px) |

The kit icons (`src/ui/icons`) are interface glyphs, not art. They sit in chrome, chips and rows beside the
art; they stand in for art only inside the set's own frame, below.

## Stand-ins when a painting is missing or fails

Same frame, same size, never a bare gap and never initials:

| Provider | Stand-in |
|---|---|
| `Face`, `Portrait`, `ManagerPortrait` | The shared `Silhouette` (`src/ui/portraits/Silhouette.tsx`): head and shoulders, a cap brim for officers, a hood for a subject. `Portrait` adds its personnel-file grid and, at 100px and up, the caption "NO PHOTO ON FILE". A vacant Command Staff seat shows the silhouette dimmed with the post's icon or a lock. |
| `GearArt`, `EmblemArt` | The kit icon, snapped to 16, 20 or 24px by the frame's size, centred on the round enamel (`.art-fallback`, `src/ui/art/art.css`) at the art's own size. |

## Sizes

Faces come in three sizes (`--face-sm`, `--face-md`, `--face-lg`: 32, 48, 72px). Gear art is drawn at 24 to
128px. A medallion needs 40px (`MEDALLION_MIN`); below that `CallTypeBadge` draws its SVG badge, so painted
detail is never squeezed under the size it was checked at.

## Colors

Art and map code carry no literal colors. The map (`src/ui/blueprint`) reads `--bp-*`, `--chalk`, `--map*`
and `--white`/`--black`; washes are `color-mix` of those tokens.

## Adding art

Follow the provenance rules in `docs/art/ART-DELIVERY.md` and the per-pack READMEs: one image per
`codex exec` call on `--model gpt-6.1-sol` (built-in image tool, stdin closed with `< /dev/null`), the
house prompt of the set (see `docs/art/prompts/` and each pack's `generation-prompts.json`), a contact
sheet beside the existing set before it ships, then `npm run check:art`.
