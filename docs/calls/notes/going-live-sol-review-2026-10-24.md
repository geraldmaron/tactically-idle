**Verdict: reject the current version of Going Live.** Keep the premise and the three variants. Rework the evidence, costs and state handling before polishing more lines.

The strongest part is the stream’s changing role: it can expose the manager’s cover-up, expose the courier’s account, or supply an outside witness. The current implementation repeatedly claims more than the player established, forgets whether the stream is running, and substitutes humiliation or gun movement for a consequence that follows from the chosen act.

I reviewed **all 32 options across 11 nodes, all 12 endings, the prompts and their variants, threats, chat, briefing, profiles and cold open**. No files were edited.

## Part 1. Writing and scenario review

Field paths below use `node.choice.field`. Sources are [the main tree](src/content/call-trees/hostage-live.ts), [approach nodes](src/content/call-trees/hostage-live-approach.ts), [resolve nodes and endings](src/content/call-trees/hostage-live-resolve.ts), [shared helpers](src/content/call-trees/hostage-live-parts.ts), [chat](src/content/call-trees/hostage-live-chat.ts) and [incident data](src/content/incidents/hostage.ts).

**F/M/A** mean favorable, mixed and adverse. A replacement is an editorial proposal, not a claim that the revised call has passed its binding and path gates.

### The 10 worst problems, ranked

1. **The window conversation can injure two officers, while narrating one injury and inventing medical care.** `threat.talk_down.adverse` combines `officer: 'wounded'` with a separate incoming-fire draw. My replay wounded Singh and Vann. The next prompt claimed an officer was “with a medic,” while the records said care and transport were still needed. Remove the fixed injury, let the fire draw describe its own result, and wire actual care.

2. **The lie can become a rewarded kept promise.** I replayed `clerk_out F → say_clerk_backs F → camera_wall F → manager_first F → out_front_hands F`. The `clerk_backs` commitment ended as **`kept`**, without discovery or retraction. The design’s claim that the lie is charged on every exit is false.

3. **The new camera-wall cost is still false.** “Your squad loses its only view of the counter” contradicts the view through the glass established by `watch_feed` and used elsewhere. `phone_wall` slows audience growth and modifies two exit checks. It does not implement the claimed loss of sight.

4. **The evidence cannot establish the truths the engine reveals.** A store pickup recording cannot prove that the courier kept the order after leaving. An anonymous comment about a clerk eating from the cooler cannot establish who took this bag. Yet results settle `rider_clear`, and the call treats the resulting answer as knowledge.

5. **The common cold open contradicts situation 1.** It states that the bag was one the courier “picked up,” while the clerk’s favorable answer says the clerk took it **before the courier came**. This is a physical contradiction at the center of the mystery.

6. **The call announces exoneration without an investigation.** In situation 3, `on_stream F → camera_wall F → walk_live F` reached “Out, with the bag not on her” while **both `f_rider_clear` and `f_proof` remained unknown**. Hidden author knowledge is leaking into the ending.

7. **Several adverse previews conceal an aimed handgun.** Mockery, a missed call, viewers complaining or someone “deciding who did it” can resolve into the handgun being aimed at the manager. These forecasts understate the worst reachable result.

8. **Stream state is repeatedly forgotten.** After command successfully cuts the stream, `manager_first M` still describes filming and reading live comments. `phone_down M` can restore live filming without restoring the stream mechanically. Stopping a source also does not, by itself, remove its existing odds penalty.

9. **The doors and stockroom are mostly prose.** The clerk defaults to the scene room. `clerk_out` uses the ordinary route rather than a guaranteed rear route. The phone-down option promises an alley exit without binding that route. The blueprint can show a different operation from the one the writing describes.

10. **Too many “costs” are the subject’s reluctance or the author’s moral framing.** “A police voice on … own channel,” “the person who owes … the sentence,” and “whatever … says helps nobody prove anything” are not reliable losses the player can weigh. Some also imply that the held manager owes the armed courier a performance.

### Findings that apply across multiple options

These are structural findings, owned by **swat-call-design and engineering**, with wording owned by **swat-call-prose**.

- **`turnsOn` does not repair a soft preview.** Its breaking branch must be priced on every host option. The existing `manager_speaks` and `off_camera` adverse previews acknowledge an aimed handgun; most other hosts do not.
- **There are no wholly unread authored marks in the marks I traced.** That does not mean every mark delivers its advertised consequence. Several buy only a context line, and some readers misdescribe what the mark means.
- **`admitted` means two different things.** Both a private admission and an admission on camera set it. Later text calls it an on-camera admission.
- **`news_on` means a repost, not a van light.** The modifier “The van’s light is on the door” reads the wrong event.
- **`still_armed` is inconsistently charged.** It penalizes `phone_down` and `out_front_hands`, but not `last_word_stream`, although the handgun remains relevant to all three.
- **Promises need semantics beyond walking outside.** The commitment engine marks an open commitment kept when its recipient comes out. That is insufficient for “the clerk supports your account” or “we will send a clip tonight.”
- **Medical prose exceeds the modeled care.** Being outside, being hurt, requesting medical help and being accepted by a medical service must remain distinct.
- **Menus exceed the design contract.** `on_air` offers four options. `way_out` can also offer four. These are not merely terse choices; each carries a substantial paragraph.
- **The stakes of the missing order and the armed hold must remain separate.** Proving the courier did not steal an order neither excuses holding the staff nor settles what happens legally afterward.

### Card, cold open, briefing, profiles and facts

| Field | Verdict | Deficiency and concrete replacement |
|---|---|---|
| `title` — “Going Live” | **Keep** | Specific, short and relevant to both the act and its consequences. |
| `summary` — “went live to make the night manager say one sentence” | **Rewrite** | The sentence is withheld as a teaser while the danger comes late. The longest-name exports were 136–138 characters, beyond the design sheet’s tighter two-line target. Proposed hook: **“{rider.first} demands a denial on camera. More viewers join while the manager is held at gunpoint.”** Put the missing-order detail immediately in the brief. |
| `coldOpen` — “A bag … picked up at {place} at 11:40” | **Rewrite** | Narrates the disputed pickup as fact and contradicts situation 1. Replace with **“The complaint names {rider.first}. The order is logged as collected at 11:40.”** |
| `coldOpen` — “added up what two years of rent looks like without the app” | **Rewrite** | Narrated private thought, strained arithmetic and conspicuous author voice. Replace with **“The email shut off new orders. {rider.first} kept reopening it.”** |
| `coldOpen` ending — “hasn’t put the water down” | **Keep, with continuity repair** | A usable observed detail. Establish how the clerk subsequently reached the stockroom to call 911. The present text leaves those movements unclear. |
| Rider profile — “keeps every rating on a card in … wallet” | **Rewrite** | “Every rating” over two years of deliveries is an implausible quantity for one card. Replace with **“The missing order number is written on a card behind {rider.his} license.”** |
| Manager profile and whiteboard | **Keep** | A concrete job and object. Do not let the whiteboard establish facts it could not record. |
| Clerk profile | **Keep** | The age and employment connection support the family variant. They should constrain future persistent casting. |
| Friend profile | **Keep** | The friend has a credible reason to be present and stays outside. Later text should stop moving the friend casually between the patrol line and across the street. |
| `pressureLabel` — “{manager.first} on camera” | **Rewrite** | The briefing says the manager is out of frame. Replace with **“{rider.first}’s growing audience”** while the stream is running. |
| `dispatchReason` | **Rewrite** | The armed hold is earned. The house call-out record still lacks an explicit sourced refusal of patrol’s direction to come out. Add **“Patrol says {rider.first} refused the order to come outside and kept both staff inside.”** |
| Briefing as a whole | **Rewrite** | Dispatch, four known lines and two responsibilities already exceed the skill’s initial-information budget; deliberate pacing appends another line. Cut the repeated audience and position exposition. Keep the armed hold, demand and disputed order record prominent. |
| Unknown — “Who took the bag” | **Rewrite** | “Took” means collected, stole and carried inside in different passages. Replace with **“Where the missing order went.”** Use “collected,” “kept” and “stole” deliberately thereafter. |
| `handgun` fact | **Keep** | Reported versus seen is a useful distinction. A result that actually sees the handgun should settle this fact consistently. |
| `rider_clear.disproved` | **Rewrite structure** | “picked the bag up … kept it and marked it delivered” bundles three separate propositions. Pickup footage establishes only the first. Split collection from subsequent possession; reveal retention only from evidence that establishes it. |
| `proof.disproved` — “Nobody in the comments has seen the bag” | **Rewrite** | An absolute claim about every viewer. It also conflicts with the result mentioning Tuesday’s stream. Replace with **“No viewer has supplied a checkable delivery clip.”** |
| Situation notes | **Keep the three concepts** | Preserve the cover-up, dishonest courier and wrong-porch variants. Repair their evidence chains. Do not let a narrator announce the answer merely because the hidden truth says it. |

### Node `going_live`

**Prompt and dialogue — rewrite.** “The register phone rings and rings” conflicts with the subsequent choice to decide whether to call, and with the timeout saying the phone “stays silent.” The courier watches “it with a thumb on the screen,” which muddles the register phone and streaming phone.

Replace the prompt with:

> The register phone rings beside the streaming phone. {rider.first} leaves the receiver down. {manager.first} looks toward the stockroom whenever the camera turns away.

“Red light on Calloway” is distinctive but insufficiently explained. A screenshot of a red light is not an alibi for delivery. Establish what the screenshot claims to show, and let its limited value matter.

**Threat — keep the address discovery, rewrite its continuity.** “The address goes out” is understandable. The later call should remember that it happened rather than posting the address as a fresh discovery again. Set an `address_posted` mark and give its later reader a concrete consequence.

Replace the timeout’s “The register phone stays silent” with:

> {rider.first} leaves the callback unanswered and asks the viewers what to do.

**1. `on_stream` — REWRITE**

- **Title, summary, pull and cost:** The act is credible. “Four hundred strangers hear every question” is a meaningful exposure, but the count is not reliably four hundred. “It’s the first time tonight … someone who can answer back” is false after conversations with the manager and viewers.
- **F/M/A:** F establishes contact; M changes whom the courier addresses; A’s preview conceals the breaking branch’s aimed handgun.
- **Replacements:** Title **“Call the register on speaker.”** Cost **“The viewers hear your questions and {manager.first}’s answers.”** F result opening **“{rider.first} answers the register phone and switches on the speaker.”** A preview **“The camera stays on {manager.first}. The handgun can be aimed at {manager.him}.”**
- **Wiring:** `terms` changes the next prompt; `performing` speeds the source and worsens later dark/phone-down exits. These readers exist. The negotiator’s “Then let’s work out how … gets to say it” sounds like facilitating the compelled statement. Replace with **“What would let {manager.first} speak without the handgun beside {manager.him}?”**

**2. `clerk_out` — REWRITE**

- **Title, summary, pull and cost:** Freeing an incidental hostage is a strong reason to pick it. The back-door promise is not bound to the geography. The summary also gives an entry sequence instead of concentrating on the decision and exposure.
- **F/M/A:** F and M genuinely free the clerk. A fires into the ceiling regardless of the advertised breaking-point rule. The preview does disclose the shot, which is honest.
- **Replacements:** Summary **“{lead} brings {clerk.first} out by the rear exit. The stockroom door is visible at the edge of the stream.”** Cost **“If the door appears on camera, {rider.first} sees the clerk leaving.”** For a nonbreaking A, use **“{clerk.first} stops at the doorway when {rider.first} calls out. The officers cannot bring {clerk.him} farther.”**
- **Wiring:** Keep `safe: clerk` and `seen_back`. Put the clerk in the actual stockroom and bind the rear route. Gate any shot on a visible, established escalation and record the discharge as an event.

**3. `watch_feed` — REWRITE**

- **Title, summary, pull and cost:** Observation before contact is credible. “before you answer” gets the caller wrong: police are placing the callback. The unreturned-call cost needs the same repair.
- **F/M/A:** F gives `glance` and confirms the handgun. M exposes the team and sets `performing`. A can aim the handgun while its preview mentions only ringing.
- **Replacements:** Title **“Watch the counter before calling.”** Cost **“{rider.first} waits for the callback while viewers ask where the police are.”** A preview **“{rider.first} rejects the callback and may raise the handgun at {manager.first}.”**
- **Wiring:** `glance → manager_speaks +6` is real. Keep that relationship. The observed whiteboard smudge is currently decorative. Either make it a checkable discrepancy or cut it. Crucially, this option establishes a direct view through the glass that the rewritten camera-wall cost later denies.

### Node `address_out`

**Prompt — keep the arriving spectators, trim the performance.** The cars and phones are enough. “smiles a little at the ones that say they’re coming” is possible, but it is another cue turning the courier into a spectacle villain.

**Threat — rewrite.** “Patrol hauls them back” makes the outer perimeter conveniently fail so it can supply an action beat. The consequence need not put another civilian against the armed storefront.

Replace the label and landing with:

> **More people reach the tape**

> Patrol stops another person at the corner. {rider.first} reads the arrival out to the viewers.

This requires a corresponding change to chat that currently shows someone reaching the window.

**4. `call_back` — REWRITE**

- **Title and summary:** Calling is reasonable. “owning the silence” is workshop language. It is also unclear why police must apologize for a call they themselves left ringing.
- **Pull/cost:** The continued availability of contact is useful. The question “why the police let it ring” has the same caller confusion.
- **F/M/A:** F gets terms; M invites people toward the glass; A can produce an aimed handgun. The preview forecasts only mockery.
- **Replacements:** Summary **“{lead} calls the register and addresses {rider.first}, while the viewers at the corner listen on their phones.”** Cost **“{rider.first} can repeat the call to the people gathering outside.”** A preview **“{rider.first} hangs up. {manager.first} can be held at gunpoint for the camera.”**
- **Wiring:** `terms` and `performing` work. M’s invitation to the glass should produce a remembered perimeter consequence, rather than disappear after a source bump.

**5. `take_down` — REWRITE**

- **Title, summary and pull:** A platform takedown request is plausible as a request. The summary narrates successful execution before the roll. “The corner stops filling” promises control over people already traveling to the scene.
- **Cost:** “Your first move … is to take something away” is moral commentary. Name the contact risk.
- **F/M/A:** F stops the source; M switches devices; A also stops it and can produce physical coercion with the handgun.
- **Replacements:** Summary **“Command asks {stream_app} to stop this broadcast. {lead} keeps calling while the request is handled.”** Cost **“The broadcast may disappear before {rider.first} speaks to the negotiator.”** F preview **“The broadcast ends. {rider.first} answers the register phone.”** A preview **“The screen goes dark. {rider.first} can pull {manager.first} up with the handgun against {manager.him}.”**
- **Wiring:** `cut`, stabilization and the large negative bump do stop the source. Explain why changing devices defeats this particular intervention. Do not imply that platform moderation is inherently limited to one physical phone.

### Node `on_air`

**Default prompt — rewrite.** “The ask hasn’t changed” and “One sentence, said into the phone” restate the opening rather than advance it.

> {rider.first} holds the streaming phone toward {manager.first}. {manager.first} asks whether the camera has to stay on.

**Context prompts:**

- `lied_clerk`: replace “believes … is on … side” with **“{rider.first} repeats the claim that {clerk.first} backed the story.”**
- `terms`: the prompt promises a walk-out more explicitly than the preceding dialogue establishes. Put that undertaking in the earlier exchange or remove it here.
- `glance`: keep the remembered stockroom glance.

**Threat — keep the audience’s challenge, avoid making moral disapproval a mysterious reversal.** Viewers can object to holding people at gunpoint while believing the missing-order complaint was false. “The comments turn” currently blurs those two judgments.

Replace the landing opening with:

> Viewers start asking {rider.first} to let the staff leave. {rider.first} reads each request aloud instead of answering the negotiator.

**6. `manager_speaks` — REWRITE**

- **Title, summary, pull and cost:** Hearing the manager matters. Asking the manager to stand and perform a potentially incriminating statement while held at gunpoint is not a neutral fact-finding step. “You can’t take back a word” is vague.
- **F:** Situation 1 has a real admission, buried beneath “like something … carrying across the shop for days,” which is melodramatic inference. Situation 2’s withholding response is not the answer the favorable preview appears to offer. Situation 3 establishes only what the app displayed.
- **M:** Situation 2 treats pickup footage and a delivery entry as proof of retention. They are not.
- **A:** The preview discloses the handgun. The manager’s “coward with a handgun” is a stock provocation used identically across different people and truths.
- **Replacements:** Title **“Ask whether {manager.first} wants to answer.”** Cost **“The viewers will hear the answer before you can check it.”** S1 F opening **“{manager.first} faces the phone and names {clerk.first}.”** A lead **“{manager.first} refuses to answer while the handgun is beside {manager.him}.”**
- **Wiring:** Keep the `glance` advantage. Split private/public admission marks. Stop revealing retention from collection evidence. A refusal should not automatically become a character flaw or a punishment for the victim.

**7. `ask_chat` — REWRITE**

- **Title and summary:** Searching for a witness is credible. “Read the comments for who knows” is awkward. The five-minute sentence repeats the UI.
- **Pull/cost:** The courier cannot hear which comments police pause on while silently reading a tablet. That cost is invented unless the negotiator reads them out.
- **F:** The porch clip is useful, but timestamp, bag and address need checking before it clears anyone. The cooler allegation is hearsay. The midnight-handlebar comment does not establish that this was the disputed order.
- **M:** Naming the clerk should matter beyond one prompt. It can also occur after the clerk is already safe.
- **A:** The preview hides the handgun branch. “reads them aloud from memory” is a conspicuously contrived quiet result.
- **Replacements:** Title **“Look for a delivery witness.”** Cost **“{manager.first} remains inside while your squad checks the viewers’ claims.”** F preview **“You identify a claim your squad can check.”** S1 F result **“A former clerk posts an allegation about the night shift. The team records the account and asks for the order number.”** A quiet result **“{rider.first} keeps interrupting the call to read new comments.”**
- **Wiring:** Keep `proof_seen` only after verification. Narrow what `reveal: proof` means. Give `clerk_named` a real consequence or reduce its advertised importance. Deleting the `phone_wall` gate does not let this choice follow walling the camera: the graph has already left this node.

**8. `camera_wall` — REWRITE, INCLUDING THE NEW VERSION**

The original comments cost was wrong. The new cost is also wrong:

> “Your squad loses its only view of the counter and works from sound until the phone turns back.”

`watch_feed` explicitly provides the counter through the glass. The engine does not remove that sightline. It also does not implement “works from sound.”

- **Title:** Shorten to **“Turn the camera off {manager.first}.”**
- **Summary:** **“{lead} asks {rider.first} to face the camera at the wall and leave the sound on. The stream stops showing {manager.first}, but it also stops showing the handgun.”**
- **Pull:** **“The viewers no longer see {manager.first} on the floor.”**
- **Cost:** **“The camera no longer shows {rider.first}’s hands.”**
- **F/M/A:** F and M are physically intelligible. A’s preview needs the possible armed threat: **“{rider.first} keeps the picture and may aim the handgun at {manager.first}.”**
- **Wiring:** `phone_wall` really slows growth and changes `walk_live −4`/`walk_dark +6`. It does not remove viewers, comments or direct observation. Track camera visibility separately from direct sight. If losing the camera adds no real cost in a state where officers already see the counter, fold this request into the conversation instead of presenting a costly standalone dilemma.

**9. `cut_feed` — REWRITE**

- **Title:** **“Request a platform takedown.”**
- **Summary:** “two time zones away” is unplanted bureaucratic color. “The picture goes black” again announces success before the check.
- **Pull/cost:** Audience removal is a real change. The loss of a possible witness is meaningful only if the call remembers it rather than merely closing a menu.
- **F/M/A:** F and M are distinct. A’s “decides who did it” hides the handgun being pressed against the manager.
- **Replacements:** Summary **“Command contacts {stream_app} while {lead} stays on the register line. {rider.first} has not agreed to end the broadcast.”** Cost **“The broadcast can disappear while {manager.first} is still beside {rider.first}.”** A preview **“The broadcast ends. {rider.first} can hold {manager.first} against the front window with the handgun.”**
- **Wiring:** Keep `cut` and source shutdown. Define whether the request targets a broadcast or account. Carry the stopped state through every later option and ending.

### Node `chat_turned`

**Prompt — keep the visible act.** Reading hostile comments to the manager is specific. “worst” is narrator judgment; quote one or describe what it alleges.

**Threat and beats — rewrite.** “Count’s climbing past anything patrol can turn away” conflates online viewers with people approaching the perimeter. Replace it with:

> More people at the corner. Patrol is holding the line.

The threat label **“Viewers guess about the handgun”** is clearer than “The chat starts guessing.”

**10. `say_true` — REWRITE**

- **Title:** “Say one true thing” sounds like an exercise, not incident command.
- **Summary:** “nobody inside is hurt” needs a checked source. “the police are listening” is a slogan unless the subsequent contact demonstrates it.
- **Cost:** “A police voice on … own channel” is not a loss the player can assess.
- **F/M/A:** F genuinely redirects attention and lowers the source; M feeds the performance. A again hides an aimed handgun.
- **Replacements:** Title **“Address the viewers on speaker.”** Summary **“{lead} asks for the register phone on speaker and addresses the viewers. {rider.first} can end the call at any point.”** Cost **“{rider.first} can cut off the negotiator in front of the viewers.”** F preview **“{rider.first} answers the negotiator while viewers argue about the call.”** A preview **“{rider.first} cuts off the speaker and may threaten {manager.first} with the handgun.”**
- **Wiring:** The source changes support the intended audience trade. Keep those rather than claiming a new protective mechanic.

**11. `let_go_now` — REWRITE**

- **Act:** Keep the request to free the manager.
- **Cost:** “the person who owes … the sentence” accepts the armed courier’s claim of entitlement as narrator fact.
- **F/M/A:** F releases both staff through `clerkToo`; M refuses but preserves contact. A can aim the handgun, beyond “hears a trick and stands over.”
- **Replacements:** Title **“Ask for {manager.first} to leave.”** Cost **“{rider.first} can refuse and keep {manager.first} beside the handgun.”** A preview **“{manager.first} remains trapped. {rider.first} can bring the handgun up.”**
- **Wiring:** `still_armed` appropriately preserves a separate subject-resolution problem. The later node should remember how the release was obtained rather than flattening it into the same generic exit.

### Node `off_air`

**Prompt — keep the loss of the stream, repair the variants.** The `cut` prompt always wins before the “clerk still inside” prompt, so the latter does not add its intended context on these routes.

The negotiator’s “I want to hear you without them” sounds like taking ownership of the conversation. Replace with:

> Command ended the broadcast. The register line is still open.

**Threat — keep.** Repeated questioning of the manager is a visible pressure. Do not use the lack of a camera as the sole explanation for becoming violent.

**12. `own_it` — REWRITE**

- **Title, summary and pull:** Owning the command decision is credible and distinct.
- **Cost:** “hears that you took … viewers away” repeats the act rather than naming its consequence.
- **F/M/A:** F abruptly converts an explanation into release of both staff. M retains contact. A’s preview is vague about the handgun.
- **Replacements:** Cost **“{rider.first} can refuse the register call while {manager.first} is still inside.”** F result should include the release request: **“The negotiator explains the takedown, then asks for {manager.first} to leave. {rider.first} tells {manager.first} to get up.”** A preview **“The line stays open, but {rider.first} can press the handgun against {manager.first}.”**
- **Wiring:** Keep the rapport change and release. Do not claim care by a medic merely because the staff have left.

**13. `manager_quiet` — REWRITE**

- **Title and pull:** A private answer is a real alternative to public performance.
- **Summary/cost:** “only the room hears” contradicts speaking on the police line. “helps nobody prove anything” falsely dismisses a witnessed statement.
- **F:** Situation 1 supplies an admission; situation 2 still reveals retention from pickup evidence; situation 3 supplies uncertainty.
- **M/A:** Distinct responses, but A can become an armed ultimatum that the preview conceals.
- **Replacements:** Title **“Hear {manager.first} off the stream.”** Summary **“Ask whether {manager.first} wants to answer on the register line. The negotiator hears the answer with {rider.first}.”** Cost **“{rider.first} wants a public statement and can reject a private answer.”** A preview **“{manager.first} refuses. {rider.first} can point the handgun at {manager.him}.”**
- **Wiring:** A private statement is evidence to record, not public vindication. Give it a separate mark from `admitted` on camera. Remove the impossible past-tense agreement token `{manager~covered|cover}`; use **“{manager.first} says the complaint protected {clerk.first}.”**

**14. `move_up_dark` — REWRITE**

- **Title:** The stream is down; the street is not established as dark.
- **Summary/pull:** It promises the manager is within physical reach. The actual mark buys an entry-check bonus.
- **F/M/A:** F and M establish position; A also grants `team_close`, even when the courier sees the move. That is defensible if position was gained, but “unseen reach” is not.
- **Replacements:** Title **“Move closer with the stream down.”** Pull **“Your squad is closer if command has to order a rescue.”** A preview **“{rider.first} spots the move and can pull {manager.first} against the window with the handgun.”**
- **Wiring:** Keep `team_close → go_in +8`. Use the real position and sightline. If the courier switches the store lights off, model that change or replace the quiet A with **“{rider.first} moves away from the glass and stops answering questions.”**

### Node `clerk_talks`

**Prompt and exchange — keep the questioning, reduce the stage business.** The blanket and repeated denial are recognizable crisis-drama shorthand, but the denial does plant a question. It must mean something coherent in every variant.

**Threat — rewrite or give it a payoff.** The manager’s name appearing on the clerk’s phone is intriguing, but neither who placed the call nor its consequence is settled. The chat describes the courier placing the call, which the landing does not establish.

A cleaner threat is:

> **{rider.first} asks for the clerk**

> {rider.first} asks the negotiator where {clerk.first} went and waits for an answer.

It bears directly on the player’s decision without inventing another phone mystery.

**15. `clerk_asked` — REWRITE**

- **Act and pull:** Keep the interview.
- **Cost:** “You question a nineteen-year-old” treats ordinary questioning itself as wrongdoing. The meaningful cost is that the manager remains held while the interview proceeds.
- **F:** S1 contradicts the cold open. S2 reveals what the clerk could not know. S3’s uncertainty is credible.
- **M/A:** A refusal to continue is plausible. Pulling the blanket over the head is a familiar melodrama image; it adds little.
- **Replacements:** Cost **“{manager.first} remains inside while {clerk.first} tries to explain the order.”** S1 dialogue **“I took the bag. {manager.first} said to let the complaint stand.”** S2 result **“{clerk.first} saw the pickup. After {rider.first} left, the clerk only saw the app’s delivery entry.”** A result **“{clerk.first} stops answering and asks the officer to put the stream away.”**
- **Wiring:** Preserve `clerk_unsure → ask_chat +4`. Reveal collection evidence rather than `rider_clear` in S2. Record any admission as attributed testimony.

**16. `say_clerk_backs` — REWRITE THE MECHANIC**

- **Title and summary:** The lie is plainly disclosed to the player, which is correct. “this is a lie until someone checks” is wrong: checking can establish the underlying event, but cannot make the invented interview true.
- **Pull/cost:** The temporary relief is a credible temptation. “thousands … who will” check is a promise the engine does not fulfill on all paths.
- **F/M/A:** F and M create the lie. A discovers it before a commitment is created. The adverse preview also omits its possible armed consequence.
- **Replacements:** Summary **“Nobody has asked {clerk.first} about the bag. {lead} tells {rider.first} the clerk has already backed the story.”** Cost **“{clerk.first} can contradict the account your squad invented.”** A preview **“{clerk.first} contradicts the claim. {manager.first} can face the handgun while {rider.first} reads it.”**
- **Wiring:** A lie must never become `kept` merely because the courier leaves. Preserve a separate deception record. Make discovery or voluntary correction reachable through every continuation, including `manager_first`, both last-word exits and timeouts. Add the appropriate cost to exits that currently bypass it.

### Node `way_out`

**Default prompt — rewrite.** It assumes a TV camera is already trained on the door, while this node’s threat says the van subsequently parks and raises its light.

> {rider.first} asks how to come out. {manager.first} is still beside the cooler. A news crew is setting up at the corner.

**Context prompts:**

| Condition | Verdict |
|---|---|
| `proof_seen` | **Keep after genuine verification.** Asking who will receive the clip is a useful new demand. |
| `admitted` | **Rewrite.** “the comments haven’t slowed down” and “Everybody heard it” are false after a private admission. Use separate public/private marks and exchanges. |
| `exposed` | **Keep the door question.** The underlying allegation still needs an honest evidence chain. |
| `app_said` | **Keep.** It states an unresolved discrepancy rather than narrating the answer. |
| `held_back` | **Rewrite.** “can’t tell whether that was a kindness” narrates an inference. Use **“{rider.first} asks why {manager.first} would not answer on camera.”** |
| `clerk_named` | **Rewrite by safety state.** The clerk may already be outside. Use **“{rider.first} asks where {clerk.first} is.”** |
| `news_on` | **Keep as a repost.** Do not reuse it as proof of a van light. |
| `phone_wall` | **Rewrite.** Say **“The stream shows the wall. {rider.first} asks the negotiator about the door.”** Direct squad visibility is a separate fact. |
| `lied_clerk` | **Rewrite.** Describe the repeated claim, not an omniscient belief. |
| `turned_chat` | **Keep the visible question; state-check the handgun’s position.** |

The first-match system also hides consequential combinations. An admission or news repost can suppress the reminder that the player lied. Add combined contexts where that history changes the current decision.

**Threat — rewrite its chronology.** The light can become brighter or the crew can start broadcasting. It cannot newly arrive after the prompt and earlier results already placed it there.

**17. `walk_live` — REWRITE**

- **Act:** A witnessed walk-out is a real reason to pick it.
- **Cost:** “biggest audience of the night” is not inherently a player loss. The real trade is a phone in the courier’s hand and the release being exposed to public reactions.
- **F:** Routes to a “cleared” ending using hidden truth, even without evidence. The phone and empty-right-hand choreography is unnecessarily elaborate.
- **M:** The light “comes up” even when it was already up.
- **A:** The preview omits the handgun. The result places the manager behind the courier after the summary said the manager goes first.
- **Replacements:** Summary **“Agree to a filmed walk-out. {manager.first} leaves first, then {rider.first} comes out with the handgun left inside.”** Cost **“{rider.first} keeps the phone during the release and can stop to answer the viewers.”** A preview **“{rider.first} stops at the door with the handgun. {manager.first} may still be inside.”**
- **Wiring:** Keep the wall/proof/lie modifiers. Route to a neutral walk-out ending unless a public mark establishes the bag result. Settle the lie before rewarding any exit.

**18. `walk_dark` — REWRITE**

- **Title:** “Phone face down, then walk” is an act but oversells “dark”: the TV camera remains.
- **Cost:** “nobody to say what the bag was” is false when the porch clip or admission exists.
- **F/M/A:** F completes the exit; M frees staff while retaining the subject; A holds the correct remaining people. Those distinctions are useful. The mixed result’s extra 25 minutes is buried behind a preview that does not convey the prolonged hold.
- **Replacements:** Title **“Leave the phone on the register.”** Cost **“{rider.first} gives up the personal recording. The news camera can still film the front door.”** M preview **“{manager.first} leaves. {rider.first} stays inside with the phone and handgun through another long call.”**
- **Wiring:** Keep the stream-state-specific results and split held endings. Add the lie consequence here. The dark-phone branches are better state handling than most of the call; use that pattern elsewhere.

**19. `send_clip` — REWRITE**

- **Act and gate:** This is the most promising honest concession. `proof_seen` is an appropriate prerequisite once the clip has been checked.
- **Summary/cost:** “the clip won’t give the account back” is stronger than “we cannot promise reinstatement.” The company might reinstate it.
- **F/M/A:** F and M price whether the courier accepts that limited offer. A’s “After that, nothing” is stock melodrama.
- **Replacements:** Cost **“{rider.first} must leave before {delivery_app} answers.”** A result **“{rider.first} asks whether the account will reopen. The negotiator cannot promise that, and {rider.first} stops answering.”**
- **Wiring:** Record the approved undertaking separately from its fulfillment. Add `clip_sent` only when it is sent; do not let walking out mark this task complete. Tie the epilogue to delivery of the clip, not merely seeing it.

**20. `own_lie` — REWRITE**

- **Act:** Keep the opportunity to correct the lie.
- **Summary:** “is sitting down now, and has stood up before” is ominous author stage direction rather than a cost.
- **F/M/A:** F and M break the commitment but do not set `lie_found`; A does. Consequently, owning the lie and being caught can produce inconsistent later history. The preview for A conceals the armed threat.
- **Replacements:** Summary **“{lead} tells {rider.first} that the clerk was never asked. The account your squad gave the stream was invented.”** A preview **“{rider.first} repeats the lie to the viewers and can keep the handgun aimed at {manager.first}.”**
- **Wiring:** Set distinct `lie_retracted` and `lie_discovered` states, with a shared “lie acknowledged” reader where needed. Do not route to a speech about a watching audience after the stream has ended.

**21. `honest_next` — REWRITE THE COST; KEEP THE ACT**

- **Title/summary/pull:** Answering the courier’s actual question after voluntary shutdown is credible.
- **Cost:** “hears that nobody can promise the job back” is information, not a sacrifice. The consequence is that the courier may refuse to release the manager without that promise.
- **F/M/A:** These are meaningfully distinct and the previews broadly match them.
- **Replacement cost:** **“{rider.first} can refuse to leave without a promise, keeping {manager.first} inside.”**
- **Wiring:** Keep the `ended_it` gate. Retain the voluntarily ended stream state through every later result. F should explicitly leave the handgun behind before the walk-out.

**22. `manager_first` — REWRITE**

- **Act and pull:** A staged release is a legitimate alternative to trying to finish everything at once.
- **Summary:** It assumes a running audience even after a cut.
- **Cost:** Again, the manager does not “owe” the armed courier a sentence. “nothing … to bargain with but the door” treats the victim as a bargaining asset.
- **F/M/A:** F/M release staff but keep the armed subject. A routes onward even though it refuses release. That is acceptable only if `last_word` keeps the manager-inside state, which its first context does.
- **Replacements:** Cost **“{rider.first} stays inside with the handgun after {manager.first} leaves.”** Off-air M result **“{manager.first} walks out while {rider.first} argues over the register line. {rider.first} stays at the counter.”** A threat wording **“{rider.first} points the handgun at {manager.first} and refuses the release.”**
- **Wiring:** Branch F/M text by stream state. Charge the lie here. The option’s presence should also be reconciled with the stale design section claiming it was cut.

### Node `cornered`

**Prompt — keep.** It gives a visible change after public accusation.

**Exchange — keep the direct self-harm question.** It is appropriate to the declared risk. The evasive answer is plausible.

**Threat — keep the spreading clip, repair what it establishes.** A clip of an accusation can spread without proving that accusation. The call currently slides between those two meanings.

**23. `off_camera` — REWRITE**

- **Title and summary:** Voluntary shutdown is distinct from command taking the stream away.
- **Pull:** “Everyone … leaves the room at once” is metaphor posing as a physical result. The people are still online and recordings remain.
- **Cost:** Publicly ending the broadcast is credible, but it is mainly the courier’s difficulty. Pair it with the loss of an independent live view.
- **F/M/A:** F opens `honest_next`; M ends the stream without engagement; A honestly previews a possible handgun threat.
- **Replacements:** Pull **“The comments stop reaching {rider.first} live.”** Cost **“The broadcast ends before either staff member leaves.”**
- **Wiring:** Keep `ended_it` and `stream_off`. Remove ongoing audience penalties when this source is stopped, while retaining any explicitly modeled effect of already-public footage. Gate later chat and filming text.

**24. `friend_stays` — REWRITE**

- **Title:** Asking about the scooter is a credible practical future question. The current title is too long.
- **Summary:** “You are talking about tomorrow” explains the technique to the player. Show the actual request.
- **F preview:** “hands the scooter to {friend.first}” falsely narrates a transfer from inside the store. The result only names a person to collect it.
- **M/A:** M preserves contact. A’s laughter is a familiar stock beat and the preview omits the possible handgun threat.
- **Replacements:** Title **“Ask who should collect the scooter.”** Summary **“Ask {rider.first} who should collect the scooter. {friend.first} is waiting at the patrol line.”** F preview **“{rider.first} names {friend.first} and lets {manager.first} leave.”** A preview **“{rider.first} rejects the question and may point the handgun at {manager.first}.”**
- **Wiring:** `friend_promise → out_front_hands +4` is real. Rename the mark to describe the actual fact or request. Nobody has yet promised that the scooter will be collected or returned.

### Node `threat`

**Prompt and threat label — keep the visible threat, repair positions and media chronology.** The manager is visibly threatened, so this node can support command’s entry decision. The `notSafe: clerk` prompt precedes `shot_inside`, hiding the shot-specific context whenever the clerk is still inside. Combine those conditions where necessary.

The TV broadcast should not be the event that authorizes force. The handgun aimed at the manager is the relevant evidence; the current threat marks and authorization reader do provide that distinction.

**25. `talk_down` — REWRITE THE ACTION AND INJURY HANDLING**

- **Summary/cost:** It deliberately places the lead at an exposed window, in the handgun’s line, to get “face to face.” The text supplies no reason a trained negotiator must abandon covered phone contact. It reads as a heroic exposure test.
- **F/M:** Both have coherent release differences.
- **A:** The preview warns of injury. The implementation then applies a fixed wound and an independent fire draw. The authored wound text also violates the draw contract.
- **Replacements:** Title **“Keep talking from cover.”** Summary **“{lead} keeps {rider.first} on the register line while command holds the emergency team ready. {manager.first} remains beside the handgun.”** A result **“{rider.first} turns toward the street and fires through the window. {manager.first} is still inside.”**
- **Wiring:** Remove `officer: 'wounded'`; retain one `fire` draw and its generated consequence. Keep `knows_truth +6` only where genuine knowledge was established. Medical care must follow the actual casualty record.

**26. `go_in` — REWRITE**

- **Act/gate:** A rescue after an observed threat to the manager is legitimate within the house contract. Certification, authorization and shield contribution are actually wired.
- **Summary:** “while {lead} holds … at the window” carries the preceding unsafe tactic into a new choice and gives an unnecessary entry sequence.
- **Cost:** “so could {rider.first}” promises a death the authored `noFatal` force path excludes.
- **F:** “before … turn around” and “in seconds” make force a clean cinematic trick.
- **M/A:** Injury and death are properly differentiated, but medical acceptance and ending responsibilities are incomplete.
- **Replacements:** Summary **“Command approves an immediate rescue because the handgun is aimed at {manager.first}. Your squad enters, and the entry goes to review.”** Cost **“{manager.first} can be killed. Officers and {rider.first} can be badly hurt.”** F result **“The team reaches {manager.first} and brings {manager.him} outside. Officers have {rider.first}, with the handgun out of reach.”**
- **Wiring:** Keep authorization and the lower completion reward than a clean negotiated exit. Model care and review consistently on every injury path.

**27. `go_dark` — CUT AS WRITTEN**

- **Why:** With the handgun already on the manager, the player orders two external interventions and withdraws the nearby officers. The summary plainly says no officer could reach the manager before a shot. No visible scene-specific benefit justifies that loss of protection.
- **F:** Darkness conveniently makes the courier release the manager.
- **M/A:** The hold remains or the manager is struck. These are disclosed, but the favorable behavior is author convenience.
- **Engine:** The action does not actually change the building’s power or light state. Platform shutdown is guaranteed here despite being uncertain in its dedicated choice. Stabilization also leaves potential source penalties behind.
- **Replacement design:** **“Hold position and ask for the handgun down.”** Keep a covered contact route with the manager still at risk. Do not retain the lights tactic by finding a more attractive cost line. It needs a new rationale and modeled environmental effects before it deserves a place on the menu.

### Node `fired_on`

**Prompt — keep the broken window.** The `officer_down` variant must describe the actual casualty and care state. It currently invents a medic already present.

Replace its care claim with:

> An officer is hurt behind the patrol car. Medical care and transport are still needed.

**Threat — keep the unanswered incoming call as a human event.** Do not turn the friend into an improvised police intermediary. The timeout should name the team’s ongoing responsibility, rather than imply the ringing phones themselves constitute a resolution.

**28. `go_in` — REWRITE**

- **Summary/pull:** Reaching the manager before another shot is a credible aim. “Go in now” can take substantially longer than the contact option in the actual generated building.
- **Cost:** It again says the courier could die despite `noFatal`.
- **F/M/A:** They mirror the preceding entry with coherent severity differences, but the favorable result’s carried-out manager is unsupported by a need to carry them.
- **Replacements:** Title **“Order the rescue.”** Cost **“The manager can be killed during entry. The courier and officers can be hurt.”** F result **“Officers reach {manager.first} and bring {manager.him} outside. The team takes hold of {rider.first}.”**
- **Wiring/dominance:** In the reviewed S1 arrival, the Lab’s own grid marked this option beaten by `hold_talk`: the same 3% favorable chance, worse adverse chance, 11 rather than 6 minutes, and fewer unlocks. That is a specific state, not a universal claim. Fix the actual travel/position contract and give rescue a distinct benefit. Wording cannot make “now” true.

**29. `hold_talk` — REWRITE**

- **Summary:** “takes … at … word that the shot was a mistake” makes continued negotiation depend on believing an unverified excuse. A negotiator can continue contact while treating the shot as real.
- **Pull/cost:** Keep the second-shot risk. The pull should be the remaining contact, not faith in the explanation.
- **F/M/A:** F completes a surrender; M frees staff only. A can seriously injure or kill the manager. “closest” is too soft for that worst result.
- **Replacements:** Summary **“{lead} keeps calling from cover. {rider.first} is still answering, but the handgun remains beside {manager.first}.”** Pull **“The register line is still open.”** A preview **“Another shot can seriously injure or kill {manager.first} before the team reaches the counter.”**
- **Wiring:** The nonbreaking A routes to `entry_hurt` without narrating the extraction or entry that ending assumes. Add that actual intervention and care, or use a distinct ending. Record the shot into the counter as a discharge event.

### Node `last_word`

**Prompt — rewrite by state.** The default says the manager is outside with a medic and the courier is alone, although some routes arrive with the manager still inside. The first variant handles the manager, but “with the medic” remains an unsupported default. The `still_armed` variant places the handgun on the counter even after results put it in hand.

Use:

> {manager.first} is outside. The handgun remains within {rider.first}’s reach.

Keep the manager-inside variant first. Replace the generic exchange about deciding what “everybody” sees when the stream is cut.

**Threat — rewrite by stream state.** A dead or ended phone cannot film the ceiling. The breathing-and-cough timeout is an ominous stock beat.

> {rider.first} sits behind the counter and stops answering the register line. Command keeps the perimeter in place.

**30. `last_word_stream` — REWRITE**

- **Act:** A final statement is a recognizable concession.
- **Cost:** “command can’t take it back” is vague. The actual danger is that the statement starts another round of comments and extends the hold.
- **F:** “I did my job” is not an honest universal line for situation 3, where the courier delivered to the wrong porch. It also sounds like a closing slogan.
- **M/A:** Distinct from successful departure. M adds 30 minutes without a long-hold label; both can preserve hostages.
- **Replacements:** Cost **“{rider.first} can stop the walk-out to answer the next comments.”** S3 dialogue **“The bag was on that step. I left it there.”** S1 dialogue **“You heard {manager.first}. I didn’t keep the order.”**
- **Wiring:** Keep the live-stream gate. Apply the armed-state risk consistently across this menu. Break or correct the clerk lie here. Use an appropriate time label for the prolonged mixed result and retain the split held endings.

**31. `phone_down` — REWRITE**

- **Title/summary/pull:** The proposed private rear exit is a meaningful benefit only if the building provides it and the camera cannot see it.
- **Cost:** “whatever the stream decides … stays decided” is fatalistic narration. Existing footage and later reporting can change public belief.
- **F/M:** F leaves a live phone; M takes a live phone even on stopped-stream routes. F also ends at `out_quiet`, which insists the phone stayed inside; M’s filming needs its own stream-state support.
- **A:** A physical refusal at the stockroom is plausible.
- **Replacements:** Title **“Leave the phone and use the rear door.”** Cost **“{rider.first} loses the personal recording of the walk-out.”** Off-air M result **“{rider.first} comes into the alley carrying the dark phone. Officers take hold of {rider.him}.”**
- **Wiring:** Bind a real rear route, model whether it is visible to cameras and branch the phone text by stream state. Do not use an ordinary front route under an alley promise.

**32. `out_front_hands` — REWRITE**

- **Act:** A directed walk-out is credible. Keep the clear empty-hands result.
- **Summary/pull:** The friend’s visible location must match the patrol line and building.
- **F:** Again routes to “cleared” using hidden truth.
- **M:** “shuts down. Not another word, to anyone” turns silence into a dramatic permanent declaration and a mechanical provocation. A person declining further speech is not a failed surrender.
- **Replacements:** M result **“{rider.first} comes out with empty hands and stops answering when the camera turns toward the door. Officers take {rider.him} away from the entrance.”** Remove the automatic `provoked` event unless the scene gives an observable reason for it.
- **Wiring/dominance:** In all three sampled arrivals after `clerk_out A → talk_down M`, the existing grid marked this option beaten by `phone_down`. Repair the payoff comparison, including public witnesses, friend visibility and phone state. Keep the real `friend_promise` and `proof_seen` readers, but avoid awarding unearned vindication.

### Viewer chat and the stream clock

The register is mostly credible: short, untidy and mixed in motive. Its principal faults are **knowledge and state**, rather than slang.

| Surface | Verdict and replacement |
|---|---|
| Opening address thread | **Rewrite geography claims.** “green sign,” “next to the bank” and “bus stop out front” are stated as increasingly correct clues without being bound to the generated site. Bind real landmarks or keep them explicitly as guesses. |
| `on_air` early thread | **Rewrite order-dependent lines.** “did … just show something” and “hold on is that real” can follow already-visible gunfire. Use **“the handgun is still there”** where that is what the scene shows. |
| `count_two` / `three_k` chat | **Rewrite the hard counts.** The associated beats do not establish two or three thousand. Use **“more people coming in”** or bind the actual count. |
| `clerk_talks` thread | **Rewrite speaker knowledge.** “who is … calling” assumes the courier placed the call from the manager’s phone. Use **“is someone trying the clerk again”** unless the picture establishes who is calling. |
| `way_out` thread | **State-check.** It remains attached to a node reached after shutdown. The strip should obey the stream state; the text should not imply a personal broadcast has resumed. |
| `cornered` thread | **Mostly keep.** “who says? nobody proved it” is an appropriately skeptical viewer line. It also exposes the weakness in the scenario’s own evidence logic. |
| `threat` thread | **Rewrite media and sight claims.** “van moved closer” and “the gun is right on …” require a source that can see those things. Retain nearby-viewer attribution where used. |
| `fired_on` thread | **Keep the immediate reaction, state-check the picture.** “picture is shaking” is false if the camera remains wall-facing or the stream was cut. |
| `last_word` thread | **Rewrite after walling/cutting.** “picture is moving” and “count keeps going up” need the corresponding live state. |
| `address_out` thread | **Rewrite with the perimeter change.** Replace the person running to the store with **“someone is arguing at the tape”** if the landing keeps them there. |
| `chat_turned` thread | **Keep disagreement.** Replace “three thousand” with **“still more people joining.”** |
| Clock cue “Is that handgun real?” | **Rewrite or suppress after an established shot.** Proposed late cue **“another group is sharing the stream.”** |
| Clock cue “The count doubles in a minute” | **Rewrite.** The cue does not implement that jump. Use **“Another couriers’ group shares the stream.”** |
| Stopped/slowed/dropped pools | **Keep the basic distinctions.** A wall is different from an ended stream. Preserve that distinction in mechanics and results. |

The source’s ordinary start value displays approximately **554 viewers**, and its cue values correspond to about **1,070, 3,636 and 13,577**. Fixed “four hundred” lines should usually describe the follower base or be replaced with “viewers,” rather than claim a current count.

### All endings

| Ending | Verdict | Deficiency and concrete replacement |
|---|---|---|
| `out_cleared` | **Rewrite** | The title announces a bag finding the player may never establish. Replace the title with **“The courier is outside.”** Keep any statement about the missing order behind verified public evidence. The summary should state the staff’s safety and the courier being with the team. |
| `out_cleared.epilogueIf[proof_seen]` | **Rewrite** | Seeing a public clip does not establish that command sent it. The reinstated account supplies neat third-party closure and weakens the stated limit of the concession. Use **“{rider.first} asked for the order number to stay with the clip.”** A sent-clip follow-up should require `clip_sent`. |
| `out_cleared` admission/lie epilogues | **Rewrite conditions** | “Monday” has no campaign-calendar basis here. The proof/admission variants can also suppress the lie variant through first-match order. Use **“{manager.first} asked how to withdraw the complaint.”** Give the acknowledged deception its own surviving record. |
| `out_on_camera` | **Rewrite** | “walked out after … in front of everyone” is false for some alley and prior-release paths. Use **“{rider.first} is with the team outside. {manager.first} and {clerk.first} have left the store.”** Add the actual recording detail only when the route establishes it. |
| `out_on_camera.officer_down` epilogue | **Cut and replace** | “refused the ambulance until … in the car” is stock heroic self-neglect and contradicts unmet medical care. Replace with a line based on the actual care event, such as **“The injured officer asked whether both staff had come out.”** |
| `out_on_camera.friend_promise` epilogue | **Rewrite** | The scooter, neighbor and fulfilled undertaking are invented after a request merely named the friend. Use **“{friend.first} asked an officer whether the scooter could be collected.”** |
| `out_quiet` | **Rewrite** | Phone location and filming claims depend on route. “Before the patrol car pulled away” advances custody and transport beyond the walk-out. Use **“{rider.first} is with the team. {manager.first} and {clerk.first} are outside. The phone remains inside.”** Only use the last sentence on paths that actually leave it there. |
| `entry_clean` | **Rewrite** | “the handgun in an evidence bag” invents evidence handling. The officer-down epilogue invents delayed care. Use **“{manager.first} and {clerk.first} are outside, unhurt. The team has {rider.first}, and the handgun is out of reach.”** Handle review in the debrief, as the engine already does. |
| `entry_hurt` | **Rewrite** | A fixed arm posture does not fit every serious injury reaching it. “getting care” is not guaranteed by the effects. Use **“{manager.first} is outside, hurt. {clerk.first} is safe, and the team has {rider.first}. Medical care and transport are still needed.”** Replace that last sentence once an actual service accepts care. |
| `manager_killed` | **Rewrite; human read required** | Death is plain, but the partial ending lacks remaining responsibilities and leaves scene responsibility vague. Keep the clerk’s response. Proposed summary **“{manager.first} died inside {place}. The team has {rider.first}. {clerk.first} sits outside and asks an officer to stay.”** Record the actual remaining scene and medical tasks. |
| `manager_killed_rider_hurt` | **Rewrite; human read required** | “the crew is working on” claims accepted care; “before the team reached” can overstate chronology. Use **“{manager.first} died inside {place}. {rider.first} is hurt and with the team. {clerk.first} is outside and asks to call home.”** Add actual care status and remaining tasks. |
| `manager_hurt_inside` | **Rewrite** | The title and unresolved armed subject are clear. The fixed “it was … fault, twice” epilogue manufactures self-blame across all truths. Replace with **“{manager.first} asked the medic where {clerk.first} was.”** Only name the medic after modeled acceptance. |
| `rider_held` | **Rewrite lightly** | The clerk is omitted. Use **“{manager.first} and {clerk.first} are outside. {rider.first} remains behind the counter with the handgun. Command holds the perimeter and keeps calling.”** The friend waiting is a credible open ending. |
| `held_counter` | **Rewrite lightly** | Name the clerk’s safety. The fixed open line is false on paths where calls are no longer answered. Use **“{clerk.first} is outside. {manager.first} remains by the cooler with {rider.first} and the handgun. The team holds the perimeter and keeps trying the register phone.”** |
| `held_both` | **Keep structure; rewrite fixed night-long detail** | The remaining tasks correctly name both staff. “all night, where … could see” assumes unmodeled time and sight. Use **“{clerk.first} asked whether the stockroom door could stay open.”** |
| `handed_over` | **Rewrite** | “There’s nothing left … to try” exposes the finite menu as a claim about the world. The title also implies a handover the engine has not performed. Title **“Command holds the scene.”** Summary **“The staff remain inside. Command keeps the perimeter in place and the negotiator continues trying the register phone.”** |

### Gate results and limits

The engine walk covered **116,932 states across 12 draws**: all three situations, ordinary and deliberate pacing, and two building families. No walk hit its cap. Ten narrow band windows could not be forced. The explorer excludes lapses; I separately replayed the opening lapse chain through `address_out` and `chat_turned`.

The payoff-grid checks produced actual dominated-option findings at the states described above. Other choices have different payoffs; I am **not** claiming that similar odds alone make them dominated.

The string checker ran in memory on **681 strings in each of three binding configurations**. All three exited 1. The longest-name run reported:

- No hard length overflow, dashes, forbidden colons or missing bands.
- 33 overlong sentences, 18 repeated-sentence findings, 51 repeated-run findings and 8 address-mix findings.
- No automated feeling or stock-dialogue hits, despite the human-readable defects quoted above. Those zeros do not clear the writing.

The written-voice checker and canonical cliché scanner also ran against exported strings. The prose leans heavily on repeated phone, counter, camera and doorway beats rather than overtly ornate vocabulary.

The identity sample used **90 distinct call seeds, 30 per situation**. Pronoun counts were rider 36/40/14, manager 41/40/9, clerk 33/43/14 and friend 45/37/8 for he/she/they. No roster-surname collisions appeared in that sample. A cultural-skew clearance is **pending** because civilian identities do not carry culture metadata.

The normal tree-test command failed during startup because the read-only sandbox prevented Vite’s temporary files. A cache-disabled runner attempt also failed before executing tests. The normal string wrapper likewise could not create its temporary directory; the in-memory checker results above are separate evidence. `npm run verify` was not run.

Depth assessment: the three reframes are worth preserving; the timestamp gives the courier a recognizable voice; the lie is a usable temptation once its cost works. The manager and clerk remain thin outside their plot functions, stage-two choices use false exclusivity, and several epilogues invent closure. D7 remains the owner’s choice. **The call does not meet the writing-review approval gate.**

## Part 2. Fit with the persistent city and officers

**Recommendation: make Going Live a persistent local episode with a stable cast and site, independent of crews.** Reuse the existing world and people systems. Add narrowly typed encounter facts where the current interfaces cannot represent this call honestly.

The [world redesign](docs/world-redesign.md) explicitly keeps crisis and safeguarding calls independent of crews. The current implementation already provides generic officer write-back, ties and world-case resolution, but Going Live does not automatically acquire those connections merely by using the same names.

| Recommendation | Verdict | Minimal concrete change and control |
|---|---|---|
| Persist the courier as a known city person | **Accept with controls** | Use a stable subject ID, `crewId: null`, district and encounter history. Being known must not mean previously criminal. Cast only a person whose age, employment and recorded history fit the courier role. Never select a supply-network “courier” merely because the role noun matches. |
| Persist the manager and clerk | **Accept with controls** | Store their IDs, employment connection and site membership. Preserve the family relationship once situation 1 establishes it. Prevent ordinary patrol generation from turning these civilian records into random offenders. The present `Subject` type lacks that eligibility distinction; add it explicitly rather than relying on `crewId: null`. |
| Persist the friend | **Accept with controls** | Bind a stable coworker relationship to the courier. The friend can recur in ordinary city scenes. Do not generate a new friend identity whenever the same episode reloads. |
| Make this a repeat hostage call involving the same courier | **Reject** | Repeating the account suspension, disputed bag and demand resets the person’s history. Mark the episode consumed for this cast. A later appearance should follow its recorded outcome. |
| Give the store a persistent district identity | **Accept** | Add a stable site ID, district ID, business name and compatible building family/seed. Reuse location generation. The site needs employment and encounter references, not human subject status. Remove the bar/restaurant family unless the “store,” “clerk” and stockroom writing is adapted to it. |
| Make the delivery app a district resident | **Reject** | It is a citywide organization, not a resident. Reuse the existing `CITY`/`worldFor` canon. A local office or pickup partner could be a site later; Going Live does not require that system. |
| Persist the stream app and news outlet | **Accept** | Keep their existing shared identities. Record which broadcast, clip and outlet report belong to this episode. No new district-specific company generator is needed. |
| Open an investigation into the armed hold | **Accept with controls** | Open one encounter-linked case, or attach an existing case for the same episode. Preserve one award and one fee owner. The case should enter review from the observed result; the call should not decide charges merely because everyone came outside. |
| Treat “the courier did not steal the bag” as clearing the hostage case | **Reject** | These are separate allegations. Store the missing-order finding separately from the armed hold’s legal resolution. |
| Open a missing-order follow-up | **Accept with controls** | A verified porch clip, a clerk admission or conflicting records can create a follow-up task. The present `LeadSource` union concerns operational sightings, intel and armed contacts. Do not disguise a platform complaint as an armed lead. Add a small nonexpiring evidence/follow-up record, or extend leads with an explicitly non-tactical kind. |
| Let this call automatically open a warrant | **Reject** | The missing order and employment complaint do not establish a warrant-ready tactical encounter. An unresolved armed hold should retain the existing operation or containment responsibility, not silently restart the three-stage story under a warrant. |
| Write subject status at debrief | **Accept with controls** | Write the courier as with the team or still contained from actual outcome flags. Preserve injuries and deaths for every persistent cast member. Current `free/held/resolved/gone` statuses need encounter context; do not overload `resolved` to mean both legally resolved and physically outside. |
| Use `TreeEnding.world.resolution` as currently defaulted | **Reject for Going Live without changes** | `resolutionOf` falls back to `charged` on completion and `escaped` otherwise. A successful walk-out is not a charge; a courier still surrounded behind a counter has not escaped. Require an explicit, applicable mapping and a contained/unresolved result. |
| Read an officer’s tie to the courier | **Accept with controls** | Reuse the existing on-record tie reader and its total cap of 4 on applicable contact checks. Show what the officer actually knows. Do not let acquaintance establish innocence, the bag’s location or the courier’s future behavior. |
| Read ties to the manager or clerk | **Accept with controls** | Extend encounter references from the single `run.world.subjectId` to role-based person IDs. Apply a tie only to the person addressed. Keep the total contribution capped; four familiar people must not become four stacking bonuses. |
| Let the knowing officer make the arrest or handle evidence | **Reject** | Preserve the redesign’s control: the knowing officer may talk; another officer handles restraint and evidence. The call currently narrates generic officers, so this responsibility needs an actual participant assignment, not an assurance in prose. |
| Write officer memories | **Accept** | Reuse `applyPeopleDebrief`, `recordFact` and existing rescue, negotiated, injured and person-lost kinds. Add typed moment provenance so details come from what happened, not from a generic ending title. |
| Read memories in this call | **Accept with controls** | At most one factual callback, using the stated precedence of tie, pair beat, then imprint. A callback must cite a recorded encounter. It must not reveal this call’s hidden truth or determine which core branch exists. |
| Write imprints from particular moments | **Accept with controls** | Reuse existing packs and aftercare. Use actual exposure and participation, not “played Going Live” or a bad roll alone. Safe restraint creates no negative progression; civilian harm remains a recorded loss and care responsibility, not fuel for an officer flaw. |
| Add call-specific trauma or trait locks | **Reject** | This call does not need a bespoke trauma system. No immediate negative trait for taking down a stream, admitting a lie or failing a negotiation roll. Preserve the seen telegraph, aftercare fork, duration and scoped settling rules. |
| Add bond consequences | **Accept with controls** | Reuse actual shared participation. Do not infer “rear left open” from the phrase “out the back.” That currently rests partly on title/task heuristics. Record the assignment and failure before writing a blame-based bond cause. |

### The moments worth carrying forward

| Moment | Record or read | What it must not claim |
|---|---|---|
| Clerk brought outside | Rescue memory for participating officers; clerk’s safe encounter status | That an officer failed rear cover merely because the extraction had an adverse band |
| Clerk gives an account | Attributed evidence with speaker, order and time | That the statement establishes events the clerk did not witness |
| Manager admits a false complaint | Evidence and platform follow-up; separate public/private occurrence | A confession, charge or completed correction beyond what was actually said |
| Porch clip checked | Clip provenance, matching address/order and verification event | That seeing an anonymous upload alone proves the whole delivery history |
| Command invents clerk support | A command-deception event with the actual decision and acting participants | A generic personality flaw assigned to the officer who voiced the player’s order |
| Command retracts the lie | A separate retraction event | That retraction erases the original deception |
| Courier releases staff | Negotiated/rescue memory where the officer participated | That the courier’s allegation was thereby proved |
| Shot at the window | One discharge event and actual casualty results | A predetermined second injury |
| Successful contact after shots | Negotiated memory, with actual participants and firearm history | A punishment for restraint when everyone ends safe |
| Officer hurt | Injury fact and eligible aftercare/imprint from the real record | A medic visit or ambulance journey that never occurred |
| Manager hurt or killed | Persistent civilian condition, care responsibility and loss record | A positive officer-growth reward or an automatic negative trait |

### Smallest useful content and engine contract

These are **proposed additions**, not fields currently available everywhere.

1. **Give the episode stable identity.** Carry `episodeId`, `districtId`, `siteId` and role-to-person references from card through run and archive. Extend the existing serialized cast mechanism so reloads preserve all four identities, not only the principal subject.

2. **Separate identity from legal case linkage.** A reactive call needs city people without requiring a warrant and lead. Extend the existing reference contract with a reactive encounter variant; do not fabricate a lead just to obtain persistence or a tie bonus.

3. **Add a small authored event list to outcomes.** Events such as `staff_released`, `statement_given`, `clip_verified`, `deception_used`, `deception_retracted`, `shot_fired` and `clip_sent` should carry role and participant IDs. Reuse the committed-outcome path and debrief hooks.

4. **Make write-back idempotent.** Key episode, evidence, memory and case updates by run plus event. Reopening a debrief or loading an unresolved call must not duplicate memories, cases, payments or injuries.

5. **Keep tactical facts and legal conclusions separate.** Existing `safe`, `out`, harm and containment state determine the scene result. Review determines any legal case resolution. A bag finding belongs to its own evidence record.

6. **Render history from those records.** The jacket, district site and investigation can later mention the same night. Preserve one callback per operation and the normal unconnected version of the call.

**What should not change:** the three-stage structure, generated blueprint, independent crisis premise, three distinct missing-order situations, courier survival priority, negotiated exits, subject self-harm descriptors, and force requiring a visible threat plus command authorization. Do not add a crew boss, an automatic warrant, an app-reinstatement reward, or a special officer perk to make the call appear integrated.

The browser permission gate rejected opening the Scenario Lab because localhost access was declined. The rendered phone-width read, clamps and chat playback remain unverified.