# Tactically Idle writing skills

Four skills for every line a player reads in Tactically Idle, from the call card to an officer's
retirement note.

Each folder follows the open Agent Skills format: a `SKILL.md` with name and description
frontmatter, plus a `references/` folder the skill points into. Any agent on any model can use
them. A harness that loads skills finds them on its own, and an agent without skill support reads
the `SKILL.md` in full before starting, as the repo-root `AGENTS.md` says.

| Skill | Use it for |
|---|---|
| `swat-call-design` | The shape of a call before final wording: the person, the hook, three stages with a real dilemma each, consequences, endings, variants, the ethics screen |
| `swat-call-prose` | Every player-visible string on a call: card, briefing, facts, markers, stage prompts, choices, previews, results, endings, debrief, radio and dialogue |
| `swat-officer-stories` | Officer profiles, voice markers, trait origins, arcs, how story events change an officer, callbacks, shift report personnel lines |
| `swat-writing-review` | The second reader that decides whether finished text ships, for a single call or a batch of generated variants |

## Order of use

1. **Design** with `swat-call-design`. It produces a design sheet and leaves the lines alone.
2. **Write** with `swat-call-prose`, working from that sheet. Officer text that a call reaches
   goes through `swat-officer-stories` in parallel.
3. **Run the gates** each skill names: the vendored `swat-call-prose/scripts/game_string_checks.py`
   (python3 only), the content tests, then `npm run verify`.
4. **Review** with `swat-writing-review`, read by someone other than the writer. It routes each
   finding back to the skill that owns the fix and never edits the package itself.
5. **Freeze** under the rule in `docs/content-pipeline.md`.

Small edits can start at the step that owns them. A one-word fix to a choice title is prose work,
and it still goes through review before freeze.

## Rules that hold in every skill

- No em dashes, en dashes or spaced hyphens doing a dash's job in game text.
- Colons only where a format needs one: clock times, stat rows, the UI's speaker format.
- No stock AI tells. Every line names something a person on scene could see, hear, touch or do.
- Grounded and non-graphic. Preserving life is the value the game rewards.

## How these relate to written-voice

`written-voice` is a general house-voice skill installed per user, outside this repo. It owns
plain prose, the claims discipline and the tell checker (`scripts/voice-check.py` inside that
skill). These four skills sit on top of it and add only game rules. None of them restates its
catalog.

They still work without it. `swat-call-prose` carries its own string checker, so the hard rules
and the game's tell checks run anywhere python3 does. When `written-voice` is installed, each
skill runs its checker as an extra pass with the game allow list
(`swat-call-prose/references/game-allow-words.txt`) joined in, and records whether it ran.

Docs, code comments, commit messages and plans use `written-voice` alone, not these skills.

## Where the files live

The canonical copies are here in `.agents/skills/`, which Codex, Gemini CLI, OpenCode, Copilot,
Cursor, Zed and Antigravity read directly. Claude Code reads `.claude/skills/`, so each skill has
a relative symlink there (`.claude/skills/<name> -> ../../.agents/skills/<name>`). Keep this folder
flat, one level of skill folders, because some harnesses look no deeper.

When you add a skill:

1. Create `.agents/skills/<name>/SKILL.md` with a game-specific name. A personal skill with the
   same name hides a project skill in some harnesses.
2. Add its link with `ln -s ../../.agents/skills/<name> .claude/skills/<name>`.
3. List it in the table above and in the repo-root `AGENTS.md`.
4. Lint it with the skills lint from ai-workflow-config, or check by hand that the description
   starts with "Use when", the file stays under 500 lines, and it names its gates, what enforces
   it and when not to use it.
