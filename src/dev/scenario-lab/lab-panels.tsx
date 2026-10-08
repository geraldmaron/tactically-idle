// Scenario Lab panels for one incident instance: who is in it (truth beside what the team knows),
// where they are on the building, and the real choice cards at any decision.
import { useMemo } from 'react';
import type { CallTree } from '../../content/call-trees/types';
import { WIRED } from '../../content/incidents/types';
import { METERS_V1 } from '../../sim/meters';
import type { IncidentPerson } from '../../content/incidents/types';
import { aggregates, signature } from '../../gen/incident/instance';
import type { IncidentInstance } from '../../gen/incident/instance';
import { spaceViewsForScenario } from '../../sim/operation-selectors';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation } from '../../sim/types';
import { Blueprint } from '../../ui/blueprint/Blueprint';
import { cascadeChance, incomingFireOdds } from '../../sim/drawn-effects';
import { nodeEntry } from './model';
import type { Kit } from './model';
import { OptionCard } from './parts';

const STATUS_CLASS: Record<string, string> = { confirmed: 'ok', reported: 'mid', assumed: 'mid', unknown: 'bad' };

function where(person: IncidentPerson, built: BuiltLocation): string {
  const p = person.position;
  if (p.kind === 'offsite') return `offsite: ${p.where}`;
  const room = built.location.rooms.find(entry => entry.id === p.spaceId)?.label ?? p.spaceId;
  return p.kind === 'outside' ? `outside (${room})` : `${room} · ${p.placement}${p.floor ? ` · floor ${p.floor}` : ''}`;
}

export function InstancePanel({ instance, built, bind, s }: { instance: IncidentInstance; built: BuiltLocation; bind: (text: string) => string; s: ScenarioDefinition }) {
  const a = aggregates(instance);
  const safeBind = (text: string) => { try { return bind(text); } catch { return text; } };
  return (
    <section className="sl-panel">
      <div className="sl-panel-head">
        <h2>Instance</h2>
        <span className="sl-dim">{a.incidentClass} incident · {a.scaleClass} · situation s{instance.situation + 1} · {instance.pacing === 'deliberate_answers' ? 'slow to answer' : 'ordinary pacing'} · turns {Object.values(instance.turns).join(', ') || 'none'}</span>
      </div>
      <p className="sl-mono">{signature(instance)}</p>
      <h3>People</h3>
      <div className="sl-scroll">
        <table className="sl-table">
          <thead><tr><th>Person</th><th>Kind</th><th>Where</th><th>Group</th><th>Hold</th><th>Threat</th><th>Weapons</th><th>Traits</th><th>Demands</th><th>Team knows</th></tr></thead>
          <tbody>
            {instance.people.map(person => (
              <tr key={person.id}>
                <td><strong>{person.name ? `${person.name.first} ${person.name.surname}` : safeBind(person.label)}</strong><br />
                  <span className="sl-dim">{person.countedRole ? `{${person.countedRole}} ${person.roleKey}` : person.roleKey ? `{${person.roleKey}}` : person.slot} · {person.pronouns} · {person.age}{person.years !== undefined ? ` ${person.years}` : ''}{person.mobility !== 'normal' ? ` · ${person.mobility}` : ''}{person.needs.length ? ` · needs ${person.needs.join(', ')}` : ''}</span></td>
                <td>{person.kind}{person.activity ? <><br /><span className="sl-dim">{person.activity}</span></> : null}{person.subjectAware !== undefined ? <><br /><span className="sl-dim">{person.subjectAware ? 'subject knows' : 'subject unaware'}</span></> : null}</td>
                <td>{where(person, built)}</td>
                <td>{person.group ? <>{person.group.role}{person.group.role === 'follower' || person.group.role === 'lookout' ? <><br /><span className="sl-dim" title="How strongly the leader holds them (CASCADE_V1)">held {person.group.influence}</span></> : null}</> : <span className="sl-dim">none</span>}</td>
                <td>{person.hold ? `${person.hold.kind}, ${person.hold.restraint}, by ${person.hold.by} (${person.hold.relationship})` : person.relationshipToSubject ? <span className="sl-dim">{person.relationshipToSubject}</span> : ''}</td>
                <td>{person.threat ? `${person.threat.armament} ${person.threat.readiness}, ${person.threat.disposition}, ${person.threat.intent}, ${person.threat.awareness}` : ''}</td>
                <td>{person.weapons.map(weapon => `${weapon.kind} (${weapon.real}, ${weapon.where}${weapon.visible ? '' : ', unseen'})`).join('; ')}</td>
                <td className="sl-dim">{[person.volatility, person.proficiency, person.record ? `record: warrant ${person.record.warrant}, prior violence ${person.record.priorViolence}${person.record.protectiveOrder ? ', protective order' : ''}` : '', ...person.sightlines.map(line => `sees ${line.to}: ${line.clear ? 'yes' : 'no'}`)].filter(Boolean).join(' · ')}</td>
                <td>{person.demands.map((demand, i) => <div key={i}>{safeBind(demand.text)} <span className="sl-dim">({demand.kind}{demand.concedable ? ', concedable' : ', never'})</span></div>)}</td>
                <td>{Object.entries(person.knowledge).map(([key, belief]) => <span key={key} className={`sl-chip ${STATUS_CLASS[belief!.status]}`} title={`${belief!.source}${belief!.learnedBy ? `; learned by ${belief!.learnedBy}` : ''}`}>{key}: {belief!.status}{belief!.value ? ` (${safeBind(belief!.value)})` : ''}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>What the engine reads (sim/incident-factors.ts)</h3>
      {s.incidentPeople?.length ? (
        <div className="sl-scroll">
          <table className="sl-table">
            <thead><tr><th>Person</th><th>Threat</th><th>Weapon known by</th><th>Temper known by</th><th>Cover from the door</th><th>Fire and force (truth)</th><th>Meters</th><th>Group and hold</th></tr></thead>
            <tbody>{s.incidentPeople.map(person => (
              <tr key={person.id}>
                <td>{person.label} <span className="sl-dim">{person.kind}{person.minor ? ', minor' : ''} · {person.id}</span></td>
                <td>{person.threat ? `${person.threat.armament} ${person.threat.readiness}, ${person.threat.disposition}, ${person.threat.intent}` : <span className="sl-dim">none</span>}</td>
                <td className="sl-mono">{person.armamentFactId ?? '—'}</td>
                <td className="sl-mono">{person.dispositionFactId ?? '—'}</td>
                <td>{person.cover ? `${person.cover.label} (${person.cover.grade})` : <span className="sl-dim">open</span>}</td>
                <td>{person.weapon ? `${person.weapon.kind} (${person.weapon.real}), ${person.proficiency ?? 'some'} hand` : ''}{person.doorFt !== undefined ? `, ${person.doorFt} ft from the door` : ''}{person.weapon ? `, hits ${Math.round(incomingFireOdds(person).hit * 100)}% of volleys` : ''}{person.noFatal ? <span className="sl-chip warn">never killed</span> : null}</td>
                <td>{person.meters ? `agitation ${person.meters.agitation}, rapport ${person.meters.rapport}, ${person.volatility ?? 'shifting'} (events ×${METERS_V1.volatility[person.volatility ?? 'shifting']})` : <span className="sl-dim">none</span>}</td>
                <td>{person.group ? `${person.group.role} in ${person.group.id}` : ''}{person.group && person.group.role !== 'leader' && person.group.role !== 'lone'
                  ? `, held ${person.group.influence}, follows a surrender ${Math.round(cascadeChance(person) * 100)}% at the start` : ''}
                  {person.hold ? <span className="sl-dim">{person.group ? ' · ' : ''}{person.hold.kind} hold by {person.hold.by}</span> : null}
                  {!person.group && !person.hold ? <span className="sl-dim">none</span> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="sl-dim">Nobody inside carries a threat the engine reads (an offsite subject is not on the map).</p>}
      <div className="sl-cols">
        <div>
          <h3>Aggregates</h3>
          <p>{a.subjects} subject{a.subjects === 1 ? '' : 's'}, {a.armed} armed, {a.hostile} hostile · {a.hostages} hostage{a.hostages === 1 ? '' : 's'}, {a.victims} victim{a.victims === 1 ? '' : 's'}, {a.trapped} trapped · {a.minors} minor{a.minors === 1 ? '' : 's'}, {a.animals} animal{a.animals === 1 ? '' : 's'} · {a.unidentified} unidentified · {a.unknowns} unknown beliefs</p>
          <p className="sl-dim">Weapons: {Object.entries(a.weapons).map(([kind, n]) => `${n} ${kind}`).join(', ') || 'none'} · leader {a.leader ?? 'none'} · most dangerous {a.mostDangerous ?? 'none'}</p>
          <h3>Conditions</h3>
          <p>{instance.conditions.timeOfDay}, power {instance.conditions.power}, {instance.conditions.weather}, crowd {instance.conditions.crowd}</p>
        </div>
        <div>
          <h3>Clocks</h3>
          {instance.clocks.length ? <ul>{instance.clocks.map(clock => {
            const minutes = (at: number) => clock.ratePerMin > 0 ? Math.round((clock.start - at) / clock.ratePerMin) : null;
            const empty = minutes(0);
            return <li key={clock.id}><strong>{safeBind(clock.label)}</strong> ({clock.kind}) starts {clock.start}, −{clock.ratePerMin}/min drawn{clock.rateSpread ? ` (±${Math.round(clock.rateSpread * 100)}%)` : ''}{clock.rateKnown ? '' : ', rate hidden'}
              {clock.story ? <span className="sl-chip bad" title="The tree's own outcomes run this clock; the engine leaves it alone">story-run</span> : <span className="sl-chip ok">{empty !== null && empty <= 240 ? `out at ${empty} min` : 'outlasts the call'}</span>}
              {clock.factKey ? ` · answers f_${clock.factKey}` : ''}
              {clock.cues.map((cue, i) => <div key={i} className="sl-dim">at {cue.at}{minutes(cue.at) !== null && (minutes(cue.at) ?? 0) <= 240 ? ` (${minutes(cue.at)} min)` : ''}: {safeBind(cue.text)}{cue.mark ? ` · sets ${cue.mark}` : ''}{cue.reveal ? ' · settles the fact' : ''}</div>)}</li>;
          })}</ul> : <p className="sl-dim">None.</p>}
          <h3>Read by the engine today</h3>
          <p>{Object.entries(WIRED).map(([field, wired]) => <span key={field} className={`sl-chip ${wired ? 'ok' : 'bad'}`}>{field}</span>)}</p>
          <p className="sl-dim">Red fields are modelled here and wired into the odds in milestone 2 (docs/incident-domain-model.md).</p>
        </div>
      </div>
    </section>
  );
}

export function MapPanel({ s, id, built, instance }: { s: ScenarioDefinition; id: string; built: BuiltLocation; instance: IncidentInstance }) {
  const spaces = useMemo(() => spaceViewsForScenario(id), [id]);
  return (
    <section className="sl-panel">
      <div className="sl-panel-head"><h2>Map</h2><span className="sl-dim">{built.location.name} · {instance.location.familyId} seed {instance.location.seed} · scene: {instance.location.sceneRoomType}</span></div>
      <div className="sl-map">
        <Blueprint built={built} spaces={spaces} squadTasks={[]} selectedSpaceId={null} focusSquadId={null} environment={s.environment} />
        <ul className="sl-legend">
          {instance.people.map(person => <li key={person.id}><strong>{person.name?.first ?? person.label}</strong> <span className="sl-dim">{person.kind}</span> · {where(person, built)}</li>)}
        </ul>
      </div>
    </section>
  );
}

export function ChoicesPanel({ s, id, kit, tree, nodeId }: { s: ScenarioDefinition; id: string; kit: Kit; tree: CallTree; nodeId: string }) {
  const node = tree.nodes.find(entry => entry.id === nodeId) ?? tree.nodes[0];
  const entry = useMemo(() => { try { return nodeEntry(id, kit, node.id, tree.root); } catch { return null; } }, [id, kit, node.id, tree.root]);
  const prefix = `t13_${tree.type}_${node.id}_`;
  const actions = s.stages[node.stage].actions.filter(action => action.id.startsWith(prefix));
  return (
    <section className="sl-panel">
      <div className="sl-panel-head"><h2>Choices at {node.id}</h2><span className="sl-dim">{entry ? `engine state reached in ${entry.path.length} step${entry.path.length === 1 ? '' : 's'} with squad A (${kit === 'day1' ? 'day-one kit' : 'every item'})` : 'not reached in this call (another turn draw, or beyond the walk cap): authored cards only'}</span></div>
      {actions.length === 0 && <p className="sl-dim">This node is not in this call: its turn group drew another node, or its choices need a mark this call can never set.</p>}
      <div className="sl-options">
        {actions.map(action => {
          const view = entry?.views.find(v => v.id === action.id);
          return <OptionCard key={action.id} action={action} view={view} s={s} status={view ? (view.eligible ? 'eligible' : 'blocked') : entry ? 'hidden' : 'unevaluated'} />;
        })}
      </div>
    </section>
  );
}
