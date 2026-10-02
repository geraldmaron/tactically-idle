# Tactically Idle art delivery

## Delivered and ready
- **24 individually generated fictional officer portraits**, `person_001` through `person_024`, matched to the authored rows in `src/content/personas.json`
- **Nine individually generated equipment illustrations**, covering every item currently defined in `src/content/items.ts`
- **Six individually generated construction-material reference swatches**, covering every current wall-material type
- **42 brand files**, including original SVG marks/lockups, dark/light and one-color variants, transparent vector sources, browser icons, reusable common icon sizes, a mobile splash composition, title composition, share card and brand review board

The identity catalog contains 100 authored people. **Only 24 identities have generated portraits in this delivery.** The remaining identities intentionally use the personnel-file fallback. There are no repeated face substitutions or generated-face placeholders for the other 76 profiles.

## Roster approach
The core includes younger and older adults, varied facial structures, skin tones, hair and eyewear, Sikh officers with fully visible turbans, chosen hijab presentations, and authored they/them identities. Portrait appearance is fixed to its identity. Skills, traits, training and role assignment remain independent gameplay data. The portraits use a plain navy overshirt with no variable rank, role, equipment or agency badges.

Each officer was generated in a separate built-in image-generation call from that person's authored appearance description. No contact-sheet generation or face reuse was used. The contact sheet is a review layout of the completed independent images, with labels taken from the catalog.

## Runtime specifications
- Portraits: 512×532 WebP, 24 files, 655,934 bytes total
- Gear: 512×512 WebP with true alpha, nine files, 468,672 bytes total
- Materials: 256×256 opaque WebP, six files, 90,198 bytes total
- Total generated runtime raster art: 1,214,804 bytes

Source image generation produced larger PNG originals; runtime copies were resized and encoded using ImageMagick. Resizing does not change identity, expression, attire or content. All 39 source PNGs are retained separately for future exports. No software API key or paid API fallback was used. The image-generation tool did not expose pricing or quota information, so this delivery makes no cost claim.

## Integration contract
Each art directory has a `manifest.json` with `version`, `readyIds`, `width` and `height`. Only completed, readable files are listed. Missing portrait IDs use the intentional dossier fallback. Gear retains its semantic line-icon fallback. Material art is an optional construction reference; SVG blueprint hatch patterns, signal logic and simulation material values remain authoritative.

Use paths relative to the app base URL. Use `object-fit: cover` with top-center positioning for portraits, and `object-fit: contain` for equipment. Preserve the supplied portrait aspect ratio to retain full hair and headwear. Material swatches are references and are not certified tileable textures or engineering specifications. Door, glazing, covering and floor variants beyond the six wall references have not been generated.

## Validation and provenance
- Every generated source and final raster was visually inspected
- All final raster dimensions checked; nine equipment images confirmed to have a real 0–255 alpha channel
- All 24 portrait files have distinct SHA-256 values; visual review also checked identity differences and catalog correspondence
- All 39 final raster files have distinct hashes within their family
- `raster-validation.json` records filenames, byte sizes, dimensions, modes and hashes
- `portrait-validation.json` records the core name/age mapping
- `prompts/` contains the exact generation prompts for each of the 39 assets
- `BRAND-GUIDE.md`, `FONT-LICENSE.txt` and `build_brand.py` document the original vector brand

No public hosting, remote push, merge or deployment was performed as part of asset production.
