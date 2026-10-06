# Equipment consequences in content v7

Only new v7 actions explicitly declaring `forceProfile` use the independent force-severity model. Owning, carrying, observing with, or displaying equipment is insufficient. Evaluation must select a serviceable exact unit for the chosen profile, an available qualified participant, and any complete physical supply bundle. An unrelated carried firearm cannot join a less-lethal choice. Failed eligibility and previews spend neither supplies nor random samples.

Task success, human harm, and completion are separate results. After the existing effort draw, an eligible explicit force use draws severity once. The record preserves model version, sample, profile, exact item and unit, target identity and label, public role, and resulting severity. Reloading replays and verifies that sequence. V1–v6 retain their original one-sample sequence and outcome tables.

`FORCE_RISK_V1` is fictional game balance, not real-world equipment performance or a medical prediction. Its ordered severity intervals make the lethal tail of both less-lethal profiles substantially smaller than the firearm tail while retaining possible injury, serious injury, and death. Neither demographics nor hidden facts enter that model. Public previews give qualitative risk and name the selected equipment; committed results name the actual consequence independently of whether the task worked.

Injuries are named records with continuing care responsibilities. Wounded or seriously injured people cannot be made healthy by later safe flags or ordinary conversation. Field care consumes a trauma kit and requires a qualified first aider; a successful or mixed effort records stabilization, not recovery. Medical responsibility transfers only when an available medical service explicitly accepts the person. Death is absorbing: treatment, dialogue, walking, safe flags, and an ordinary successful ending cannot reverse it. Other surviving people can still receive assistance, and an unresolved ending remains available. Debriefs retain casualties and identify unfinished responsibilities.

Protection has a concrete separate effect: an actually used, context-compatible protective item limits an authored serious officer injury to a wound. It does not eliminate injury, make anyone immune, reduce harm to the force target, or help routine conversation. The existing officer medical-care, evacuation and department recovery systems retain the aftermath. Their recovery periods are game scheduling balance, not medical prognoses. No new officer deaths or random harm on generic tasks are introduced.

Other contextual equipment keeps its established roles: communication equipment enables contact; relays recover only a genuinely degraded multi-squad radio link; lighting offsets darkness; optics need a visible scene; access tools change the work and time needed at a compatible door; medical supplies enable care; exterior vehicles keep their authored exterior limits. These remain distinct from force severity.

## Sources and design basis

High-level sources checked on 2026-10-06:

- [OHCHR, United Nations Human Rights Guidance on Less-Lethal Weapons in Law Enforcement](https://www.ohchr.org/Documents/HRBodies/CCPR/LLW_Guidance.pdf): less-lethal use can still cause injury or death. This informs the nonzero severity tail; no operational techniques or real-world percentages are implemented.
- [National Institute of Justice, Police Use of Force, Tasers and Other Less-Lethal Weapons](https://www.ojp.gov/library/publications/police-use-force-tasers-and-other-less-lethal-weapons): research on injury outcomes supports treating some less-lethal equipment as risk-reducing rather than harmless. It does not supply the game's numeric balance.
- [Microsoft Xbox Accessibility Guideline 109: Objective clarity](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109): clear current objectives, completed-task logs and understandable next steps support the persistent casualty record, separate task result and explicit remaining care responsibilities.

## Verification

`src/sim/force-risk.test.ts` covers ordered nonzero risk, success with fatal harm, deterministic replay, exact-unit and cartridge tracing, qualification and serviceability gates, privacy of hidden facts, no carried-weapon or legacy harm rolls, real protection effects, living care transitions, irreversible fatalities, unresolved closure, practice isolation and save tampering. Existing operation, save, capability and officer-consequence tests cover the retained systems.
