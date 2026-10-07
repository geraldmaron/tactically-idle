# Officer data proposal

Design only. Nothing in this file exists in the game as of 2026-10-06. Never write player text
that implies any field here is wired, and never claim a request below has shipped until its code
and tests are observed.

The writing skill stops at this file. Shapes here are proposals for engineering to accept, change
or reject, written so the cost of each is visible.

## 1. Principles

1. Authoring data stays off the persona identity fields. Culture, appearance and pronouns keep
   their own file and never feed a formula, a trait or a story pool.
2. New officer fields are optional and JSON-safe, the same pattern the career module already uses
   for its hidden bookkeeping, so a save without them loads unchanged.
3. Every new field has a default that leaves current saves, current officer text and every issued
   incident fingerprint byte-identical. The mechanism is separation. Officer text renders at display
   time from the read-only view and never enters a `ScenarioDefinition` field, so nothing that the
   issued fingerprints hash or the prose lint scans ever varies with the roster.
4. Calls read officer story data through a read-only view. No call branch may depend on it.

## 2. The officer story file

Proposed as a new content file keyed by persona id. It holds the authored profile beyond the one
sentence the catalog has today.

```json
{
  "person_002": {
    "pressureLine": "He restores old radios and trusts nothing he hasn't opened up himself. He checks every handset twice.",
    "contradiction": "Fixes every radio in the building. Lets his own phone ring out.",
    "voiceMarkers": { "length": "medium", "noticesFirst": "gear", "habit": "reports gear before people" },
    "voiceSample": "Rear door. Both handsets good. Two of us. Your word.",
    "voiceOverloaded": "Rear door. Handsets good.",
    "layers": [
      { "unlock": { "sharedOps": 5 }, "text": "He keeps a spare handset in his bag, wrapped in a dish towel." },
      { "unlock": { "eventKind": "negotiated" }, "text": "Since {place}, he hands the spare to whoever is doing the talking." }
    ],
    "roleVariants": null,
    "hooks": ["checks_gear"]
  }
}
```

Field contracts.

| Field | Contract |
|---|---|
| pressureLine | 18 words max, opens with the persona's pronoun, role and trait neutral |
| contradiction | 12 words max, light, never a vice, a condition or misconduct |
| voiceMarkers | exactly three keys, values from the spec in profile-patterns.md |
| voiceSample, voiceOverloaded | 10 words and 4 words max |
| layers | at most two, each one sentence, slots filled only from the ledger |
| roleVariants | null, or one line for each of the 5 roles |
| hooks | identity-level tags from the hook vocabulary, never culture tags |

A cheaper first step needs no new file. Rewrite `personalNote` in the persona catalog as the
pressure line. The recruit card and officer sheet already show it, and the persona test already
checks the pronoun opener.

## 3. New officer fields

```ts
interface OfficerMemory {
  runId: string;
  day: number;
  kind: 'first_call' | 'rescue' | 'injured' | 'person_lost' | 'negotiated' | 'mentored' | 'favorable_under_pressure';
  place: string;   // the call by its place, never a civilian's bound name
  detail: string;  // 80 characters max, frozen at debrief
}

interface OfficerStoryState {
  ledger?: OfficerMemory[];                    // capped near 12, milestones kept
  traitHistory?: { traitId: TraitId; change: 'gained' | 'lost'; day: number; causeRunId: string }[];
  leaning?: { traitId: string; direction: 'toward' | 'away'; since: number; progress: number } | null;
  bonds?: Record<string, number>;              // other officer id to shared operations
  nickname?: { text: string; fromRunId: string; acceptedDay: number } | null;
}
```

The ledger must persist on the officer, because the save keeps only the newest 10 debriefs. The
trait list itself stays as it is, and history sits beside it.

## 4. The read-only view for calls

```ts
interface OfficerHooksView {
  officerId: string;
  surname: string;
  hooks: string[];
  voiceMarkers: { length: 'short' | 'medium'; noticesFirst: string; habit: string } | null;
  callback: OfficerMemory | null;  // at most one per operation, chosen by the dedupe rule
}
```

Callbacks render in a UI component beside the briefing, fed by `OfficerHooksView` at display time.
They never go into `ScenarioDefinition` fields (`known`, `dispatchReason`, `summary`), so issued
fingerprints and the distinctness gate are untouched. Name the component in request R15.

A call may show a callback beside its briefing or in its debrief and may voice an officer's in-call
line with these markers. It may not gate a choice, change an outcome or read a hook in a condition.

## 5. Cost list

- A new trait id touches the save trait list, the save version (9 when read), `TRAIT_INFO` and the
  resolution contributors.
- The ledger, history, leaning, bonds and nickname need save validation for each optional field
  and a migration test that loads a current save unchanged.
- Trait changes need a hook after debrief close, where career counts are already updated.
- The shift report needs a new personnel event kind for a trait change, or the change goes only to
  the debrief and the sheet.

## 6. Proposed lint for officer text

1. Word budgets per surface, from swat-call-prose's surface budgets.
2. Zero em and en dashes, checked by code point.
3. Colons only in strings the engine already builds with one (contributor labels such as
   `Chen: calm voice on the line`, and the decision log's title and line). The UI has no speaker
   format today. Attribute speech with "says" ("Mensah says, two inside.") or ask for an officer
   chip beside the line as a design-only request (R14).
4. Every pressure line opens with the persona's pronoun and passes the virtue word list.
5. Every callback, pair beat, nickname and exit fact resolves to a ledger entry.
6. No identity line states years, rank or a role.
7. No roster surname in a civilian cast on the same call as that officer.

## 7. Engineering requests

Each request uses the shape swat-call-design defines, so the four writing skills file one kind of
request. A save field states a save version where a call field would state a content version.

```
Engineering request
- Need: <what the writing needs, in one sentence>
- Current limit: <what the code does today, as read>
- Proposed field: <optional field and its default; the default leaves current output byte-identical>
- Version: save v<N> | content v<N> | none
- Blocks: <sheet rows or record lines that stay design only until it ships>
```

| Id | Need | Current limit | Proposed | Version | Blocks |
|---|---|---|---|---|---|
| R1 | profiles beyond one sentence | only `personalNote` exists | officer story file keyed by persona id, absent means today's note | none | Layer 2 and 3, markers in calls |
| R2 | callbacks older than 10 calls | debriefs capped at 10 | `ledger` on the officer, default empty | save | every callback beyond the newest 10 |
| R3 | trait change with cause and telegraph | traits set at hire only | `traitHistory` and `leaning`, default empty and null | save | every arc in the trait map |
| R4 | pair beats | no shared-operation count | `bonds`, default empty | save | pair beats |
| R5 | earned nicknames | no field | `nickname`, default null | save | nickname offers |
| R6 | name printed once in the shift report | name printed before a detail that opens with it | details drop the leading name | none | clean personnel lines |
| R7 | steady visible to the player | no contributor line | `{Surname}: steady, less strain while facts are open` | none | steady arcs reading as fair |
| R8 | mentor credited | rookie line omits the mentor | `{Rookie}: rookie, steadied by {Mentor}` | none | mentored ledger callbacks |
| R9 | civilians never share a deployed officer's surname | cast draw ignores the roster | exclude deployed surnames from the draw, in a new content version | content | collision findings |
| R10 | officer text checked by machine | prose lint reads typed packages only | the lint in section 6 | none | the lines gate passing on evidence |
| R11 | a timed or per-officer stand-down | `SquadDuty` 'rest' is squad-wide with no timer and nothing ends it | a per-officer rest flag with an end day and a clearing rule, default absent | save | any fork that takes one officer off calls for a set time |
| R12 | a telegraph the player has seen | no seen state on any officer note | `leaning.seenDay`, set when the shift report or sheet showing it is opened, default absent | save | every lock, which waits for the seen flag plus one operation |
| R13 | scoped arcs can read the step type | `DecisionView` lacks the action's `check.kind`, `tempo` and `entry` | copy those existing `ScenarioAction` fields into the decision record at commit, optional, never a parallel flag | save | every scoped strain row and the restraint check |
| R14 | a spoken officer line or pair beat shows who speaks | no speaker format in the UI | an officer chip beside the line, no colon in the string | none | pair beats, attributed in-call lines |
| R15 | callbacks beside the briefing | no slot outside `ScenarioDefinition` fields | a briefing callback component fed by `OfficerHooksView` at display time | none | every briefing callback |

R6 to R8 change player-visible strings built in code, so they need a test update and an owner
sign-off. R9 changes cast binding, so it lands only in a new content version and never touches
issued output.
