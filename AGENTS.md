# Agent instructions for this project

Tactically Idle is a portrait mobile idle and management game: run a SWAT department, hire and
equip officers, and play short three-stage branching calls on a generated building blueprint.
Design lives in `PLAN.md`; the location and operation contract in `docs/operation-model.md`.

## Build and test

```bash
npm install
npm run dev        # http://localhost:5173 at a phone-sized viewport (390x844 target)
npm test           # vitest
npm run verify     # typecheck, tests, art validation, build
```

## Architecture

See the Layout table in `README.md`. In short, `src/sim/` holds the game rules and save data,
`src/content/` the authored data (scenarios, personas, locations), `src/gen/` the generated
incidents and their gates, and `src/ui/` the screens and blueprint renderer.

## Conventions

- Content changes follow `docs/content-pipeline.md`: agent brief, typed package, automated
  gates, story sheet review, freeze in the next content version.
- Issued calls and saved campaigns must keep regenerating identically. Version-gate changes to
  issued text instead of editing it in place.

## CI validation

Pull requests run `npm run verify`, a Pages-base build, and a cross-engine fingerprint check
under Bun (`.github/workflows/`). Run `npm run verify` locally before opening a pull request.

## Player-facing writing

The writing is the main draw of this game. Before writing or editing any text a player sees
(call cards, briefings, stage prompts, choice titles and summaries, outcome previews, results,
endings, debriefs, map markers, radio and dialogue, officer bios and arcs, shift reports), read
the matching skill's `SKILL.md` in full and follow it, opening its `references/` where it points.
Harnesses with skill support load these on their own; everyone else reads them by path.

- `.agents/skills/swat-call-design/SKILL.md`: shaping a new or reworked call before final wording.
- `.agents/skills/swat-call-prose/SKILL.md`: writing any player-visible string on a call.
- `.agents/skills/swat-officer-stories/SKILL.md`: officer profiles, traits, arcs and how events change officers.
- `.agents/skills/swat-writing-review/SKILL.md`: deciding whether finished text or a batch of variants ships.

Order and the relation to the personal `written-voice` skill are in `.agents/skills/README.md`.

These rules hold even when no skill loads:

- No em dashes, en dashes or spaced hyphens used as dashes in game prose.
- Colons only where a format needs one (clock times, stat rows, the UI's speaker format).
- No stock AI tells. Name something a person on scene could see, hear, touch or do.
- Grounded and non-graphic. Preserving life is what the game values.

Each skill's canonical copy lives in `.agents/skills/<name>/`. Claude Code reads
`.claude/skills/`, so a new skill also needs `ln -s ../../.agents/skills/<name> .claude/skills/<name>`.
