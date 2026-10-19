# Hiring Command Staff from a candidate pool

Proposed and built 2026-10-19 after owner feedback on the Command Staff cards. Code:
`src/sim/staff-pool.ts` (people, levers, draws), `src/sim/command-staff.ts` (posts, hire, replace,
search), `src/ui/components/CommandStaff.tsx` (list and candidate compare). Tests:
`src/sim/staff-pool.test.ts`.

## What the owner asked for

1. A post nobody holds shows no face. (Shipped with this note: vacant posts show an empty silhouette.)
2. Command Staff are hired from a pool of candidates with relevant skills and costs, like officers,
   so hiring is a trade-off decision. The same should hold for officers.
3. Mobile layout best practice for the Command Staff list. The wrapping three-up grid felt wrong;
   is a carousel better?

## Challenge

### Carousel: rejected. Wrapping grid: rejected. Vertical list: accepted (shipped)

Strongest case against a carousel: Command Staff is a status board, not a shelf to browse. A
carousel hides four of five posts off-screen, so the one thing the section exists to answer
("who is on, who is off, what did they last do") needs swiping to read. Carousel items past the
first are rarely reached, horizontal swipes fight the page's vertical scroll on a phone, and a
row of peeking cards also gives no count of what is hidden. The three-up grid had the opposite
fault: five posts left an orphan row of two, and 120px-wide cards clamped the activity line to
fragments.

The list wins on every point that matters here: all five posts readable without a gesture, one
row per post at a 64px touch height, the status pill and latest action on the same line as the
role, hired staff sorted first, and room to grow past five posts. It is also shorter than the grid
was (about 330px against 380px). Best alternative considered: a two-up grid, which still leaves an
orphan and still truncates the activity line.

### Candidate pool for Command Staff: accepted with controls

Strongest failure mode: **fake choice.** Managers exist to remove micromanagement. If candidates
differ only by bigger and smaller numbers on one axis, one is always best per dollar, and the
"decision" becomes a spreadsheet the player solves once and resents. Five pools of candidates also
add five refresh loops, save weight and a lot of text to write.

Second failure mode: **levers that do not exist.** Today a manager has no stat that changes what
it does. A candidate's skill needs a real hook in that manager's loop, or the stat is decoration.

Controls, each enforced by a test:

1. **Two real axes per post, no dominated candidate.** Every candidate trades cost against a lever
   that already exists in the manager's loop (table below). A pool never holds a candidate that is
   at least as good on every lever and no more expensive than another (the same dominance check
   the call design skill applies to stage choices).
2. **Three archetypes per post, one of each in every pool.** Seasoned (strong on both levers,
   expensive), Specialist (strong on one lever, weak on the other, mid price) and Steady (cheap,
   modest on both). The player is choosing a shape, not a number.
3. **People, not cards.** Candidates are drawn from the existing persona pool (100 painted
   portraits, names, pronouns, notes), aged 35 and over, never someone already employed or in the
   officer candidate pool. No new art is needed, and `manager-identities` is replaced: the person
   in the post comes from the hire, not from a fixed profile.
4. **Small surface.** Three candidates per vacant post, drawn when the post is established and
   refreshed on the officer pool's cooldown. Nothing to manage once the post is filled.
5. **Choices that stay open.** A filled post can be re-staffed: the incumbent leaves with one
   day's salary as severance and the post's pool reopens. An early cheap hire can become a later
   upgrade.

Best alternative considered: keep fixed named managers and add Develop upgrade tiers. Rejected,
because it gives no choice between kinds of manager, only a later purchase of the same one.

### Officer pool: accepted with controls

Officer candidates already price ability: wage correlates 0.69 with average rating across the 100
personas (wages $39 to $56 an hour, average ratings 43 to 66, measured 2026-10-19 on seed 12345),
and a pool gives each candidate a different role where it can. Role fit is a real reason to pay
more or less, so the only dead option is within a role: about 11% of same-role pairs have one
candidate at least as well rated, with as many certifications, and no dearer. That only reaches a
pool when roles repeat (a shortlisted candidate, or more candidates than roles). Control: when a
pool repeats a role, it leaves out anyone who matches or loses to a same-role candidate already
offered on every count, unless nobody else is left (`officerDominates` in
`src/content/recruits.ts`, tested across seeds and refreshes).

## Levers per post

All values are first-pass tuning in `STAFF_LEVERS` and `STAFF_POOL` (`src/sim/staff-pool.ts`); the
ranges show the spread from Steady to Seasoned. Salary is per hour while on duty. Signing is a one-time fee.

| Post | Lever A (existing hook) | Lever B (existing hook) | Salary | Signing |
|---|---|---|---|---|
| Watch Commander | Extra stress recovery for squads it rests, 0 to 25% (`economy` rest recovery) | Rested squads return below 25 to 35 stress (`returnBelow`, now 30) | $37 to $72 | $1,110 to $2,160 |
| Training Sergeant | Course fee discount, 0 to 20% (`startCourse` cost) | Course XP bonus, 0 to 20% (course completion) | $37 to $72 | $1,110 to $2,160 |
| Quartermaster | Servicing cost discount, 0 to 15% on top of the tier's `repairMultiplier` | Wear reduction, 0 to 15% on top of the tier's `wearMultiplier` | none (paid through servicing) | $1,000 to $3,000 |
| Peer Support Lead | Sessions per hour, 1 to 3 (`sessionsPerHour`) | Stress off per session, 5 to 11 (`relief`) | $37 to $72 | $1,110 to $2,160 |
| Recruiter | Signing-fee discount negotiated on officers, 0 to 15% | Candidate floor: skips officers below an average rating of 40 to 55 | $37 to $72 | $1,110 to $2,160 |

## How it plays

1. Develop establishes the post (DP only; the funding moves to the signing fee).
2. The post shows three candidates in its sheet: face, name, archetype, the two levers as plain
   numbers against the post's default, salary and signing fee, and the net-per-hour change, the
   same projection officer hires use.
3. Hire signs the candidate; the post shows their face and name from then on.
4. Replace reopens the pool for that post.

## Decisions taken

The owner said to proceed with the proposals (2026-10-19):

1. The four personnel posts cost DP only in Develop; the funding moved to each candidate's signing
   fee. The Quartermaster's post is still the equipment manager node, whose tiers keep their prices
   because each tier raises the post's own servicing benefits.
2. The three painted managers (Sam Navarro, Jordan Pike, Robin Kessler) are offered first when
   their post opens, as one of the three archetypes. Later draws use the persona pool.
3. Replacing someone costs 24 hours of their salary. The departing person is not offered again in
   the next draw, and a new search never repeats the people it replaces.

Archetype lever bands: Seasoned 0.7 to 1 on both levers, Specialist 0.85 to 1 on one and 0 to 0.25
on the other, Steady 0.2 to 0.35 on both. Salary rises with the mean, so the three are always
priced in that order, and no candidate can match or beat another on both levers.

## Open points

- "Returns squads to duty below" counts a higher value as better because squads earn sooner; it
  also sends them back more tired. If playtests read it as a cost, flip the lever to a pure
  recovery or income lever.
- Old saves are rejected (save version 10), so local campaigns from before this change start over.

