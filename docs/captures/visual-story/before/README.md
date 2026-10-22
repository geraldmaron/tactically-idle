# visual-story: before baseline

The unchanged tip, captured before any visual-story edit, so the after captures can be compared
screen by screen.

## What was captured

| Item | Value |
|---|---|
| Tip captured | `025b5f3` (`claude/tooling-leftovers-dc1a4a`, before any tooling change) |
| Widths | 390x844 (`390/`), 320x568 (`320/`), DPR 2, JPEG quality 80 |
| Campaign seed | `41041`, pinned in the page (see below) |
| Clock | fixed at `2026-10-22T09:00:00` |
| Step result | every step passed at both widths, no page errors (`probe.json` `errors` empty) |
| Frames on disk | 390: 87 frames, about 9.0 MB. 320: 128 frames, about 8.3 MB |

## What is in git

- `README.md`, `probe.json`, and one contact sheet per width: `contact-390.jpg`, `contact-320.jpg`
  (a grid of every frame at that width, about 0.6 and 0.8 MB).
- The raw frames in `390/` and `320/` are git-ignored (see the root `.gitignore`). They stay on disk
  so later captures can be compared. Regenerate them with the command below.

Command, run from the worktree with the dev server on 5174:

```bash
npx vite --port 5174 --strictPort
node docs/captures/ui-ux-audit/tools/capture.mjs "$PWD" docs/captures/visual-story/before http://localhost:5174 390,320
```

Contact sheets, from the frames on disk:

```bash
node docs/captures/ui-ux-audit/tools/sheet.mjs "$PWD" "$PWD/docs/captures/visual-story/before" "$PWD/docs/captures/visual-story/before" 390 "" 140 8
node docs/captures/ui-ux-audit/tools/sheet.mjs "$PWD" "$PWD/docs/captures/visual-story/before" "$PWD/docs/captures/visual-story/before" 320 "" 140 8
```

## How the campaign is fixed

The sim has one random draw, `randomCampaignSeed` in `src/sim/personnel.ts`, which reads a Uint32
from `crypto.getRandomValues`. The capture tool pins that draw to 41041 with a context init script,
so no source under `src/sim/` changed. The clock is fixed so Date-based ages and lapses match, and
CSS transitions and animations are settled to their final frame so no shot catches one mid-way.
`src/ui/qa-campaign.ts` has a seeded QA department (`?ti-qa-campaign=fresh`), but it only applies
inside a framed, temporary page, which this top-level capture does not use.

## Repeat check

A second full run on the same tip gave:

- 213 of 213 segments with the same visible-text hash (`textHash` in `probe.json`) and the same
  layout probe values.
- 168 of 215 JPEG frames byte-identical. The other 47 differ only in pixels (live-call and sheet
  frames); the cause is not isolated, most likely paint timing. Treat them as rendering noise, not
  campaign differences.

## Probe summary (baseline)

- `docOverflow` is false in every segment at both widths.
- `overflowing` is non-empty in 6 segments at 320, all on the review sheet (`23-review-sheet`).
- `probe.json` holds the per-segment numbers (chrome heights, small targets, small text).

## Tooling notes

- The capture writes JPEG `.jpg` frames. `docs/captures/ui-ux-audit/tools/sheet.mjs` now reads PNG
  or JPG frames, wraps them into a grid (`columns` argument), and writes `<prefix>-<width>.jpg`, or
  `contact-<width>.jpg` for an empty prefix. `summ.py` still expects the old PNG names.
