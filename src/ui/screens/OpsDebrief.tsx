import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useGame } from '../store';
import { decisionViews, pendingDebrief, builtForScenario } from '../../sim/operation-selectors';
import type { DebriefResult, DecisionView, KnowledgeStatus } from '../../sim/types';
import type { PersonDefinition } from '../../sim/scenario-types';
import { getScenario } from '../../sim/scenario-registry';
import { spaceName } from '../../sim/resolution';
import { floorSuffix } from '../blueprint/floors';
import { armamentLabel } from '../components/incident';
import { BeforeAfter, Button, Card, Chip, SubHead } from '../components/ui';
import { DebriefConsequences, DebriefSummary, OfficerResults, type DebriefOfficers } from '../components/DebriefResults';
import { useToast } from '../components/toast';
import { ITEMS } from '../../content/items';
import { Icon, itemIcon } from '../icons';
import type { IconName } from '../icons';
import { signed } from '../format';
import { OperationLogContents } from './OperationFeedback';
import { Sheet } from '../components/Sheet';
import { PersonCasualtyList } from '../components/IncidentPeople';

/** A saved debrief is self-contained; it never borrows history from a newer active run. */
export function SavedDebriefContents({ debrief: d, officers }: { debrief: DebriefResult; officers: DebriefOfficers }) {
  return <div className="saved-debrief-content">
    <DebriefSummary debrief={d} />
    <PersonCasualtyList casualties={(d.personCasualties ?? []).filter((person) => !(d.civilianOutcomes ?? []).some((civilian) => civilian.id === person.personId))} />
    {d.endingSummary && <p className="debrief-narrative">{d.endingSummary}</p>}
    <DebriefConsequences debrief={d} />
    <OfficerResults debrief={d} officers={officers} />
    <DebriefEvidence debrief={d} decisions={d.decisions ?? []} officers={officers} />
  </div>;
}

export function SavedDebriefReview({ debrief, officers, onClose }: { debrief: DebriefResult | null; officers: DebriefOfficers; onClose: () => void }) {
  return <Sheet open={!!debrief} onClose={onClose} title={debrief?.endingTitle ?? 'Saved result'} className="operation-log-sheet" footer={<Button block onClick={onClose}>Return to HQ</Button>}>
    {debrief && <SavedDebriefContents debrief={debrief} officers={officers} />}
  </Sheet>;
}

export function OpsDebrief() {
  const g = useGame();
  const { act } = useToast();
  const d = pendingDebrief(g);
  const close = () => act({ type: 'closeDebrief' });
  if (!d) return <div className="page"><Card>
    <h2 className="section-title">Debrief</h2>
    <p className="dim">The operation is over. The debrief is not available yet.</p>
    <Button variant="primary" block onClick={close}>Close</Button>
  </Card></div>;
  const decisions = d.decisions ?? decisionViews(g);
  return <div className="debrief-layout"><div className="page debrief">
    <div className="debrief-hero">
      <span className="kicker">{d.practice ? 'PRACTICE DEBRIEF' : 'DEBRIEF'}</span>
      <h2 className="debrief-title">{d.endingTitle}</h2>
    </div>
    <DebriefSummary debrief={d} />
    <PersonCasualtyList casualties={(d.personCasualties ?? []).filter((person) => !(d.civilianOutcomes ?? []).some((civilian) => civilian.id === person.personId))} />
    {d.endingSummary && <p className="debrief-narrative">{d.endingSummary}</p>}
    <DebriefConsequences debrief={d} decisions={decisions} />
    <OfficerResults debrief={d} officers={g.officers} />
    <DebriefEvidence debrief={d} decisions={decisions} officers={g.officers} />
  </div><div className="debrief-footer"><Button variant="primary" block onClick={close}>Close debrief</Button></div></div>;
}

function DebriefEvidence({ debrief: d, decisions, officers }: { debrief: DebriefResult; decisions: DecisionView[]; officers: DebriefOfficers }) {
  const used = d.resources.filter((row) => row.itemId !== 'battery_pack').reduce((total, row) => total + row.used, 0);
  const worn = (d.unitWear ?? []).filter((row) => row.itemId !== 'battery_pack' && row.after < row.before).length;
  return <Card className="result-evidence">
    <SubHead icon="list">Review the operation</SubHead>
    {d.causes.length > 0 && <details className="result-disclosure"><summary>Why this outcome · {d.causes.length} reasons</summary><ol className="causes">{d.causes.map((cause, index) => <li key={index}>{cause}</li>)}</ol></details>}
    <details className="result-disclosure"><summary>Decision log{decisions.length > 0 ? ` (${decisions.length})` : ''}</summary>
      {decisions.length ? <OperationLogContents decisions={decisions} practice={d.practice} officers={officers} explicitCompletion={!!d.disposition} /> : <p className="operation-note">No per-decision log is stored for this operation. The saved result and causes are shown above.</p>}
    </details>
    <details className="result-disclosure"><summary>Information &amp; reality</summary><Information d={d} /><Reality d={d} /></details>
    {!d.practice && <details className="result-disclosure"><summary>Supplies &amp; equipment{used > 0 || worn > 0 ? ` · ${used} used · ${worn} worn` : ' · unchanged'}</summary><Supplies d={d} /></details>}
  </Card>;
}

function Row({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return <section className="drow"><h3 className="drow-h"><Icon name={icon} size={18} />{title}</h3><div className="drow-body">{children}</div></section>;
}

function Information({ d }: { d: DebriefResult }) {
  return <Row icon="intel" title="Information preserved">
    {d.informationPreserved.length === 0 ? <span className="dim">Nothing recorded.</span> : <ul className="offrows">{d.informationPreserved.map((f) => <li key={f.factId}>
      <strong>{f.label}</strong><span>{f.status === 'confirmed' ? <Chip tone="mint" icon="check">Confirmed</Chip> : f.status === 'disproved' ? <Chip tone="danger" icon="x">Disproved</Chip> : <Chip tone="amber" icon="question">{f.status === 'reported' ? 'Reported' : 'Unknown'}</Chip>}</span>
    </li>)}</ul>}
  </Row>;
}

function Supplies({ d }: { d: DebriefResult }) {
  const resources = d.resources.filter((row) => row.itemId !== 'battery_pack');
  const wear = (d.unitWear ?? []).filter((row) => row.itemId !== 'battery_pack');
  return <div className="drows">
    <Row icon="box" title="Resources">
      {resources.length === 0 ? <span className="dim">No equipment was carried.</span> : <ul className="offrows">{resources.map((r) => <li key={r.itemId}>
        <strong><Icon name={itemIcon(r.itemId)} size={15} />{ITEMS[r.itemId]?.name ?? r.itemId}</strong><span>Used {r.used} · returned {r.returned}</span>
      </li>)}</ul>}
    </Row>
    <Row icon="wrench" title="Equipment wear">
      {wear.length === 0 ? <span className="dim">No equipment wore down on this run.</span> : <ul className="wearrows">{wear.map((w) => {
        const delta = w.after - w.before;
        return <li key={w.unitId}>
          <span className="wear-id"><Icon name={itemIcon(w.itemId)} size={15} /><strong>{w.serial}</strong><span className="dim">{ITEMS[w.itemId]?.name ?? w.itemId}</span></span>
          <span className="wear-nums">{Math.round(w.before)}% <Icon name="arrowRight" size={12} /> {Math.round(w.after)}% {delta !== 0 && <b className={delta < 0 ? 'tone-warn' : 'tone-mint'}>({signed(delta, 1)})</b>}</span>
          <BeforeAfter before={w.before} after={w.after} />
        </li>;
      })}</ul>}
    </Row>
  </div>;
}

// ---------------------------------------------------------------- what was really there

const ROLE_WORD: Record<PersonDefinition['role'], string> = {
  subject: 'Subject',
  resident: 'Resident',
  child: 'Child',
  elderly: 'Elderly resident',
  staff: 'Staff member',
  customer: 'Customer',
  held_person: 'Held person',
  patient: 'Patient',
  dog: 'Dog',
  dangerous_dog: 'Aggressive dog',
};
const ROLE_ICON: Record<PersonDefinition['role'], IconName> = {
  subject: 'user',
  resident: 'house',
  child: 'child',
  elderly: 'user',
  staff: 'desk',
  customer: 'people',
  held_person: 'lock',
  patient: 'medic',
  dog: 'paw',
  dangerous_dog: 'paw',
};
const DISPOSITION_WORD: Record<string, string> = {
  cooperative: 'cooperative',
  distressed: 'distressed',
  intoxicated: 'intoxicated',
  agitated: 'agitated',
  hostile: 'hostile',
  in_crisis: 'in crisis',
};

function knew(status: KnowledgeStatus | undefined): { text: string; tone: 'mint' | 'amber' | 'danger' | 'neutral'; icon: IconName } {
  if (status === 'confirmed') return { text: 'You confirmed it', tone: 'mint', icon: 'check' };
  if (status === 'disproved') return { text: 'You ruled it out', tone: 'mint', icon: 'check' };
  if (status === 'reported') return { text: 'Still only a report', tone: 'amber', icon: 'question' };
  return { text: 'Never confirmed', tone: 'neutral', icon: 'question' };
}

/**
 * Debrief only: the report beside what was actually there. This is the one place truth is shown, after
 * the operation, so the player can learn which sources to trust and what to look for next time.
 */
function Reality({ d }: { d: DebriefResult }) {
  const scenario = useMemo(() => getScenario(d.scenarioId), [d.scenarioId]);
  const built = useMemo(() => builtForScenario(d.scenarioId), [d.scenarioId]);
  if (!scenario) return null;
  const status = new Map(d.informationPreserved.map((f) => [f.factId, f.status]));
  const facts = scenario.facts;
  const people = scenario.people ?? [];
  if (facts.length === 0 && people.length === 0) return null;
  return (
    <Card className="reality">
      <SubHead icon="eye">What was really there</SubHead>
      {facts.length > 0 && (
        <ul className="realrows">
          {facts.map((f) => {
            const told = f.initial === 'reported' || f.initial === 'confirmed';
            const note = f.truth ? f.resolved?.confirmed : f.resolved?.disproved;
            const k = knew(status.get(f.id));
            return (
              <li key={f.id} className={`realrow ${f.truth ? 'realrow-ok' : 'realrow-off'}`}>
                <div className="realrow-top">
                  <Icon name={f.truth ? 'checkcircle' : 'xcircle'} size={18} />
                  <strong>{f.label}</strong>
                  <Chip tone={f.truth ? 'mint' : 'amber'}>{f.truth ? 'Report was right' : 'Not as reported'}</Chip>
                </div>
                <p className="realrow-line">
                  <Icon name="chat" size={14} />
                  <span>
                    {told ? 'Told' : 'Not reported'}: {f.claim}
                    {told && f.source ? <span className="dim"> ({f.source})</span> : null}
                  </span>
                </p>
                {note && (
                  <p className="realrow-line">
                    <Icon name="eye" size={14} />
                    <span>{note}</span>
                  </p>
                )}
                <Chip tone={k.tone} icon={k.icon}>
                  {k.text}
                </Chip>
              </li>
            );
          })}
        </ul>
      )}
      {people.length > 0 && (
        <>
          <h4 className="realpeople-h">
            <Icon name="people" size={15} />
            Everyone present
          </h4>
          <ul className="realpeople">
            {people.map((p) => (
              <li key={p.id}>
                <Icon name={ROLE_ICON[p.role]} size={16} />
                <span>
                  <strong>{p.label || ROLE_WORD[p.role]}</strong> <span className="dim">in {spaceName(built, p.spaceId)}{floorSuffix(built.location, p.spaceId)}</span>
                  {p.threat && (
                    <span className="realpeople-threat">
                      {armamentLabel(p.threat.armament)}
                      {p.threat.armament !== 'none' ? `, ${p.threat.readiness}` : ''}; {DISPOSITION_WORD[p.threat.disposition] ?? p.threat.disposition}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
