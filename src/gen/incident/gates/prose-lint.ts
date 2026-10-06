import { AMERICAN_ENGLISH } from '../../../content/american-english';
import type { IncidentFramework } from '../../../content/incident-frameworks-v9';
import { SCENARIO_FIRST_NAMES, SCENARIO_SURNAMES } from '../../../content/scenario-names';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { SCENARIO_CAST } from '../cast-v9';
import type { CastSlot } from '../cast-v9';

/** Prose gate for typed framework packages (docs/content-pipeline.md, "Gates").
 * Every rule is mechanical and explains itself; a human still reads the story sheet. */
export type ProseRule = 'american' | 'meta' | 'spoiler' | 'length' | 'names' | 'pronouns' | 'safety' | 'allegation';
export interface ProseIssue { rule: ProseRule; where: string; text: string; detail: string }
export interface ProseText { where: string; text: string }

/** 320 px budgets. The board, briefing and action list use 13-15 px type in a column about
 * 288 px wide, which holds roughly 34-40 characters per line. Titles may wrap to two lines;
 * a briefing line should stay within about seven. Measured against the issued catalog, which
 * fits, with room for the longest drawn names. */
export const LENGTH_BUDGETS = {
  title: 34, actionTitle: 60, factLabel: 40, briefingLine: 260, dispatchReason: 240, actionSummary: 230,
  stagePrompt: 120, endingTitle: 60, endingSummary: 240, outcomeText: 240, sentenceWords: 34,
} as const;

/** Phrasing that talks about the story instead of telling it (extends the v9 in-world test). */
export const META_PHRASING = /\b(invented|fictional|is claimed|are claimed|is implied|says nothing about|has been assumed|is not assumed|no (?:completion|movement|arrest|intruder) is (?:claimed|recorded|assumed)|this (?:story|scenario|game|simulation)|the player|for gameplay|in-game|game mechanics?)\b/i;
/** British forms AMERICAN_ENGLISH does not list but that read as British in new prose. */
const EXTRA_BRITISH = ['mum', 'mums', 'whilst', 'amongst', 'fortnight', 'pavement', 'car park', 'queue', 'queued', 'torch', 'lorry', 'post code', 'postcode', 'ring back', 'rang', 'flatmate'];
/** Graphic injury, weapon specifics and real procedure. The general word "weapon" in a
 * negative report ("no report of a weapon") stays allowed; detail does not. */
export const UNSAFE_DETAIL = /\b(blood\w*|bleed\w*|gore|gory|wounds?|wounded|corpse|dead body|guns?|firearms?|pistols?|rifles?|shotguns?|knife|knives|blades?|ammunition|bullets?|stab\w*|shoot\w*|shot dead|kill\w*|suicid\w*|overdos\w*|tourniquets?|cpr|chest compressions?|defibrillat\w*|restrain\w*|handcuff\w*|tasers?|pepper spray|chokeholds?|batons?|dosages?|milligrams?|fractur\w*|broken (?:hip|bone|leg|arm|neck)|concussion|unconscious|not breathing)\b/i;
/** Words that accuse. Before the check they must carry who says so, or a hedge. */
const ACCUSATION = /\b(stole|stolen|steal\w*|thief|thieves|theft|broke in|break-in|burglar\w*|robbed|robbery|attack\w*|assault\w*|abus\w*|threaten\w*|suspects?|culprit|criminal|intruders?|trespass\w*)\b/i;
const HEDGE = /\b(reports?|reported|says?|said|claims?|claimed|alleg\w*|according|thinks?|believes?|accounts?|possible|unconfirmed|unchecked|before|doesn’t (?:mean|prove)|isn’t proof|nobody has checked|not (?:yet )?(?:checked|confirmed|proven))\b|\?/i;
/** Settled guilt after the call. Allowed only in a negative ("nobody is arrested"). */
const SETTLED = /\b(arrest\w*|charged with|convicted|guilty|caught the)\b/i;
const NEGATED = /\b(no|nobody|no one|not|never|without|nothing)\b/i;
const PRONOUNS = {
  he: /\b(he|him|his|himself)\b/i,
  she: /\b(she|her|hers|herself)\b/i,
} as const;
const MALE_NOUNS = /\b(man|men|uncle|father|dad|son|brother|husband|grandfather|grandson|nephew|boyfriend|gentleman)\b/i;
const FEMALE_NOUNS = /\b(woman|women|aunt|mother|mom|daughter|sister|wife|grandmother|granddaughter|niece|girlfriend|lady)\b/i;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Unicode-aware whole-word match: drawn names can start or end with letters like é.
const word = (term: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${escape(term)}(?![\\p{L}\\p{N}_])`, 'u');
export const sentences = (text: string) => text.split(/(?<=[.?!])\s+/).map(part => part.trim()).filter(Boolean);
const ALL_FIRST_NAMES = [...new Set(Object.values(SCENARIO_FIRST_NAMES).flat())];

/** Player-visible prose of a compiled call, split at the moment the disputed point is
 * checked. `pre` is everything a player can read before that. */
export function scenarioProse(s: ScenarioDefinition): { pre: ProseText[]; post: ProseText[] } {
  const pre: ProseText[] = [], post: ProseText[] = [];
  const add = (list: ProseText[], where: string, text: string | null | undefined) => { if (text) list.push({ where, text }); };
  add(pre, 'title', s.title); add(pre, 'summary', s.summary); add(pre, 'dispatchReason', s.briefing.dispatchReason);
  s.briefing.known.forEach((text, index) => add(pre, `known[${index}]`, text));
  s.briefing.unknown.forEach((text, index) => add(pre, `unknown[${index}]`, text));
  (s.briefing.teamResponsibilities ?? []).forEach((text, index) => add(pre, `responsibility[${index}]`, text));
  for (const objective of s.objectives) add(pre, `objective ${objective.id}`, objective.label);
  for (const fact of s.facts) {
    for (const key of ['label', 'claim', 'note', 'uncertainty', 'source'] as const) add(pre, `fact ${fact.id}.${key}`, fact[key]);
    add(post, `fact ${fact.id}.confirmed`, fact.resolved?.confirmed); add(post, `fact ${fact.id}.disproved`, fact.resolved?.disproved);
  }
  for (const stage of Object.values(s.stages)) {
    const list = stage.id === 'resolve' ? post : pre;
    add(list, `stage ${stage.id}.prompt`, stage.prompt);
    for (const action of stage.actions) {
      add(list, `${action.id}.title`, action.title); add(list, `${action.id}.summary`, action.summary);
      for (const [band, text] of Object.entries(action.outcomePreview ?? {})) add(list, `${action.id}.preview.${band}`, text);
      for (const [band, effects] of Object.entries(action.outcomes)) effects.forEach((effect, index) => {
        // The disputed point is revealed by the check's own success text; only failures stay pre.
        const reveals = !!effect.reveal?.length;
        add(stage.id === 'resolve' || reveals ? post : pre, `${action.id}.${band}[${index}]`, effect.text);
      });
    }
  }
  for (const ending of Object.values(s.endings)) { add(post, `ending ${ending.id}.title`, ending.title); add(post, `ending ${ending.id}.summary`, ending.summary); }
  return { pre, post };
}

/** Same replacement the game applies: American spelling first, then cast names. */
function bindLike(text: string, replacements: Record<string, string>): string {
  const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  if (!keys.length) return text;
  const pattern = new RegExp(`\\b(?:${keys.map(escape).join('|')})\\b`, 'g');
  return text.replace(pattern, match => replacements[match]);
}
function castReplacements(s: ScenarioDefinition): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of SCENARIO_CAST[s.incident!.type] ?? []) {
    const drawn = s.story?.cast?.[slot.id];
    if (!drawn) continue;
    out[slot.authoredName] = `${drawn.firstName} ${drawn.surname}`;
    out[slot.authoredName.split(' ')[0]] = drawn.firstName;
  }
  return out;
}

function britishTerms(text: string): string[] {
  return [...Object.keys(AMERICAN_ENGLISH), ...EXTRA_BRITISH].filter(term => word(term).test(text));
}

function lengthIssues(texts: ProseText[]): ProseIssue[] {
  const issues: ProseIssue[] = [];
  const budget = (where: string): number | null => {
    if (where === 'title') return LENGTH_BUDGETS.title;
    if (where === 'dispatchReason') return LENGTH_BUDGETS.dispatchReason;
    if (/^(known|unknown|responsibility)\[/.test(where)) return LENGTH_BUDGETS.briefingLine;
    if (/\.label$/.test(where) && where.startsWith('fact ')) return LENGTH_BUDGETS.factLabel;
    if (where.startsWith('stage ')) return LENGTH_BUDGETS.stagePrompt;
    if (where.startsWith('ending ')) return where.endsWith('.title') ? LENGTH_BUDGETS.endingTitle : LENGTH_BUDGETS.endingSummary;
    if (where.endsWith('.title')) return LENGTH_BUDGETS.actionTitle;
    if (where.endsWith('.summary')) return LENGTH_BUDGETS.actionSummary;
    if (/\.(favorable|mixed|adverse)\[\d+\]$/.test(where)) return LENGTH_BUDGETS.outcomeText;
    return null;
  };
  for (const { where, text } of texts) {
    const limit = budget(where);
    if (limit !== null && text.length > limit) issues.push({ rule: 'length', where, text, detail: `${text.length} characters; the 320 px budget is ${limit}` });
    for (const sentence of sentences(text)) {
      const words = sentence.split(/\s+/).length;
      if (words > LENGTH_BUDGETS.sentenceWords) issues.push({ rule: 'length', where, text: sentence, detail: `${words} words in one sentence; keep sentences under ${LENGTH_BUDGETS.sentenceWords}` });
    }
  }
  return issues;
}

/** Gendered pronouns in a sentence that names the person must agree with the slot, unless
 * the sentence also names a gendered relative the pronoun can refer to ("her dad ... he"). */
export function pronounIssues(texts: ProseText[], slots: readonly { firstName: string; pronouns: CastSlot['pronouns'] }[]): ProseIssue[] {
  const issues: ProseIssue[] = [];
  for (const { where, text } of texts) for (const sentence of sentences(text)) {
    const named = slots.filter(slot => word(slot.firstName).test(sentence));
    if (named.length !== 1) continue;
    const [slot] = named;
    const wrong: ('he' | 'she')[] = slot.pronouns === 'they' ? ['he', 'she'] : [slot.pronouns === 'he' ? 'she' : 'he'];
    for (const set of wrong) {
      const licensed = set === 'he' ? MALE_NOUNS.test(sentence) : FEMALE_NOUNS.test(sentence);
      if (PRONOUNS[set].test(sentence) && !licensed) issues.push({ rule: 'pronouns', where, text: sentence, detail: `${slot.firstName} uses ${slot.pronouns}/${slot.pronouns === 'they' ? 'them' : slot.pronouns === 'he' ? 'him' : 'her'}, but this sentence says "${sentence.match(PRONOUNS[set])![0]}"` });
    }
  }
  return issues;
}

function safetyIssues(pre: ProseText[], post: ProseText[]): ProseIssue[] {
  const issues: ProseIssue[] = [];
  for (const { where, text } of [...pre, ...post]) {
    const unsafe = text.match(UNSAFE_DETAIL);
    if (unsafe) issues.push({ rule: 'safety', where, text, detail: `"${unsafe[0]}" is graphic, weapon or procedure detail` });
  }
  for (const { where, text } of pre) for (const sentence of sentences(text)) {
    const accusation = sentence.match(ACCUSATION);
    if (accusation && !HEDGE.test(sentence) && !NEGATED.test(sentence)) issues.push({ rule: 'allegation', where, text: sentence, detail: `"${accusation[0]}" is stated as fact before anything is checked; say who reports it` });
  }
  for (const { where, text } of [...pre, ...post]) for (const sentence of sentences(text)) {
    const settled = sentence.match(SETTLED);
    if (settled && !NEGATED.test(sentence)) issues.push({ rule: 'allegation', where, text: sentence, detail: `"${settled[0]}" settles guilt; the team records what it found, not a verdict` });
  }
  return issues;
}

/** Strings that fix the situation's answer; none may be readable before the check. */
export function spoilerStrings(framework: IncidentFramework): string[] {
  const whole = [...framework.variants, framework.confirmed, framework.disproved, ...framework.results, framework.waitFor?.result, framework.actOnReport?.wrong].filter((text): text is string => !!text);
  const parts = whole.flatMap(sentences).filter(sentence => sentence.split(/\s+/).length >= 4);
  return [...new Set([...whole, ...parts])];
}

/** Lint one compiled, cast-bound call against its framework package. */
export function lintScenario(s: ScenarioDefinition, framework: IncidentFramework): ProseIssue[] {
  const { pre, post } = scenarioProse(s), all = [...pre, ...post], issues: ProseIssue[] = [];
  for (const { where, text } of all) {
    for (const term of britishTerms(text)) issues.push({ rule: 'american', where, text, detail: `"${term}" is British spelling or usage` });
    const meta = text.match(META_PHRASING);
    if (meta) issues.push({ rule: 'meta', where, text, detail: `"${meta[0]}" talks about the story instead of telling it` });
    const placeholder = text.match(/\{[a-z_]+\}/i);
    if (placeholder) issues.push({ rule: 'names', where, text, detail: `unbound placeholder ${placeholder[0]}` });
  }
  const replacements = castReplacements(s);
  const preText = pre.map(entry => entry.text).join('\n');
  for (const spoiler of spoilerStrings(framework).map(text => bindLike(bindLike(text, AMERICAN_ENGLISH), replacements)))
    if (preText.includes(spoiler)) issues.push({ rule: 'spoiler', where: pre.find(entry => entry.text.includes(spoiler))!.where, text: spoiler, detail: 'situation or outcome text is readable before the disputed point is checked' });
  issues.push(...lengthIssues(all));
  const slots = (SCENARIO_CAST[s.incident!.type] ?? []).flatMap(slot => {
    const drawn = s.story?.cast?.[slot.id];
    return drawn ? [{ slot, firstName: drawn.firstName, surname: drawn.surname, pronouns: slot.pronouns }] : [];
  });
  if (slots.length !== (SCENARIO_CAST[s.incident!.type] ?? []).length) issues.push({ rule: 'names', where: 'story.cast', text: '', detail: 'a cast slot has no drawn identity' });
  const castFirst = new Set(slots.map(entry => entry.firstName));
  for (const { where, text } of all) {
    for (const { slot, firstName, surname } of slots) {
      const authoredFirst = slot.authoredName.split(' ')[0];
      if (authoredFirst !== firstName && word(slot.authoredName).test(text)) issues.push({ rule: 'names', where, text, detail: `authored name "${slot.authoredName}" was not bound to ${firstName} ${surname}` });
      else if (authoredFirst !== firstName && word(authoredFirst).test(text)) issues.push({ rule: 'names', where, text, detail: `authored first name "${authoredFirst}" was not bound to ${firstName}` });
    }
    // Drawn full names come out first: a surname can also be a first name ("Riya Thomas").
    const withoutCast = slots.reduce((rest, entry) => rest.split(`${entry.firstName} ${entry.surname}`).join(' '), text);
    for (const name of ALL_FIRST_NAMES) if (!castFirst.has(name) && word(name).test(withoutCast)) issues.push({ rule: 'names', where, text, detail: `"${name}" is a cast name but not in this call's cast` });
  }
  if (!slots.every(entry => all.some(({ text }) => word(entry.firstName).test(text)))) issues.push({ rule: 'names', where: 'briefing', text: '', detail: 'a cast member is never named in the call' });
  issues.push(...pronounIssues(all, slots));
  issues.push(...safetyIssues(pre, post));
  return issues;
}

/** Lint the authored package itself, before any building or cast is drawn. Names are
 * replaced with the longest drawable names so length budgets hold for every cast. */
export function lintFrameworkData(framework: IncidentFramework): ProseIssue[] {
  const slot = (SCENARIO_CAST[framework.type] ?? [])[0];
  const issues: ProseIssue[] = [];
  if (!slot) return [{ rule: 'names', where: 'cast', text: framework.type, detail: 'no cast slot registered in cast-v9.ts' }];
  if (slot.authoredName !== framework.name || slot.id !== framework.personId) issues.push({ rule: 'names', where: 'cast', text: slot.authoredName, detail: `cast slot ${slot.id}/${slot.authoredName} does not match framework ${framework.personId}/${framework.name}` });
  const longestFirst = [...SCENARIO_FIRST_NAMES[slot.pronouns]].sort((a, b) => b.length - a.length)[0];
  const longestSurname = [...SCENARIO_SURNAMES].sort((a, b) => b.length - a.length)[0];
  const worst = (text: string) => bindLike(text, { [framework.name]: `${longestFirst} ${longestSurname}`, [framework.name.split(' ')[0]]: longestFirst });
  const texts: ProseText[] = [
    { where: 'title', text: framework.title }, { where: 'dispatchReason', text: framework.dispatch }, { where: 'known[0]', text: framework.opening },
    { where: 'unknown[0]', text: framework.question }, { where: 'fact evidence.label', text: framework.factLabel },
    ...framework.approaches.map((text, index) => ({ where: `approach${index}.title`, text })),
    ...framework.approachResults.map((text, index) => ({ where: `approach${index}.favorable[0]`, text })),
    { where: 'verify.title', text: framework.verify }, { where: 'fact evidence.claim', text: framework.claim },
    { where: 'fact evidence.confirmed', text: framework.confirmed }, { where: 'fact evidence.disproved', text: framework.disproved },
    ...framework.resolutions.map((text, index) => ({ where: `resolve${index}.title`, text })),
    ...framework.results.map((text, index) => ({ where: `resolve${index}.summary`, text })),
    ...(framework.precaution ? [{ where: 'precaution.title', text: framework.precaution.title }, { where: 'precaution.summary', text: framework.precaution.summary },
      { where: 'precaution.favorable[0]', text: framework.precaution.result }, { where: 'late_precaution.title', text: framework.precaution.lateTitle }, { where: 'late_precaution.summary', text: framework.precaution.lateSummary }] : []),
    ...(framework.waitFor ? [{ where: 'wait.title', text: framework.waitFor.title }, { where: 'wait.summary', text: framework.waitFor.summary }, { where: 'ending resolved_waited.summary', text: framework.waitFor.result }] : []),
    ...(framework.corroborate ? [{ where: 'corroborate.summary', text: framework.corroborate.summary }] : []),
    ...(framework.actOnReport ? [{ where: 'act_on_report.title', text: framework.actOnReport.title }, { where: 'act_on_report.summary', text: framework.actOnReport.summary },
      { where: 'act_on_report.favorable[1]', text: framework.actOnReport.wrong }] : []),
  ].map(entry => ({ where: entry.where, text: worst(entry.text) }));
  for (const { where, text } of texts) {
    for (const term of britishTerms(text)) issues.push({ rule: 'american', where, text, detail: `"${term}" is British spelling or usage` });
    const meta = text.match(META_PHRASING);
    if (meta) issues.push({ rule: 'meta', where, text, detail: `"${meta[0]}" talks about the story instead of telling it` });
  }
  issues.push(...lengthIssues(texts));
  issues.push(...pronounIssues(texts, [{ firstName: longestFirst, pronouns: slot.pronouns }]));
  // Name-binding coverage: the person must be named where the player acts on them.
  const first = framework.name.split(' ')[0];
  if (!word(first).test(framework.opening)) issues.push({ rule: 'names', where: 'opening', text: framework.opening, detail: `${first} must be named in the opening` });
  // Briefed conversation pacing applies to every conversation that names the person.
  if (![framework.approaches[0], framework.verify].some(text => word(first).test(text))) issues.push({ rule: 'names', where: 'approach0.title', text: framework.approaches[0], detail: `${first} must be named in the first account or the check, so conversation pacing has a conversation to apply to` });
  return issues;
}
