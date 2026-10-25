// The policy lexicon: every word list a content control reads, in one place (docs/content-policy.md).
// It began as gates/prose-lint.ts, which now re-exports it. The Python string checker reads the
// `export const NAME = /.../flags;` lines of this file by text (scripts/check-strings.ts passes this
// path), so each list stays one line in that shape.
//
// Shared mechanical prose patterns consumed by the game string checker. Audited 2026-10-20 when the
// settings filter took over keeping topics off a player's board (docs/calls/notes/content-rules-audit.md):
// UNSAFE_DETAIL keeps only wound anatomy and gore off the card (swat-call-design ethics E7, AGENTS.md
// "Grounded"); weapon, death, injury, procedure, restraint and the word "suicide" are allowed.
export const UNSAFE_DETAIL = /\b(blood(?! (?:pressure|sugar|type|test|orange|drive|bank|donor))\w*|bleed\w*|gore|gory)\b/i;
// Suicide method detail, kept by the owner on 2026-10-20 (ethics E4.1): means and acts of self-harm
// never reach a player, whether or not they chose the topic. SUICIDE_METHOD blocks phrasings with a
// self-directed method in them; METHOD_REVIEW flags words and phrasings that may name one (an
// overdose, sleeping pills, cut herself, jumped from the roof) but also turn up in ordinary medical,
// household or movement text, for a human read. Neither clears a call:
// swat-writing-review still reads every crisis call for method.
export const SUICIDE_METHOD = /\b(lethal dose|nooses?|(?:pills?|tablets?) (?:to|so (?:he|she|they|i) could) (?:die|(?:kill|end) (?:him|her|them|my|your|our)sel(?:f|ves)|end (?:it all|(?:his|her|their|my|your|our) lives?))|(?:hang|hung|hanged|drown)\w* (?:him|her|them|my|your|our)sel(?:f|ves)|(?:shoot|shot) (?:him|her|them|my|your|our)sel(?:f|ves) in the head|(?:shoot|shot) (?:his|her|their|my|your) own head|slit\w* (?:his|her|their|my|your) (?:own )?wrists?|(?:cut|slash)\w* (?:his|her|their|my|your) (?:own )?wrists?)\b/i;
export const METHOD_REVIEW = /\b(overdos\w*|dosages?|milligrams?|sleeping pills|carbon monoxide|(?:cut|shoot|shot|stab|poison|gas|electrocut)\w* (?:him|her|them|my|your|our)sel(?:f|ves)|jump(?:s|ed|ing)? (?:off|from) (?:the |a )?(?:bridge|roof|ledge|overpass|building|balcony|parking garage|garage|tower|cliff))\b/i;
export const ACCUSATION = /\b(stole|stolen|steal\w*|thief|thieves|theft|broke in|break-in|burglar\w*|robbed|robbery|attack\w*|assault\w*|abus\w*|threaten\w*|suspects?|culprit|criminal|intruders?|trespass\w*)\b/i;
export const HEDGE = /\b(reports?|reported|says?|said|claims?|claimed|alleg\w*|according|thinks?|believes?|accounts?|possible|unconfirmed|unchecked|before|doesn’t (?:mean|prove)|isn’t proof|nobody has checked|not (?:yet )?(?:checked|confirmed|proven))\b|\?/i;
export const SETTLED = /\b(arrest\w*|charged with|convicted|guilty|caught the)\b/i;
export const NEGATED = /\b(no|nobody|no one|not|never|without|nothing)\b/i;
export const META_PHRASING = /\b(invented|fictional|is claimed|are claimed|is implied|says nothing about|has been assumed|is not assumed|no (?:completion|movement|arrest|intruder) is (?:claimed|recorded|assumed)|this (?:story|scenario|game|simulation)|the player|for gameplay|in-game|game mechanics?)\b/i;

// Graphic harm beyond blood: anatomy, dismemberment, torture and gloating (control V1; Apple's
// "prolonged graphic or sadistic realistic violence" cannot be published, Google bans graphic
// depictions or descriptions of realistic violence).
export const GRAPHIC_HARM = /\b(entrails?|intestines?|viscera|brain matter|skull|spurt\w*|gush\w*|gouge\w*|sever(?:ed|ing)|dismember\w*|decapitat\w*|mutilat\w*|disembowel\w*|torture\w*|agoni[sz]\w*|screams? in pain|writh\w*|gasping for (?:air|breath)|bled out|brains?\b)/i;
// Named methods of violence against a person (control V4: menace comes from behavior, proximity and
// time, never from the act described). A hit is read by a person, not blocked.
export const METHOD_OF_HARM = /\b(stab\w*|slash\w*|slit\w*|strangl\w*|chok(?:e|es|ed|ing)|smother\w*|beat(?:s|ing)? (?:him|her|them) (?:up|to)|pistol[- ]whip\w*|execution[- ]style|execute[sd]?)\b/i;
// Real firearm makes, models and cartridges, and modification terms (control V5; Apple 1.1.3 bans
// content that encourages illegal or reckless use of weapons or helps buy them). Weapons are named by
// generic type: handgun, rifle, shotgun.
export const FIREARM_SPECIFICS = /(?<![\w.])(?:glock|ar-?15|ak-?47|ak-?74|smith (?:&|and) wesson|beretta|sig sauer|remington|winchester|ruger|mossberg|colt|9 ?mm|\.45|\.38|\.40 cal\w*|\.223|5\.56|7\.62|hollow[- ]points?|suppressors?|silencers?|bump stocks?|auto sears?|ghost guns?|3d[- ]printed (?:gun|firearm|weapon)s?)(?!\w)/i;
// Real agencies and security services a fictional department must not be mistaken for (control R4).
export const REAL_AGENCIES = /\b(nypd|lapd|fbi|atf|dea|cia|nsa|dhs|ice agents?|border patrol|secret service|homeland security|us marshals?|texas rangers)\b/i;
// A street address written into authored text (control H1: addresses in a call come from the
// generated place, never typed in).
export const STREET_ADDRESS = /\b\d{1,5} [A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)? (?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl)\b/;
// A clock time without AM or PM (control Q2). The speaker format ("Name: text") and stat rows never
// look like this because they carry no digits either side of a colon.
export const BARE_CLOCK = /\b(?:1[0-2]|0?[1-9]|1[3-9]|2[0-3]):[0-5]\d\b(?! ?(?:[AaPp]\.?[Mm]\.?))/;
// Strong language in direct speech (control L1): allowed from a person under pressure, never aimed at a
// group, never sexual or abusive in framing. Hits are notes, counted for the rating profile (rating.ts).
export const STRONG_LANGUAGE = /\b(fuck\w*|shit\w*|bitch\w*|bastards?|assholes?|goddamn\w*|motherfuck\w*)\b/i;
