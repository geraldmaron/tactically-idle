// docs/content-policy.md, rendered from the registry so the doc cannot drift from the controls
// (policy-corpus.test.ts holds it as a file snapshot). The rating profile is computed by the caller from
// the shipped calls, because deriving descriptors needs the compiled trees.
import { CONTROLS, gaps, type Family } from './controls';
import { POLICY_SOURCES, type PolicySource } from './sources';
import { FREQUENT_SHARE, reviewNotes, type RatingProfile } from './rating';

const FAMILY_TITLES: Record<Family, string> = {
  violence: 'Violence and weapons', self_harm: 'Self-harm', real_world: 'The real world', harassment: 'Harassment and addresses',
  user_content: 'Other people\'s content', listing: 'The store listing', rating: 'Rating and disclosure', quality: 'Prose quality and process',
};

export function renderPolicyDoc(profile: RatingProfile): string {
  const out: string[] = [];
  out.push('# Content policy', '',
    '<!-- Generated from src/content/policy by src/gen/incident/gates/policy-corpus.test.ts. Do not edit by hand: change the controls and re-render with `npx vitest run src/gen/incident/gates/policy-corpus.test.ts -u`. -->', '',
    'The store rules and the owner\'s standards, written once as numbered controls that every surface reads: the string gates, the generators\' tests, the rating answers, the editorial pass, the settings screens and these docs. A control says what the content must do, why, where it applies, how it is held, and what an editor does about it. A control no check holds is listed as a gap with a backlog id.', '',
    'Nothing here is legal advice. The store pages were read through a summarising fetch on the dates below, so open the URL before relying on exact wording.', '',
    '## Sources', '', '| Id | Source | Read | What it says |', '| --- | --- | --- | --- |');
  for (const s of POLICY_SOURCES as readonly PolicySource[]) out.push(`| ${s.id} | ${s.url ? `[${s.ref}](${s.url})` : s.ref} | ${s.readOn}, ${s.read} | ${s.gist} |`);
  out.push('', '## Controls', '');
  const families = [...new Set(CONTROLS.map((c) => c.family))];
  for (const family of families) {
    out.push(`### ${FAMILY_TITLES[family]}`, '', '| Control | Rule | Severity | Held by | Sources |', '| --- | --- | --- | --- | --- |');
    for (const c of CONTROLS.filter((x) => x.family === family)) {
      const held = c.enforcedBy.map((e) => e.kind === 'text' ? `text check ${e.check}` : e.kind === 'gap' ? `GAP, backlog \`${e.backlog}\`` : `${e.kind}, \`${e.ref}\``).join('; ');
      out.push(`| **${c.id}** ${c.title} | ${c.rule} | ${c.severity} | ${held} | ${c.sources.join(', ')} |`);
    }
    out.push('');
  }
  const open = gaps();
  out.push('## Gaps', '');
  out.push(...(open.length ? open.map(({ control, gap }) => `- **${control.id}** ${control.title}: ${gap.note} (backlog \`${gap.backlog}\`).`) : ['None.']), '');
  out.push('## Rating profile', '',
    `A working classification computed from the ${profile.situations} situations the game ships. A player's filters are not an input. "Frequent" means at least ${Math.round(FREQUENT_SHARE * 100)}% of situations can show the theme: the developer's working reading of a word Apple does not define, not an owner decision, and not a measure of how often a player meets it. The questionnaire itself is answered by a person (backlog \`policy-rating-evidence\`).`, '',
    '| Descriptor | Share of situations |', '| --- | --- |');
  for (const [descriptor, share] of Object.entries(profile.shares)) out.push(`| ${descriptor} | ${Math.round(share * 100)}% |`);
  const a = profile.apple;
  out.push('', '| Apple question | Answer |', '| --- | --- |',
    `| Realistic violence | ${a.realisticViolence} |`, `| Prolonged graphic or sadistic violence | ${a.prolongedGraphicViolence} |`, `| Guns or other weapons | ${a.weapons} |`,
    `| Mature or suggestive themes | ${a.matureThemes} |`, `| Horror or fear themes | ${a.horrorFear} |`, `| Strong language | ${a.strongLanguage} |`, `| Implied minimum age | ${a.impliedMinimumAge}+ |`, '',
    'Still answered by a person:', '', ...profile.openQuestions.map((q) => `- ${q}`), '',
    '### Review notes, generated', '', ...reviewNotes(profile).map((n) => `- ${n}`), '');
  return out.join('\n');
}
