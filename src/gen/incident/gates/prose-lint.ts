// Shared mechanical prose patterns consumed by the game string checker. UNSAFE_DETAIL keeps
// anatomy, procedure, restraint and method words off the card; weapon and death words are allowed
// since the darker tier (swat-call-design ethics E16 and E17, owner 2026-10-19).
export const UNSAFE_DETAIL = /\b(blood\w*|bleed\w*|gore|gory|corpse|dead body|ammunition|bullets?|stab\w*|shot dead|suicid\w*|overdos\w*|tourniquets?|cpr|chest compressions?|defibrillat\w*|restrain\w*|handcuff\w*|tasers?|pepper spray|chokeholds?|batons?|dosages?|milligrams?|fractur\w*|broken (?:hip|bone|leg|arm|neck)|concussion)\b/i;
export const ACCUSATION = /\b(stole|stolen|steal\w*|thief|thieves|theft|broke in|break-in|burglar\w*|robbed|robbery|attack\w*|assault\w*|abus\w*|threaten\w*|suspects?|culprit|criminal|intruders?|trespass\w*)\b/i;
export const HEDGE = /\b(reports?|reported|says?|said|claims?|claimed|alleg\w*|according|thinks?|believes?|accounts?|possible|unconfirmed|unchecked|before|doesn’t (?:mean|prove)|isn’t proof|nobody has checked|not (?:yet )?(?:checked|confirmed|proven))\b|\?/i;
export const SETTLED = /\b(arrest\w*|charged with|convicted|guilty|caught the)\b/i;
export const NEGATED = /\b(no|nobody|no one|not|never|without|nothing)\b/i;
export const META_PHRASING = /\b(invented|fictional|is claimed|are claimed|is implied|says nothing about|has been assumed|is not assumed|no (?:completion|movement|arrest|intruder) is (?:claimed|recorded|assumed)|this (?:story|scenario|game|simulation)|the player|for gameplay|in-game|game mechanics?)\b/i;
