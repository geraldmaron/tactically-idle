// Shared mechanical prose patterns consumed by the game string checker. Audited 2026-10-20 when the
// settings filter took over keeping topics off a player's board (docs/calls/notes/content-rules-audit.md):
// UNSAFE_DETAIL keeps only wound anatomy and gore off the card (swat-call-design ethics E7, AGENTS.md
// "Grounded"); weapon, death, injury, procedure, restraint and the word "suicide" are allowed.
export const UNSAFE_DETAIL = /\b(blood\w*|bleed\w*|gore|gory)\b/i;
// Suicide method detail, kept by the owner on 2026-10-20 (ethics E4.1): means and acts of self-harm
// never reach a player, whether or not they chose the topic. SUICIDE_METHOD blocks phrasings that
// can only mean a method; METHOD_REVIEW flags words that can (an overdose, a dosage, sleeping pills)
// but also turn up in ordinary medical or household text, for a human read. Neither clears a call:
// swat-writing-review still reads every crisis call for method.
export const SUICIDE_METHOD = /\b(lethal dose|nooses?|(?:pills?|tablets?) (?:to|so (?:he|she|they|i) could) (?:die|kill|end)\w*|(?:hang|hung|drown|shoot|shot|cut|poison|gas|stab|electrocut)\w* (?:him|her|them|my|your|our)sel(?:f|ves)|(?:slit|cut|slash)\w* (?:his|her|their|my|your) (?:own )?wrists?|jump(?:s|ed|ing)? (?:off|from) (?:the |a )?(?:bridge|roof|ledge|overpass|building|balcony))\b/i;
export const METHOD_REVIEW = /\b(overdos\w*|dosages?|milligrams?|sleeping pills|carbon monoxide)\b/i;
export const ACCUSATION = /\b(stole|stolen|steal\w*|thief|thieves|theft|broke in|break-in|burglar\w*|robbed|robbery|attack\w*|assault\w*|abus\w*|threaten\w*|suspects?|culprit|criminal|intruders?|trespass\w*)\b/i;
export const HEDGE = /\b(reports?|reported|says?|said|claims?|claimed|alleg\w*|according|thinks?|believes?|accounts?|possible|unconfirmed|unchecked|before|doesn’t (?:mean|prove)|isn’t proof|nobody has checked|not (?:yet )?(?:checked|confirmed|proven))\b|\?/i;
export const SETTLED = /\b(arrest\w*|charged with|convicted|guilty|caught the)\b/i;
export const NEGATED = /\b(no|nobody|no one|not|never|without|nothing)\b/i;
export const META_PHRASING = /\b(invented|fictional|is claimed|are claimed|is implied|says nothing about|has been assumed|is not assumed|no (?:completion|movement|arrest|intruder) is (?:claimed|recorded|assumed)|this (?:story|scenario|game|simulation)|the player|for gameplay|in-game|game mechanics?)\b/i;
