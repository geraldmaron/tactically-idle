import { useEffect, useRef, useState } from 'react';
import {
  planSquadArrangement,
  squadArrangementState,
  squadArrangementToken,
  undoSquadArrangementCheck,
} from '../../sim/squad-optimizer';
import type { SquadArrangementPreview, SquadOptimizerOptions } from '../../sim/squad-optimizer';
import type { GameState, Id, SquadId } from '../../sim/types';
import { fullName } from '../../sim/officer';
import { squadDeployed } from '../../sim/economy';
import { Sheet } from '../components/Sheet';
import { Button, Chip } from '../components/ui';
import { DUTY_META } from '../components/labels';
import { useToast } from '../components/toast';
import { Portrait } from '../portraits/Portrait';
import { Icon } from '../icons';
import { getCampaignSnapshot, getState, useCampaigns, useGame } from '../store';
import { officerList } from './helpers';
import './squad-optimizer.css';

function squadName(state: GameState, squadId: SquadId | null): string {
  if (!squadId) return 'Unassigned';
  const squad = state.squads.find((entry) => entry.id === squadId);
  return squad ? `${squad.id} · ${squad.name}` : `Squad ${squadId}`;
}

function officerName(state: GameState, officerId: Id | null): string {
  if (!officerId) return 'No leader';
  return state.officers[officerId] ? fullName(state.officers[officerId]) : 'Officer no longer on roster';
}

export function SquadOptimizer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { campaignId, session } = useCampaigns();
  // Save a copy changes campaignId without incrementing session. Either change
  // creates a fresh editor so pending proposals never follow a campaign switch.
  return <SquadOptimizerSession key={`${session}:${campaignId ?? 'unsaved'}`} open={open} onClose={onClose} campaignId={campaignId} session={session} />;
}

function SquadOptimizerSession({ open, onClose, campaignId, session }: { open: boolean; onClose: () => void; campaignId: string | null; session: number }) {
  const state = useGame();
  const { act } = useToast();
  const [options, setOptions] = useState<SquadOptimizerOptions>(() => ({
    squadIds: state.squads.filter((squad) => !squadDeployed(state, squad.id)).map((squad) => squad.id),
    includeUnassigned: false,
    preserveLeaders: true,
  }));
  const [preview, setPreview] = useState<SquadArrangementPreview | null>(null);
  const [message, setMessage] = useState('');
  const reviewRef = useRef<HTMLDivElement>(null);
  const saved = squadArrangementState(state);
  const undoCheck = saved.undo ? undoSquadArrangementCheck(state) : null;
  const stale = !!preview?.proposal && preview.proposal.token !== squadArrangementToken(state);
  const selectedIds = options.squadIds.filter((id) => state.squads.some((squad) => squad.id === id) && !squadDeployed(state, id));

  useEffect(() => {
    if (!open) { setPreview(null); setMessage(''); }
  }, [open]);

  useEffect(() => {
    if (preview) reviewRef.current?.focus();
  }, [preview]);

  const updateOptions = (next: Partial<SquadOptimizerOptions>) => {
    setOptions((previous) => ({ ...previous, ...next }));
    setPreview(null);
    setMessage('');
  };
  const close = () => { setPreview(null); setMessage(''); onClose(); };
  const makePreview = () => {
    const current = getState();
    const squadIds = options.squadIds.filter((id) => current.squads.some((squad) => squad.id === id) && !squadDeployed(current, id));
    setPreview(planSquadArrangement(current, { ...options, squadIds }));
    setMessage('');
  };
  const apply = () => {
    if (!preview?.proposal) return;
    const campaign = getCampaignSnapshot();
    if (campaign.campaignId !== campaignId || campaign.session !== session) {
      setPreview(null);
      setMessage('The active campaign changed. Create a new preview for this campaign.');
      return;
    }
    if (preview.proposal.token !== squadArrangementToken(getState())) {
      setMessage('The roster, readiness or locks changed. Preview again before applying.');
      return;
    }
    const result = act({ type: 'applySquadArrangement', proposal: preview.proposal }, 'Squad arrangement applied');
    if (result.ok) { setPreview(null); setMessage('Arrangement applied. You can undo the last arrangement below.'); }
  };
  const undo = () => {
    const result = act({ type: 'undoSquadArrangement' }, 'Previous squad arrangement restored');
    if (result.ok) { setPreview(null); setMessage('Previous squad rosters and leaders restored.'); }
  };

  return <Sheet open={open} onClose={close} title="Arrange squads" subtitle="Nothing moves until you apply" className="squad-optimizer" footer={
    <div className="arrangement-actions">
      <Button variant="ghost" onClick={close}>Cancel</Button>
      <Button onClick={makePreview} disabled={selectedIds.length === 0}>{preview ? 'Preview again' : 'Preview arrangement'}</Button>
      <Button variant="primary" onClick={apply} disabled={!preview?.proposal || stale}>Apply arrangement</Button>
    </div>
  }>
    <div className="arrangement-intro">
      <p>Balances skills, qualifications and fitness across squads.</p>
      <details className="arrangement-method">
        <summary>How suggestions work</summary>
        <p className="dim">Keeps squad duties and existing headcounts; opted-in unassigned officers can fill vacancies. Injured, training, deployed and recovering officers stay in place, as do entire deployed squads.</p>
        <p className="dim">Looks for useful skills, qualifications and officers fit for duty across your squads. It favors fewer moves when choices are otherwise similar. This is a suggestion; another arrangement may work better.</p>
        <p className="dim">Each skill score shows the strongest available officer after stress is taken into account. A score of 50 or more counts as covered for this suggestion; it does not guarantee a good result. Officers with stress 60 or higher sit out high-risk work.</p>
      </details>
    </div>

    <fieldset className="arrangement-options">
      <legend>Arrangement options</legend>
      <label className="arrangement-check">
        <input type="checkbox" checked={options.includeUnassigned} onChange={(event) => updateOptions({ includeUnassigned: event.target.checked })} />
        <span><strong>Include unassigned officers</strong><small>Fill open places with available officers.</small></span>
      </label>
      <label className="arrangement-check">
        <input type="checkbox" checked={options.preserveLeaders} onChange={(event) => updateOptions({ preserveLeaders: event.target.checked })} />
        <span><strong>Preserve current leaders</strong><small>Leaders keep their squad and role.</small></span>
      </label>
    </fieldset>

    <fieldset className="arrangement-options">
      <legend>Participating squads</legend>
      <p className="dim">A locked squad keeps its roster and leader.</p>
      <div className="arrangement-squad-options">
        {state.squads.map((squad) => {
          const deployed = squadDeployed(state, squad.id);
          const locked = saved.squadLocks.includes(squad.id);
          return <div key={squad.id} className="arrangement-squad-option">
            <label className="arrangement-check">
              <input type="checkbox" aria-label={`Include squad ${squad.id}, ${squad.name}`} checked={selectedIds.includes(squad.id)} disabled={deployed} onChange={(event) => updateOptions({ squadIds: event.target.checked ? [...options.squadIds.filter((id) => id !== squad.id), squad.id] : options.squadIds.filter((id) => id !== squad.id) })} />
              <span><strong>{squadName(state, squad.id)}</strong><FaceStack state={state} ids={squad.officerIds} leaderId={squad.leaderId} /><small>{squad.officerIds.length} officers · {DUTY_META[squad.duty].label}{deployed ? ' · Deployed, stays fixed' : locked ? ' · Locked, stays fixed' : ''}</small></span>
            </label>
            <Button aria-label={`${locked ? 'Unlock' : 'Lock'} squad ${squad.id}, ${squad.name}`} aria-pressed={locked} onClick={() => act({ type: 'setSquadArrangementLock', target: { kind: 'squad', squadId: squad.id }, locked: !locked })}><Icon name={locked ? 'lock' : 'unlock'} size={16} />{locked ? 'Locked' : 'Lock'}</Button>
          </div>;
        })}
      </div>
      {selectedIds.length === 0 && <p className="tone-amber" role="status">Select at least one available squad to preview an arrangement.</p>}
    </fieldset>

    <details className="arrangement-locks">
      <summary>Officer locks <span className="dim">{saved.officerLocks.length} saved</span></summary>
      <p className="dim">Locks are saved with this campaign and stay active when you reopen this sheet. Locked officers keep their current squad or unassigned position and their current leadership status: leaders stay leaders, and other locked officers are not promoted.</p>
      <ul className="arrangement-officer-locks">
        {officerList(state).map((officer) => {
          const locked = saved.officerLocks.includes(officer.id);
          return <li key={officer.id}>
            <Portrait officer={officer} size={34} />
            <span><strong>{fullName(officer)}</strong><small>{squadName(state, officer.squadId)}</small></span>
            <Button aria-label={`${locked ? 'Unlock' : 'Lock'} ${fullName(officer)}`} aria-pressed={locked} onClick={() => act({ type: 'setSquadArrangementLock', target: { kind: 'officer', officerId: officer.id }, locked: !locked })}>{locked ? 'Unlock' : 'Lock'}</Button>
          </li>;
        })}
      </ul>
    </details>

    <section className="arrangement-undo" aria-label="Last arrangement">
      <p className="dim">{saved.undo ? 'Undo restores the previous rosters and leaders while it is still safe.' : 'Applying an arrangement saves an undo point.'}</p>
      <Button disabled={!saved.undo || !undoCheck?.ok} onClick={undo}>Undo last arrangement</Button>
      {saved.undo && undoCheck && !undoCheck.ok && <p className="tone-amber" role="status">{undoCheck.reason}</p>}
    </section>

    {message && <p className="arrangement-message" role="status">{message}</p>}
    {preview && <div ref={reviewRef} tabIndex={-1} className="arrangement-review" aria-label="Arrangement preview">
      <SquadArrangementReview state={state} preview={preview} stale={stale} />
    </div>}
    {!preview && <p className="arrangement-empty dim">Preview shows before and after rosters, readiness, coverage, protected members and the reason for each move. Previewing does not change the roster.</p>}
  </Sheet>;
}

/** Pure presentation of the planner result, also usable without a live game store. */
export function SquadArrangementReview({ state, preview, stale = false }: { state: GameState; preview: SquadArrangementPreview; stale?: boolean }) {
  const leaderChanges = preview.before.flatMap((before) => {
    const after = preview.after.find((entry) => entry.squadId === before.squadId);
    return after && after.leaderId !== before.leaderId ? [{ squadId: before.squadId, before: before.leaderId, after: after.leaderId }] : [];
  });
  return <>
    <div className="arrangement-review-heading"><h3>Arrangement preview</h3><Chip tone={stale ? 'warn' : 'neutral'}>{stale ? 'Needs a new preview' : 'Not applied'}</Chip></div>
    {stale && <p className="arrangement-message tone-amber" role="alert">The roster, readiness or locks changed since this preview. Review a new preview before applying.</p>}
    {preview.reason && <p className="arrangement-message" role="status">{preview.reason}</p>}
    <p className="dim">{preview.moves.length} proposed officer {preview.moves.length === 1 ? 'move' : 'moves'} · {leaderChanges.length} leader {leaderChanges.length === 1 ? 'change' : 'changes'}. Fresh means deployable with stress below 30.</p>
    <div className="arrangement-comparisons">
      {preview.before.map((before) => {
        const after = preview.after.find((entry) => entry.squadId === before.squadId) ?? before;
        const squad = state.squads.find((entry) => entry.id === before.squadId);
        return <section className="arrangement-comparison" key={before.squadId} aria-label={`${squadName(state, before.squadId)} comparison`}>
          <h4>{squadName(state, before.squadId)}</h4>
          {squad && <p className="dim">Duty: {DUTY_META[squad.duty].label} · unchanged</p>}
          <div className="arrangement-before-after">
            <SquadSummary state={state} summary={before} label="Before" />
            <SquadSummary state={state} summary={after} label="After" />
          </div>
        </section>;
      })}
    </div>
    {preview.proposal && <section className="arrangement-unassigned" aria-label="Unassigned officers comparison">
      <h4>Unassigned officers</h4>
      <p><strong>Before ({preview.proposal.before.unassignedIds.length}):</strong> {preview.proposal.before.unassignedIds.map((id) => officerName(state, id)).join(', ') || 'None'}</p>
      <p><strong>After ({preview.proposal.after.unassignedIds.length}):</strong> {preview.proposal.after.unassignedIds.map((id) => officerName(state, id)).join(', ') || 'None'}</p>
    </section>}

    <section className="arrangement-moves" aria-label="Proposed moves">
      <h4>Proposed moves</h4>
      {preview.moves.length === 0 ? <p className="dim">No officer moves are proposed.</p> : <ol>
        {preview.moves.map((move) => <li key={move.officerId}>
          <div className="arrangement-move-head">{state.officers[move.officerId] && <Portrait officer={state.officers[move.officerId]} size={34} />}<span><strong>{officerName(state, move.officerId)}</strong><span className="arrangement-move-path"><b>{move.from ?? <Icon name="user" size={12} />}</b><Icon name="arrowRight" size={13} /><b>{move.to ?? <Icon name="user" size={12} />}</b><span className="sr-only">{squadName(state, move.from)} → {squadName(state, move.to)}</span></span></span></div>
          <ul>{move.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
          <p className={move.dutyImpact ? 'tone-amber' : 'dim'}><strong>Duty impact:</strong> {move.dutyImpact ?? 'No change to this officer’s duty.'}</p>
        </li>)}
      </ol>}
    </section>

    {leaderChanges.length > 0 && <section className="arrangement-moves" aria-label="Proposed leader changes">
      <h4>Proposed leader changes</h4>
      <ul>{leaderChanges.map((change) => <li key={change.squadId}><strong>{squadName(state, change.squadId)}:</strong> {officerName(state, change.before)} → {officerName(state, change.after)}</li>)}</ul>
    </section>}

    <section className="arrangement-protected" aria-label="Protected and excluded officers">
      <h4>Protected and excluded officers</h4>
      {preview.protected.length === 0 ? <p className="dim">No officers are excluded by the current options.</p> : <ul>
        {preview.protected.map((entry, index) => <li key={`${entry.officerId}-${index}`}><strong>{officerName(state, entry.officerId)}</strong><span>{entry.reason}</span></li>)}
      </ul>}
    </section>
  </>;
}

function FaceStack({ state, ids, leaderId }: { state: GameState; ids: Id[]; leaderId: Id | null }) {
  if (!ids.length) return null;
  return <span className="arrangement-faces" aria-hidden="true">{ids.map((id) => state.officers[id] && <span key={id} className={`arrangement-face${id === leaderId ? ' arrangement-face-lead' : ''}`}><Portrait officer={state.officers[id]} size={26} /></span>)}</span>;
}

function SquadSummary({ state, summary, label }: { state: GameState; summary: SquadArrangementPreview['before'][number]; label: string }) {
  return <div className="arrangement-summary">
    <h5>{label}</h5>
    <div className="arrangement-counts">
      <span><b>{summary.officerIds.length}</b> officers</span><span className="tone-mint"><b>{summary.fresh}</b> fresh</span><span><b>{summary.deployable}</b> deployable</span><span className={summary.unavailable ? 'tone-warn' : ''}><b>{summary.unavailable}</b> unavailable</span>
    </div>
    <ul className="arrangement-roster">
      {summary.officerIds.map((id) => {
        const officer = state.officers[id];
        return <li key={id} className={summary.leaderId === id ? 'arrangement-roster-lead' : ''}>{officer && <Portrait officer={officer} size={30} />}<span>{officer ? fullName(officer) : 'Officer no longer on roster'}{summary.leaderId === id && <small><Icon name="star" size={11} /> Leader</small>}</span></li>;
      })}
      {summary.officerIds.length === 0 && <li className="dim">No assigned officers</li>}
    </ul>
    <p className="sr-only"><strong>Leader:</strong> {officerName(state, summary.leaderId)}</p>
    <p className="arrangement-tags"><strong>Coverage:</strong> {summary.coverage.length ? summary.coverage.map((entry) => <span key={entry} className="chip chip-mint">{entry}</span>) : 'None'}</p>
    <p className={`arrangement-tags${summary.gaps.length ? ' tone-amber' : ' dim'}`}><strong>Gaps:</strong> {summary.gaps.length ? summary.gaps.map((entry) => <span key={entry} className="chip chip-warn">{entry}</span>) : 'None identified'}</p>
    <p className="dim"><strong>Mentoring:</strong> {summary.mentoring.join(' · ') || 'No pairing identified'}</p>
  </div>;
}
