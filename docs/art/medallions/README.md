# Call-type medallions

Delivered 2026-10-22 for backlog item `visual-story`: four painted round medallions, one per call
type, to match the scene plates in `public/art/plates/`.

## Result

- Runtime: `public/art/medallions/<call type>.webp`, 512 × 512 WebP with true alpha (56 to 83 KB each), listed in `public/art/medallions/manifest.json`. The ids are the keys of `CALL_TYPE_ICON` in `src/ui/icons/kit.ts`: `hostage_crisis`, `barricaded`, `active_armed_incident`, `protected_rescue`.
- Each disc is the type's own scene plate, cropped tight: the lit corner market behind barrier tape, the dark house with one lit window, the open car door in a sodium pool, the open van beside a wheelchair ramp. A graphite rim holds a thin inner ring in the type's badge hue (violet, cyan, rose-red, sky blue), so the ring still tells the types apart where the scene is dark.
- Runtime use: `CallTypeBadge` takes `medallion` and draws the painting when the type has one and `size` is at least `MEDALLION_MIN` (40px, `src/ui/art/Medallions.tsx`). Below that, and when the file is missing or fails to load, it draws the SVG badge, so the shape, label and `aria-label` guarantees of the kit are unchanged. Medallions appear on the debrief hero (44px, with the type's name) and the Casebook rows (40px).

## Provenance

Each image was generated separately with Codex's built-in image generation tool (`codex exec`, the configured default model `gpt-6.1-sol`, no `--model` flag, stdin closed with `< /dev/null`), one image per call. No source photograph, stock pack or third-party art was used. The exact prompts are in `generation-prompts.json`; an entry with `redo` records why it was regenerated. The PNG masters (1254 × 1254 RGBA) stay outside the repository in `~/.codex/generated_images/`.

Runtime export: `export.py` resizes each master to 512 × 512 with Pillow (Lanczos) and encodes it with `cwebp -q 88 -alpha_q 100 -exact`. `contact_sheet.py` rebuilds `contact-sheet.png`.

```bash
uv run --with pillow python docs/art/medallions/export.py hostage_crisis=<master.png> ...
uv run --with pillow python docs/art/medallions/contact_sheet.py
```

Generation count against the budget of 8: **5** (four types, one redo). The redo was `active_armed_incident`: the first pass read as a near-black disc at 40px and its thin rose ring vanished beside the graphite rim.

## Review at 40px

`contact-sheet.png` shows each medallion at 40, 64 and 128px on the app's card colour.

| Medallion | Legible at 40px | Notes |
|---|---|---|
| `hostage_crisis` | Yes | The lit shop window and the yellow tape read at once; violet ring |
| `barricaded` | Yes | The house shape and its one lit window; cyan ring |
| `active_armed_incident` | Yes after redo | The amber pool and the open car door; rose-red ring. The first pass was too dark |
| `protected_rescue` | Yes | The open van with its warm interior against the blue dusk; blue ring |

No medallion shows a person, a weapon, lettering, a badge, a flag or police insignia.

## Validation

`npm run check:art` (`scripts/validate-art.mjs`) covers the set and fails on a medallion id that is not a call type or a ready id with no file; `src/ui/art/validate-art.test.ts` proves both on a fixture.
