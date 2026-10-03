# Complete equipment art expansion

Delivered 2026-10-03 UTC for the 28-item Tactically Idle catalog.

## Result

- 19 newly generated, individually authored equipment illustrations
- All 28 catalog IDs now have their own ready image; the original nine images are byte-for-byte unchanged
- Runtime: 512 × 512 WebP with genuine RGBA transparency, 1,375,158 bytes total
- New runtime art: 906,486 bytes total
- 19 high-resolution PNG masters retained in the separate equipment-art download, outside the runtime source tree
- A labeled contact sheet covers the complete catalog, including the preserved originals

## Visual direction

The new images match the original painted product-art direction: dark navy and graphite materials, restrained practical amber accents, upper-left studio lighting, cool edge light, believable wear and clean isolated silhouettes. Equipment uses an appropriate three-quarter view. Long response-class silhouettes fit diagonally; vehicles use a readable front three-quarter overview. The three vehicles have distinct cargo, protected-rescue and command silhouettes.

The abstract door-charge game token is deliberately illustrated as a sealed fictional access pouch. It contains no visible functional components, assembly, operation or placement detail. Firearm-like response classes are fictional assembled static game equipment, without branded endorsement, technical schematics, firing scenes or handling instructions.

## Provenance

Each of the 19 new subjects was generated separately with the built-in image-generation tool. No source photograph, stock pack or third-party art asset was used for the expansion. The existing nine assets were visually inspected as the house-style reference, and their previously recorded prompt style was reused. The exact 19 generation prompts are in `generation-prompts.json`.

The original PNG outputs were preserved. ImageMagick was used only to resize and encode the runtime exports and assemble the review contact sheet; no alternate source imagery or false placeholder image was substituted. No paid API fallback or external credential setup was used. Tool pricing and quota were not exposed, so no generation-cost claim is made.

No new third-party art license is attached to the generated assets. Their generation provenance is documented here; no claim of trademark ownership, manufacturer affiliation or exclusive copyright is made. The raster contact sheet uses the locally available DejaVu Sans font; no font file is included in the expansion archives.

## Validation

`validation.json` records dimensions, alpha ranges, byte sizes, alpha bounding boxes and SHA-256 hashes for all 28 runtime files. `validate_gear.py` reproduces the checks and compares the original nine against the checkout's HEAD to prove they are unchanged.

Checks passed:

- Exact catalog/manifest equality: 28 IDs, no duplicates or omissions
- All 28 images decoded successfully at 512 × 512 in RGBA mode
- Every image has a real alpha range of 0–255
- All 28 images have distinct SHA-256 hashes
- Original nine unchanged
- Visual inspection of the complete contact sheet and each newly returned generated image confirmed catalog-appropriate subjects, coherent style, complete framing and no baked checkerboard/background plate
- The app's `npm run check:art` reports 28 equipment images ready

The app should use `object-fit: contain` and retain its semantic accessible icon fallback for load failures. The art does not change simulation values or capability rules.

## Runtime integration

The publishable files are the 19 new `public/art/gear/<id>.webp` files, the updated `public/art/gear/manifest.json`, this directory and the historical delivery-note amendment. High-resolution PNG masters are intentionally not part of the runtime source commit.

This asset-production task did not push, merge, publish or deploy the project.
