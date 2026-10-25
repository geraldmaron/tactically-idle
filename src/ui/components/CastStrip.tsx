// The "People inside" panel on the live screen (docs/cast-strip.md): a few rows for the people who
// matter now, one row per group of everyone else, and a roster sheet where a name can be pinned to
// a row. The rules for who earns a row are in cast.ts; this file draws them.
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { OperationRun } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { PeopleText } from '../people/PeopleText';
import { Face, type FaceKind } from './Face';
import { FactStatusChip } from './FactStatusChip';
import { Section } from './ui';
import { Sheet } from './Sheet';
import { STANCE_LABEL } from './IncidentPeople';
import { buildCast, EVIDENCE_WORD, MAX_ROWS, pinsOf, type CastGroup, type CastMember, type CastProse, type Evidence } from './cast';
import './cast-strip.css';

const EVIDENCE_ICON: Record<Evidence, IconName> = { unlocated: 'search', reported: 'pin', heard: 'ear', seen: 'eye' };
type Tone = 'ok' | 'warn' | 'danger' | 'quiet';
const EVIDENCE_TONE: Record<Evidence, Tone> = { unlocated: 'quiet', reported: 'warn', heard: 'warn', seen: 'ok' };
const STANCE_TONE = { calm: 'ok', yielding: 'ok', tense: 'warn', volatile: 'warn', breaking: 'danger' } as const;

const KIND_WORD = { subject: 'Subject', civilian: 'Civilian' } as const;
const GROUP_KIND_WORD = { subject: 'Subjects', civilian: 'Civilians' } as const;

/** The chip that says how the team knows someone, or how they are: the subject's temper, a person's
 * injury, or the rung of the ladder (reported, heard, seen) with the room the map shows them in. */
function Standing({ member, where }: { member: CastMember; where?: string }) {
  const chip = (tone: Tone, icon: IconName, word: ReactNode, shape?: Evidence) => <span className="cast-chip" data-tone={tone} data-evidence={shape}><Icon name={icon} size={16} />{word}</span>;
  if (member.status === 'deceased') return chip('danger', 'x', 'Deceased');
  if (member.status === 'injured_needs_care') return chip('warn', 'bandage', 'Hurt · needs care');
  if (member.stance) return chip(STANCE_TONE[member.stance], 'warning', STANCE_LABEL[member.stance]);
  return chip(EVIDENCE_TONE[member.evidence], EVIDENCE_ICON[member.evidence], <>{EVIDENCE_WORD[member.evidence]}{member.evidence === 'seen' && where ? ` · ${where}` : ''}</>, member.evidence);
}

const faceKind = (member: CastMember): FaceKind => member.side === 'subject' ? 'subject' : 'civilian';

function CastRow({ member, run, scenario, where, open, onToggle, pinned, onUnpin }: { member: CastMember; run: OperationRun; scenario: ScenarioDefinition; where?: string; open: boolean; onToggle: () => void; pinned: boolean; onUnpin: () => void }) {
  const def = scenario.incidentPeople?.find((person) => person.id === member.id);
  const facts = [...new Set([def?.locationFactId, def?.armamentFactId, def?.dispositionFactId].filter((id): id is string => !!id))]
    .flatMap((id) => { const fact = scenario.facts.find((entry) => entry.id === id); const status = run.knowledge[id] ?? fact?.initial; return fact && (status === 'reported' || status === 'confirmed' || status === 'disproved') ? [{ id, label: fact.label, status }] : []; });
  const first = member.label.split(/\s+/)[0];
  return <li className="cast-row" data-kind={member.side} data-evidence={member.evidence} data-open={open || undefined}>
    <button type="button" className="cast-row-btn" aria-expanded={open} onClick={onToggle} aria-label={`${first}, ${KIND_WORD[member.side].toLowerCase()}${member.role ? `, ${member.role}` : ''}. ${open ? 'Close' : 'Open'} background`}>
      <Face size="md" kind={faceKind(member)} seed={member.id} role={member.role} className="cast-face" />
      <span className="cast-text">
        <span className="cast-top"><b>{first}</b><Standing member={member} where={where} /></span>
        <span className="cast-kind"><span className="cast-kind-word">{KIND_WORD[member.side]}</span>{member.role ? ` · ${member.role}` : ''}</span>
        {member.stake && member.leader && !open && <span className="cast-stake"><PeopleText text={member.stake} /></span>}
      </span>
    </button>
    {open && <div className="cast-more">
      {member.background && <div><h4>Background</h4><p><PeopleText text={member.background} /></p></div>}
      {facts.length > 0 && <div><h4>The team knows</h4><ul className="cast-facts">{facts.map((fact) => <li key={fact.id}><FactStatusChip status={fact.status} label={fact.label} /></li>)}</ul></div>}
      {pinned && <button type="button" className="cast-pin-btn" onClick={onUnpin}><Icon name="x" size={16} />Take off the cast</button>}
    </div>}
  </li>;
}

const SEGMENTS: (Evidence | 'out')[] = ['out', 'seen', 'heard', 'reported', 'unlocated'];
const SEGMENT_WORD: Record<Evidence | 'out', string> = { out: 'out', seen: 'seen', heard: 'heard', reported: 'reported', unlocated: 'not located' };

function GroupRow({ group, onOpen }: { group: CastGroup; onOpen: () => void }) {
  const inside = group.members.length - group.counts.out;
  const faces = group.members.slice(0, 3);
  return <li className="cast-group" data-kind={group.side}>
    <button type="button" className="cast-group-btn" onClick={onOpen} aria-label={`${group.label}, ${inside} inside. Open the roster`}>
      <span className="cast-stack" aria-hidden="true">{faces.map((member) => <Face key={member.id} size="sm" kind={faceKind(member)} seed={member.id} className={`cast-stack-face${member.evidence === 'seen' || member.out ? '' : ' cast-stack-dim'}`} />)}</span>
      <span className="cast-text">
        <span className="cast-top"><b>{group.label} · {inside}</b><Icon name="chevronRight" size={16} className="cast-go" /></span>
        <span className="cast-kind"><span className="cast-kind-word">{GROUP_KIND_WORD[group.side]}</span>{group.follows ? ` · Follow ${group.follows.split(/\s+/)[0]}` : ''}</span>
      </span>
    </button>
    <span className="cast-bar" role="img" aria-label={SEGMENTS.filter((key) => group.counts[key]).map((key) => `${group.counts[key]} ${SEGMENT_WORD[key]}`).join(', ')}>
      {SEGMENTS.map((key) => group.counts[key] > 0 && <i key={key} data-segment={key} style={{ flexGrow: group.counts[key] }} />)}
    </span>
    <span className="cast-legend">{SEGMENTS.filter((key) => group.counts[key]).map((key) => <span key={key} data-segment={key}>{group.counts[key]} {SEGMENT_WORD[key]}</span>)}</span>
  </li>;
}

/** The roster of one group. Names show once the team has seen or heard someone; the rest are counts,
 * so the sheet never says more than the team knows. A tap pins a name to a row of its own. */
function Roster({ group, pins, pinCount, onToggle, onClose }: { group: CastGroup | null; pins: ReadonlySet<string>; pinCount: number; onToggle: (id: string) => void; onClose: () => void }) {
  const named = (evidence: Evidence) => group?.members.filter((member) => !member.out && member.evidence === evidence) ?? [];
  const full = pinCount >= MAX_ROWS;
  const section = (evidence: Evidence, line: string) => {
    const people = named(evidence);
    return people.length > 0 && <div className="roster-section" key={evidence}>
      <div className="roster-head"><span className="cast-chip" data-tone={EVIDENCE_TONE[evidence]} data-evidence={evidence}><Icon name={EVIDENCE_ICON[evidence]} size={16} />{EVIDENCE_WORD[evidence]}</span><span>{people.length} {line}</span></div>
      <div className="roster-chips">{people.map((member) => {
        const on = pins.has(member.id);
        return <button key={member.id} type="button" className="roster-chip" aria-pressed={on} disabled={!on && full} onClick={() => onToggle(member.id)}>{on && <Icon name="check" size={16} />}{member.label.split(/\s+/)[0]}</button>;
      })}</div>
    </div>;
  };
  const unnamed = (group?.counts.reported ?? 0) + (group?.counts.unlocated ?? 0);
  return <Sheet open={!!group} onClose={onClose} title={group ? `${group.label} · ${group.members.length - group.counts.out}` : ''} maxHeight="short">
    {group && <div className="roster">
      <p className="roster-note">Pin a name to give them a row on the cast. {pinCount} of {MAX_ROWS} rows are pinned or earned.{full ? ' Take one off to pin another.' : ''}</p>
      {section('seen', 'in view')}
      {section('heard', 'heard')}
      {unnamed > 0 && <p className="roster-unnamed"><span className="cast-chip" data-tone="warn" data-evidence="reported"><Icon name="pin" size={16} />{unnamed} not yet seen or heard</span>No names until the team has one.</p>}
      {group.counts.out > 0 && <p className="roster-out"><b>{group.counts.out} out</b> of the building</p>}
    </div>}
  </Sheet>;
}

/** `prose` is what the screen is saying right now; a person it names never shows as less than seen or heard. */
export function IncidentPeopleStrip({ scenario, run, whereOf, prose }: { scenario: ScenarioDefinition; run: OperationRun; whereOf?: (personId: string) => string | undefined; prose?: CastProse }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [rosterKey, setRosterKey] = useState<string | null>(null);
  const [, bump] = useState(0);
  const pins = pinsOf(run.id);
  const cast = buildCast(scenario, run, prose, pins);
  if (!cast.all.length) return null;
  const toggle = (id: string) => { if (pins.has(id)) pins.delete(id); else pins.add(id); bump((n) => n + 1); };
  if (!cast.inside) return <p className="scene-people-clear"><Icon name="check" size={16} />{`Everyone named is out (${cast.out}).`}</p>;
  const tally = [`${cast.inside} inside`, cast.out ? `${cast.out} out` : ''].filter(Boolean).join(' · ');
  const roster = cast.groups.find((group) => group.key === rosterKey) ?? null;
  return <Section className="scene-people-panel" title="People inside" icon="people" tone="people" count={tally} well>
    <ul className="cast" aria-label="People at the scene">
      {cast.rows.map((member) => <CastRow key={member.id} member={member} run={run} scenario={scenario} where={whereOf?.(member.id)} open={openId === member.id}
        onToggle={() => setOpenId(openId === member.id ? null : member.id)} pinned={pins.has(member.id)} onUnpin={() => toggle(member.id)} />)}
      {cast.groups.map((group) => <GroupRow key={group.key} group={group} onOpen={() => setRosterKey(group.key)} />)}
    </ul>
    <Roster group={roster} pins={pins} pinCount={cast.rows.length} onToggle={toggle} onClose={() => setRosterKey(null)} />
  </Section>;
}
