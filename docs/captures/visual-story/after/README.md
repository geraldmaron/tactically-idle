# visual-story: after

The same fixed-seed campaign (seed 41041, clock fixed at `2026-10-22T09:00:00`) as
[`../before/`](../before/README.md), captured on the visual-story branch after merging the
integration tip 9497b63. Widths 390x844 and 320x568, DPR 2, JPEG quality 80.

## What is in git

`README.md`, `probe.json`, `contact-390.jpg` and `contact-320.jpg` (every frame at that width). The
raw frames in `390/` and `320/` are git-ignored; regenerate them with the dev server on 5175:

```bash
npx vite --port 5175 --strictPort
node docs/captures/ui-ux-audit/tools/capture.mjs "$PWD" docs/captures/visual-story/after http://localhost:5175 390,320
node docs/captures/ui-ux-audit/tools/sheet.mjs "$PWD" "$PWD/docs/captures/visual-story/after" "$PWD/docs/captures/visual-story/after" 390 "" 140 8
node docs/captures/ui-ux-audit/tools/sheet.mjs "$PWD" "$PWD/docs/captures/visual-story/after" "$PWD/docs/captures/visual-story/after" 320 "" 140 8
```

## Result against the before set

- Every step passed at both widths and no page errors were thrown (`probe.json` `errors` empty).
- `docOverflow` is false in every segment at both widths, and the set of overflowing elements is
  unchanged from before (the 320 review sheet).
- Pictures: `<Icon>` uses in `src/ui/` rose from 228 to 244, and uses of a plate, Spot, call-type
  badge or status or outcome mark (`PlateArt`, `TabPlate`, `Spot`, `CallTypeBadge`, `StatusMark`,
  `OutcomeMark`, `EmptyState spot`) from 19 to 44. The ratchet in `src/ui/visual-floors.test.ts`
  (40 obligations) keeps them.
- Small text (declarations under 14px in CSS) fell from 347 to 307. In the capture, the probe's
  small-text count per screen fell on the roster (17 to 2 at 390, 17 to 3 at 320), Training (93 to
  42, 98 to 50), the Armory (64 to 53, 64 to 50) and the officer sheets, and rose on no screen except
  where an extra scroll segment was captured (below).
- Touch targets: the only sub-44px targets are the call cards' title buttons (80x25), which are the
  same in the before set; the whole card is the tap target through the title's stretched `::after`.
  The resource bar was 42px wide on trust and level at 320 until it was given `min-width: var(--touch)`.
- Where a screen's count of small targets or small text went up (Calls board and board after a call at
  320, debrief at 320, Upgrades at 320), the samples are the same elements as before: the plate adds
  96px to each tab root, so one more scroll segment is captured and its elements are counted again.

## Checked at 320

- The resource bar holds five buttons across 320 without overlap (funds 76px, rate 71px, trust 44px,
  level 44px, menu 44px). "Trust" and "Level" are hidden below a 360px frame and the icons carry them;
  the buttons keep their full aria-labels and their help sheets.
- Plates hold at 72, 96 and 128px on all five tab roots: see
  [`../../owner-visual-picks/`](../../owner-visual-picks/README.md).
- Painted medallions appear at 44px on the debrief hero and 40px on the Casebook rows; below 40px the
  SVG badge draws.
