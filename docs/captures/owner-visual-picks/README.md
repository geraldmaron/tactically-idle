# owner-visual-picks: captures for the two visual picks

Fixed-seed campaign (seed 41041, clock `2026-10-22T09:00:00`), 390x844 and 320x568, DPR 2, from the
visual-story branch. One contact sheet per option set and width is in git; raw frames are git-ignored.

| Pick | Contact sheets | What they show |
|---|---|---|
| Tab-root plate | `plates/contact-390.jpg`, `plates/contact-320.jpg` | HQ, Calls, Officers, Build (Upgrades and Armory) with no plate, 72px, 96px and 128px |
| Reading face | `face/contact-390.jpg`, `face/contact-320.jpg` | The decide beat and the debrief (two scroll positions) in the current face (sans) and the candidate serif |

Each frame is labelled with its file name: `<tab>-<none|72px|96px|128px>` and
`<decide|debrief|debrief-2>-<sans|serif>`. The plate is one token (`--plate-h` in `src/ui/theme.css`);
which tabs carry one is `TAB_PLATES` in `src/ui/art/tab-plates.ts`. The serif is the dev switch in
`src/ui/settings/candidates.ts` (`?face=serif`).

Regenerate, with the dev server on 5175:

```bash
node docs/captures/owner-visual-picks/capture-picks.mjs "$PWD" docs/captures/owner-visual-picks http://localhost:5175 390,320
for set in plates face; do for w in 390 320; do node docs/captures/ui-ux-audit/tools/sheet.mjs "$PWD" "$PWD/docs/captures/owner-visual-picks/$set" "$PWD/docs/captures/owner-visual-picks/$set" $w "" 170 6; done; done
```

`none` is `.tab-plate { display: none }`, injected by the script; 72, 96 and 128 set `--plate-h`.
