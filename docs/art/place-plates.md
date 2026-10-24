# Place plates

Delivered 2026-10-23: one painted exterior per building family, so a call's hero shows the kind of place it
is set in instead of one plate per call type. `place_<family>` in `public/art/plates/`, 1200 x 675 RGB, 15 files
(the 13 families calls use, plus `small_office` and `warehouse`). `src/ui/art/Plates.tsx` `placeFor(familyId)` strips
the persistence suffixes (`__furnished_v7`, `_g2`, `_v1`) and the brief and the board card fall back to the
call-type plate when a family has none.

Method: one `codex exec` call per image on `--model gpt-6.1-sol` (built-in image tool, stdin closed), the existing
`scene_hostage_crisis` plate attached as the style reference, 3:2 master cropped to 16:9 around the middle band
because the hero shows a wide strip. Prompts, source files and processing are in `place-plates-prompts.json`. The
masters stay in `~/.codex/generated_images/`.

Adding a building family takes a `place_<family>` plate in the same change. The place kinds shown with the name
('Pub', 'Roadside motel') are `PLACE_KIND` and `VENUE_KIND` in `src/ui/components/incident.tsx`.
