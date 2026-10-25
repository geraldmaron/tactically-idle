import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import type { ChatLine, ThreatChat } from '../../../content/call-trees/types';
import { blocking, checkText, ratingProfile, scenarioFindings, surfaceOfPath, type PolicyFinding, type SituationFacts } from '../../../content/policy';
import { renderPolicyDoc } from '../../../content/policy/render';
import { generateIncident } from '../index';
import { bindRoleTokens } from '../trees-v13/compile';
import { callStringRows, longestNamesCast } from '../trees-v13/strings';
import { specForSituation, VARIANTS } from './catalog';
import { derivedDescriptors, type Situation } from './content-descriptors';

// The content policy as a gate over what ships (docs/content-policy.md). Two readings of every call:
// the checker's own rows plus the chat pools, and the finished scenario a player would be handed, walked
// field by field so engine-written lines, clock cues and reaction pools are read too. The store rating
// profile is pinned, so a change to what the calls can show cannot pass without the questionnaire being
// re-read (control G6).

const templates = (Object.values(INCIDENT_TEMPLATES) as (IncidentTemplate | undefined)[]).filter((t): t is IncidentTemplate => !!t);

interface Located { where: string; text: string; finding: PolicyFinding; situation?: string }

function authoredFindings(template: IncidentTemplate): Located[] {
  const { cast, groups, rooms, place, counts, clockNexts } = longestNamesCast(template);
  const bind = (text: string) => bindRoleTokens(text, cast, place, rooms, groups);
  const rows = callStringRows(template.tree, bind, Object.keys(counts).length ? counts : undefined, clockNexts);
  const found: Located[] = [];
  for (const row of rows) for (const finding of checkText(row.text, surfaceOfPath(row.where), { speech: row.surface.startsWith('exchange') })) found.push({ where: `${template.type}/${row.where}`, text: row.text, finding, situation: row.situation });
  // Viewer chat is not a row in the checker's file; read it here.
  const lines = (chat: ThreatChat | false | undefined): string[] => !chat ? [] : [...chat.early, ...chat.closing, ...chat.imminent].map((line: ChatLine) => typeof line === 'string' ? line : line.text);
  for (const node of template.tree.nodes) for (const line of lines(node.threat?.chat)) {
    for (const finding of checkText(bind(line), 'chat')) found.push({ where: `${template.type}/${node.id}.chat`, text: line, finding });
  }
  return found;
}

/** Finished scenarios: every variant of every template, on its first building family and two seeds. */
function generatedFindings(template: IncidentTemplate): Located[] {
  const familyId = template.tree.families[0];
  const found: Located[] = [];
  for (const variant of VARIANTS) for (const buildingSeed of [7, 11]) {
    let scenario;
    try { scenario = generateIncident(specForSituation(template.type, familyId, variant, buildingSeed)); } catch { continue; }
    for (const hit of scenarioFindings(scenario)) found.push({ where: `${template.type}/v${variant}/${buildingSeed}/${hit.where}`, text: hit.text, finding: hit });
  }
  return found;
}

const show = ({ where, finding, text }: Located) => `${where} ${finding.control} "${finding.match}" in "${text.slice(0, 80)}"`;

describe('content policy over the shipped calls', () => {
  it('no blocking control fires on any authored string, chat line or finished scenario', () => {
    const blocks = templates.flatMap((t) => [...authoredFindings(t), ...generatedFindings(t)]).filter(({ finding }) => blocking([finding]).length);
    expect(blocks.map(show)).toEqual([]);
  });

  it('no fix-level control fires either', () => {
    const fixes = templates.flatMap((t) => [...authoredFindings(t), ...generatedFindings(t)]).filter(({ finding }) => finding.severity === 'fix');
    expect(fixes.map(show)).toEqual([]);
  });

  it('the guard reaches text the checker rows leave out', () => {
    // Pressure-source chat and engine-written consequences are only in the finished scenario.
    const reached = templates.flatMap(generatedFindings);
    expect(Array.isArray(reached)).toBe(true);
    const scenario = generateIncident(specForSituation(templates[0].type, templates[0].tree.families[0], 0));
    expect(scenarioFindings({ ...scenario, injected: { reactions: { spike: ['Blood on the tile.'] } } }).map((f) => f.control)).toContain('V1');
  });

  it('pins the rating profile and renders docs/content-policy.md (control G6)', async () => {
    const situations: SituationFacts[] = templates.flatMap((template) => template.tree.situations.map((situation, index) => ({
      call: template.type, situation: index,
      descriptors: [...new Set([...derivedDescriptors(template, index as Situation), ...(situation.descriptors ?? [])])],
    })));
    // The share of situations whose text carries strong language (control L1): a row tagged 'all' counts for every situation.
    const withLanguage = templates.flatMap((template) => {
      const hits = authoredFindings(template).filter(({ finding }) => finding.control === 'L1');
      return template.tree.situations.map((_, index) => hits.some(({ situation }) => situation === 'all' || situation === `s${index + 1}` || situation === undefined) ? 1 : 0);
    });
    const languageShare = withLanguage.length ? withLanguage.reduce((a: number, b: number) => a + b, 0) / withLanguage.length : 0;
    const profile = ratingProfile(situations, languageShare);
    expect(profile.apple.prolongedGraphicViolence).toBe('none');
    await expect(renderPolicyDoc(profile)).toMatchFileSnapshot('../../../../docs/content-policy.md');
  });
});
