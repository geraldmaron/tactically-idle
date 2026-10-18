# Course and branch emblems, and Command Staff portraits

Delivered 2026-10-18 for backlog item `manager-art`. Emblems are done; the three manager portraits wait for appearance briefs from the calls lane and will be added to this pack.

## Result

- 18 emblems: one per course (13, ids from `src/content/courses.ts`) and one per development branch (5, ids `branch_<branch>` from `BRANCHES` in `src/ui/components/labels.ts`).
- Runtime: `public/art/emblems/<id>.webp`, 512 × 512 WebP with true RGBA alpha (0–255), 18 distinct files. Byte totals are in `validation.json`.
- Course emblems use a graphite rim; branch emblems use a warm brass rim so the two kinds read apart.
- Shown at 40px in Training (`CourseEmblem`), and at 26px and 38px in Develop (`NodeGlyph`: the unlocked course's emblem, otherwise the branch emblem; gear art still wins where a node unlocks equipment). Missing or failed images fall back to the previous icons.

## Provenance

Each emblem was generated separately with Codex's built-in image generation tool (`codex exec`, configured default model `gpt-6.1-sol`), one image per call. No source photograph, stock pack or third-party art was used. The exact prompts are in `generation-prompts.json`; an entry with `redo` records why it was regenerated. The PNG masters (1254 × 1254 RGBA) stay outside the repository in `~/.codex/generated_images/`.

Runtime export: Pillow (Lanczos) resizes each master to 512 × 512, then `cwebp -q 88 -alpha_q 100 -exact` encodes it. cwebp's own resize was tried first and dropped the top alpha level to 254, so it is not used.

Generation count against the approved cap of 45: **19** (18 emblems plus one redo). One further call never reached the image tool: `codex exec` waited on stdin in a background shell, was stopped with no image made, and was rerun with stdin closed.

## Review at 40px

`contact-sheet.png` shows every emblem at 40px and at 128px. Judgment at 40px:

| Emblem | Legible at 40px | Resembles real insignia |
|---|---|---|
| crisis_negotiation_course | Yes; two bubbles and a handset, a little busy | No |
| entry_course | Yes; open door | No |
| drone_course | Yes | No |
| first_aid_course | Yes; amber plus reads, the bandage less so. Amber, not a red cross | No |
| composure_workshop | Yes after redo; the first pass drew a hairline that vanished at 40px | No |
| communication_refresher | Yes; radio with sound arcs | No |
| range_qualification | Yes; target rings, no weapon drawn | No |
| less_lethal_course | Readable shape, meaning carried by the course name | No |
| advanced_less_lethal_course | Readable shape, close to the less-lethal emblem by design | No |
| deescalation_course | Yes; open lowered hands | No |
| vehicle_operations_course | Yes; unmarked van | No |
| precision_support_course | Yes; spotting scope on a stand, no weapon | No |
| controlled_access_course | Yes; key and open padlock | No |
| branch_personnel | Yes | No |
| branch_field | Yes; four-point compass rose, not a badge star | No |
| branch_intel | Yes; eye in a lens | No |
| branch_logistics | Yes; strapped crate | No |
| branch_wellbeing | Yes; heart with a leaf | No |

No emblem has a shield-shaped badge, a rank chevron, a star badge, a wreath, lettering or a flag.

## Validation

- `npm run check:art` (`scripts/validate-art.mjs`) now covers the emblems set and fails on an emblem id that matches no course or branch; `src/ui/art/validate-art.test.ts` proves it on a fixture.
- `validate_emblems.py` (Pillow) checks ids against the prompts, size, mode, full alpha range and distinct hashes, and writes `validation.json`.
- `contact_sheet.py` rebuilds `contact-sheet.png`.

```bash
uv run --with pillow python docs/art/manager-emblem-expansion/validate_emblems.py
uv run --with pillow python docs/art/manager-emblem-expansion/contact_sheet.py
```
