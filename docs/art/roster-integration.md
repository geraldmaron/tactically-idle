# Personnel, artwork and campaign integration

## Identity contract

`src/content/personas.json` is the authored identity catalog: 100 distinct fictional adults, including the eight established officers. Names, pronouns, appearance, cultural art direction, personal notes and portrait paths live here. No ratings, roles, certifications, temperament or moral attributes belong in this file.

`ageAtStart` means age when first introduced for a recruit, and campaign-start age for the eight starters. It is retained as an authoring field name; it does not make the whole unseen reserve age on campaign day zero. People introduced in an earlier cohort keep their real saved birth dates.

`identityId` joins an officer to the catalog. The gameplay officer id remains separate and stable. Existing v1–v3 people keep their names, builds, saved portrait keys and careers. Known starter identities are linked only when both old officer id and full name match. Unrecognized historical officers are not silently remapped to a new face.

## Campaign and succession

- Browser campaigns get a fresh cryptographic seed, persisted immediately before the first screen. `createInitialState(now, seed)` remains deterministic for fixtures and replays
- Role and build streams use campaign seed plus identity id. They do not read culture, visual presentation or pronouns
- The eight authored starter roles, career histories and wage anchors preserve the existing opening balance; their rating details vary by campaign
- Recruit roles, ratings, traits, certifications and prior service vary between campaigns. Older newcomers are allowed
- First-seen recruit builds and birth/service dates are saved. Repeated searches or targeting another role never reroll a person
- The existing small candidate pool remains three before development bonuses. It samples an approximately twelve-person local market, with core identities 009–024 arriving first
- Hiring and retirement make room for unseen reserve people. Each reserve person gets their authored introduction age once, then ages under the existing calendar and retirement rules
- Every ever-employed identity remains in a permanent exclusion list. Dismissed and retired people cannot return as recruits
- Unhired candidates can return with their same build; offers and current signing costs may change with time
- Exhaustion is explicit. The game never recycles a departed person to fill a slot. Adding another authored cohort extends the reserve without changing the selection contract

This is a finite cast, not an immortal or unlimited population system. There is no new death mechanic in this change; any future permanent departure must continue honoring the ever-employed exclusion list.

## Portraits and brand

Production portraits are `public/art/portraits/person_NNN.webp`, 512×532. All 100 catalog identities have individual portraits. Only `readyIds` in the checked-in manifest render as photos. Missing art is a deliberate navy personnel-file card with initials and “NO PHOTO ON FILE.” An image-loading failure uses the same treatment, never a borrowed or newly invented face.

The photograph is the person's file portrait, not a claim that their face is dynamically repainted every birthday. Current career age is preserved in the portrait tooltip and career UI. Full headwear must fit the crop. No changing rank, role insignia, specialist equipment or text is baked into officer portraits.

The renderer resolves a verified catalog identity to its current ready photograph, even if a saved record still has a procedural or old painted portrait key. Identity and full name must agree; an exact legacy starter id and name can also establish the match. Unmatched historical candidates and hired officers show the same intentional personnel-file card. No old procedural face is rendered, and no save reset, candidate refresh, name change or gameplay reroll is needed. Saved portrait keys are left untouched for compatibility. All local art paths honor Vite `BASE_URL`, including GitHub Pages subdirectory builds.

The real app surfaces use the compact header lockup, browser favicon, touch icon and an immediate HTML loading state. The brand pack's title/menu and native-sized exports are reusable assets; this browser game does not have a native project or new installed-app/PWA behavior.

Gear thumbnails are 512-square WebP cutouts gated by their own ready manifest. Existing named icons remain the safe fallback. Six optional wall-material reference swatches appear in a collapsed Construction reference on the Gear screen when available. Semantic map materials, furniture, geometry and tactical overlays remain vector-driven. Door, glazing, covering and floor photographs are not part of this first art set.

## Verification

Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `node scripts/validate-art.mjs`.

Use `/harness.html?only=portraits&n=100` in the dev server to inspect the full catalog with honest photo availability. Check at 390×844 and 320×568; the app's target maximum width remains 430px.

The pinned pre-change baseline was `0d6fe402472d688d99d0a9f9e2b93d177e6c88b8`: 356 tests passed, but TypeScript reported missing incident/fourth-squad test fixture fields and unused unfinished blueprint imports. This change repairs those specific type errors without implementing or changing unfinished floor/environment map behavior.

Browser screenshots were not obtained in this cloud environment: headless Chromium cannot open its required socket under the sandbox; the escalation runtime failed; the cloud browser blocks localhost preview access. Source, server-rendered component tests and production builds are verified separately from live-browser visual QA. No push, merge or deployment is part of this checkpoint.
