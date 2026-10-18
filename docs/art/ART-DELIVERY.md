# Tactically Idle art delivery

## Delivered and ready

- **100 individually generated fictional officer portraits**, `person_001` through `person_100`, matched to the authored rows in `src/content/personas.json`
- **Nine individually generated equipment illustrations** in the original pack; the current gear manifest has expanded separately
- **Six individually generated construction-material reference swatches**
- **42 brand files**, including original SVG marks and lockups, browser icons, splash and title compositions, and a share card

The first art pack contained portraits `person_001` through `person_024`. The 76 remaining catalog identities received individual headshots in the roster completion pass. No face was reused as a substitute for another identity. Unmatched historical people and image-loading failures still use the personnel-file fallback.

## Roster approach

The catalog spans younger and older adults, varied facial structures, skin tones, hair and eyewear, Sikh officers with fully visible turbans, chosen hijab presentations, and authored they/them identities. Portrait appearance is fixed to its identity. Skills, traits, training and role assignment remain independent gameplay data. Portraits use a plain navy overshirt with no variable rank, role, equipment or agency badges.

Each officer was generated in a separate built-in image-generation call from that person's authored appearance description. Contact sheets are review layouts of the completed independent images, with labels from the catalog. The exact generation prompts are in `prompts/person_NNN.txt`.

## Runtime specifications

- Portraits: 512×532 WebP, 100 files, 2,019,604 bytes total

Source generation produced larger PNG originals; runtime portraits were resized, cropped at the lower edge, and encoded as WebP to preserve complete hair and headwear. The first pack's source PNGs were retained separately. The 76 new source PNGs remain in the Codex generated-images store from this task. No software API key or paid API fallback was used.

## Integration contract

Each art directory has a `manifest.json` with `version`, `readyIds`, `width` and `height`. Only completed, readable files are listed. Missing portrait IDs use the intentional dossier fallback. Gear retains its semantic line-icon fallback. Material art is an optional construction reference; SVG blueprint hatch patterns, signal logic and simulation material values remain authoritative.

Use paths relative to the app base URL. Portraits render with `object-fit: cover` and top-center positioning; equipment renders with `object-fit: contain`. The portrait files already carry the supplied aspect ratio. Material swatches are references and are not certified tileable textures or engineering specifications.

## Validation and provenance

- All 100 final portrait files are 512×532 RGB WebP and have distinct SHA-256 hashes
- The 76 new portraits were reviewed in labeled contact sheets at their final crop for catalog correspondence, visible headwear, eyewear and framing
- `roster-contact-sheet.jpg` shows the full 100-person roster in catalog order
- `raster-validation.json` records filenames, byte sizes, dimensions, modes and hashes
- `portrait-validation.json` records the name and age mapping
- `prompts/` contains the generation prompt for each portrait
- `BRAND-GUIDE.md`, `FONT-LICENSE.txt` and `build_brand.py` document the original vector brand

No public hosting, remote push, merge or deployment is part of this art delivery.
