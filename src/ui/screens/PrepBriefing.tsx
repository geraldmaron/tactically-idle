// The prepare screen's briefing (moved from OpsPrepare), rendered from props alone so the Scenario
// Lab shows the player's real briefing. Only what the player is told at dispatch: intel.ts never
// reads truth. Store-free.
import type { JSX } from 'react';
import type { Briefing } from '../../sim/operation-selectors';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, KnowledgeStatus } from '../../sim/types';
import { Card, Chip, Section } from '../components/ui';
import { DifficultyChip, EnvChips } from '../components/incident';
import { personInitials } from '../components/IncidentPeople';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { PeopleGlyph, PeopleText, usePeopleEntry } from '../people/PeopleText';
import { peopleLabel } from '../people/lexicon';
import { IncidentBriefContext } from './SupportContext';
import type { Intel, IntelLine } from './intel';

/** `built` is the call's building as the player sees it; the briefing reads it through `intel`. */
export function PrepBriefing({ scenario, brief, intel }: { scenario: ScenarioDefinition | null | undefined; built: BuiltLocation; brief: Briefing; intel: Intel }): JSX.Element {
  const knownRest = brief.known.filter((k) => !intel.covered.has(k));
  // A person report is the person's location fact; the story binding says whose.
  const personOf = new Map(Object.values(scenario?.story?.bindings.people ?? {}).map((person) => [person.locationFactId, person.id]));
  return (
    <Section title="Briefing" icon="intel">
      <Card className="prep-brief">
        <ul className="prep-brief-stats" aria-label="Briefing at a glance">
          <li data-tone="mint"><Icon name="check" size={16} /><strong>{knownRest.length}</strong><span>Known</span></li>
          <li data-tone="amber"><Icon name="question" size={16} /><strong>{brief.unknown.length}</strong><span>Open</span></li>
          <li data-tone="neutral"><Icon name="people" size={16} /><strong>{intel.people.length}</strong><span>People</span></li>
          <li data-tone={intel.threats.length ? 'warn' : 'neutral'}><Icon name="warning" size={16} /><strong>{intel.threats.length}</strong><span>Threats</span></li>
        </ul>
        {(intel.difficulty || intel.environment) && <div className="prep-brief-chips">
          {intel.difficulty && <div className="chips"><DifficultyChip band={intel.difficulty.band} /></div>}
          {intel.environment && <EnvChips env={intel.environment} />}
        </div>}
        <BriefList icon="flag" tone="neutral" title="Objectives" items={brief.objectives} empty="No objectives listed." />
        {brief.unknown.length > 0 && <BriefList icon="question" tone="amber" title="Open questions" items={brief.unknown} empty="No open questions." />}
        {intel.people.length > 0 && <div className="brief">
          <h3 className="brief-h tone-neutral"><Icon name="people" size={16} />People</h3>
          <ul className="incident-people-list prep-people">
            {intel.people.map((p) => <PrepPerson key={p.id} line={p} personId={personOf.get(p.id) ?? p.id} />)}
          </ul>
        </div>}
        {intel.threats.length > 0 && <div className="brief">
          <h3 className="brief-h tone-warn"><Icon name="warning" size={16} />Threat information</h3>
          <ul className="intel">
            {intel.threats.map((t) => (
              <IntelRow key={t.id} line={t} icon="warning" lead="Armament" />
            ))}
          </ul>
        </div>}
        <details className="prep-brief-more">
          <summary><Icon name="intel" size={14} />Full briefing</summary>
          {scenario && <IncidentBriefContext scenario={scenario} />}
          <BriefList icon="check" tone="mint" title="Known" items={knownRest} empty="Nothing confirmed yet." />
          <div className="brief">
            <h3 className="brief-h tone-neutral">
              <Icon name="people" size={16} />
              People reports
            </h3>
            {intel.people.length === 0 ? (
              <p className="dim">{scenario ? 'No individual person details are listed here. Check the dispatch account.' : 'Nobody reported. Occupancy is unverified.'}</p>
            ) : (
              <ul className="intel">
                {intel.people.map((p) => (
                  <IntelRow key={p.id} line={p} icon="user" />
                ))}
              </ul>
            )}
          </div>
          {intel.threats.length === 0 && <div className="brief">
            <h3 className="brief-h tone-warn">
              <Icon name="warning" size={16} />
              Threat information
            </h3>
            <p className="dim">{scenario ? 'No separate weapon details are listed. Check the dispatch account.' : 'No weapon reported. That does not mean none is present.'}</p>
          </div>}
          {intel.difficulty && (
            <div className="brief">
              <h3 className="brief-h tone-neutral">
                <Icon name="mountain" size={16} />
                Difficulty
              </h3>
              {intel.difficulty.drivers.length > 0 && (
                <ul className="drivers">
                  {intel.difficulty.drivers.slice(0, 3).map((d, i) => (
                    <li key={i}>
                      <Icon name="gauge" size={14} />
                      {d}
                    </li>
                  ))}
                </ul>
              )}
              <p className="dim">Based on what is known. New information can raise or lower it.</p>
            </div>
          )}
        </details>
      </Card>
    </Section>
  );
}

/** One reported person: the tile the live screen uses, with a ring in their kind's color while
 * names are colored. */
function PrepPerson({ line: p, personId }: { line: IntelLine; personId: string }) {
  const c = confidence(p.status);
  const who = usePeopleEntry(personId);
  return <li className="person-tile" data-tone={p.status === 'confirmed' ? 'ok' : p.status === 'disproved' ? 'danger' : 'pending'}>
    <span className="person-avatar" aria-hidden="true" data-kind={who?.kind} title={who ? peopleLabel(who.kind, who.squad) : undefined}>{personInitials(p.label)}</span>
    <div className="person-text">
      <strong>{who && <PeopleGlyph kind={who.kind} tone />}{p.label}</strong>
      <span className="person-status"><Icon name={c.icon} size={13} />{c.label}{p.where ? ` · ${p.where}` : ''}</span>
    </div>
  </li>;
}

function confidence(status: KnowledgeStatus): { label: string; tone: 'mint' | 'amber' | 'danger'; icon: IconName } {
  if (status === 'confirmed') return { label: 'Confirmed', tone: 'mint', icon: 'check' };
  if (status === 'disproved') return { label: 'Ruled out', tone: 'danger', icon: 'x' };
  return { label: 'Unverified', tone: 'amber', icon: 'question' };
}

function IntelRow({ line, icon, lead }: { line: IntelLine; icon: IconName; lead?: string }) {
  const c = confidence(line.status);
  return (
    <li className="intelrow">
      <div className="intelrow-top">
        <Icon name={icon} size={16} />
        <strong>{line.label}</strong>
        {line.where && <span className="dim">{line.where}</span>}
      </div>
      <p className="intelrow-claim">{lead ? `${lead}: ` : ''}<PeopleText text={line.claim} /></p>
      <div className="chips">
        <Chip tone={c.tone} icon={c.icon}>
          {c.label}
        </Chip>
        {line.source && (
          <Chip icon="chat" title="Who reported it">
            {line.source}
          </Chip>
        )}
      </div>
    </li>
  );
}

function BriefList({ icon, tone, title, items, empty }: { icon: 'check' | 'question' | 'flag'; tone: 'mint' | 'amber' | 'neutral'; title: string; items: string[]; empty: string }) {
  return (
    <div className="brief">
      <h3 className={`brief-h tone-${tone}`}>
        <Icon name={icon} size={16} />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="dim">{empty}</p>
      ) : (
        <ul>
          {items.map((t, i) => (
            <li key={i}><PeopleText text={t} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
