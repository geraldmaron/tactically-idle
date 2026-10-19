import { useEffect, useState } from 'react';
import { getState, useGame } from '../store';
import { decisionViews, lastResolution } from '../../sim/operation-selectors';
import type { Id, SquadId } from '../../sim/types';
import { useToast } from '../components/toast';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/ui';
import { OpenInLab } from '../components/OpenInLab';
import { ActionSheet, LiveView, RoomSheet } from './LiveView';
import { OperationFeedback } from './OperationFeedback';
import { sceneFor } from '../art/Plates';
import { SituationPanel } from './SituationPanel';
import { SupportContext } from './SupportContext';
import { IncidentPeopleStatus } from '../components/IncidentPeople';
import { focusActingSquad, toggleActingSquad, toggleSupportingSquad } from './operation-squads';
import { responseFailurePlan } from '../../sim/response-failure';
import { liveScreen, type ActionSelection, type Override } from './live-model';
import { lexiconFor } from '../people/lexicon';
import { runRoster } from '../../sim/squads';

/** After a decision the result sits at the head of the scene: bring the scene back to the top so
 * the player reads what happened before the next choice. */
function revealLastDecision() {
  document.querySelector('.live')?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

export function OpsLive() {
  const g = useGame();
  const now = Date.now();
  const { act } = useToast();
  const run = g.activeRun!;

  const [focusId, setFocusId] = useState<SquadId | null>(() => run.history.at(-1)?.actingSquadIds[0] ?? null);
  const [selection, setSelection] = useState<ActionSelection | null>(null);
  const [activeOfficer, setActiveOfficer] = useState<Id | null>(null);
  const [selSpace, setSelSpace] = useState<Id | null>(null);
  const [panel, setPanel] = useState<'none' | 'action' | 'room' | 'support'>('none');
  const [actionFromSupport, setActionFromSupport] = useState(false);
  const [showRooms, setShowRooms] = useState(false);
  const [override, setOverride] = useState<Override | null>(null);
  const [lastChange, setLastChange] = useState<{ revision: number; spaceIds: Id[] } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmFailure, setConfirmFailure] = useState<{ runId: Id; revision: number } | null>(null);
  const [floor, setFloor] = useState(0);

  // One selector block for the game and the Scenario Lab (live-model.ts).
  const screen = liveScreen(g, now, { focusId, selection, override, floor, activeOfficer, selectedSpaceId: selSpace, lastChange, showRooms, detailsOpen: panel === 'action' });
  const decisions = decisionViews(g);
  const failurePlan = responseFailurePlan(g);
  // Follow the selected action: when its target is on another floor, show that floor.
  const targetFloor = screen?.review.targetFloor ?? null;
  useEffect(() => {
    if (targetFloor !== null) setFloor(targetFloor);
  }, [screen?.review.view?.id, targetFloor]);

  if (!screen) return <div className="page"><p className="dim">Operation location unavailable.</p></div>;
  const { model, review } = screen;
  const { deployed, focus, view, acting, support, actionRule, maxActing, resupply, alternatives, scenario, spaceById, targetLabel, availableMembers, actorUnavailable, floorOf } = review;
  const actions = model.actions;
  const spaces = model.spaces;
  // The deployed officers, by squad, for the names in this call's text.
  const people = scenario ? lexiconFor(scenario, run, deployed.flatMap((squad) => runRoster(g, run, squad.id).flatMap((id) => g.officers[id] ? [{ ...g.officers[id], squad: squad.id }] : []))) : null;

  const pickAction = (id: Id) => {
    if (view?.id === id || !actions.some((action) => action.id === id) || run.stage === 'debrief') return;
    setSelection({ runId: run.id, stage: run.stage, actionId: id });
    setOverride({ actionId: id, acting: focus ? [focus.id] : [], support: [] });
    setActiveOfficer(null);
  };

  const selectAction = (id: Id) => {
    setActionFromSupport(false);
    if (view?.id === id) {
      setPanel(panel === 'action' ? 'none' : 'action');
      return;
    }
    pickAction(id);
    setPanel('action');
  };

  const toggleActing = (id: SquadId) => {
    if (!view) return;
    if (!acting.includes(id) && actorUnavailable(id)) return;
    const next = toggleActingSquad({ acting, support }, id, maxActing);
    setOverride({ actionId: view.id, ...next });
    setFocusId(next.acting.includes(id) ? id : next.acting[0]);
    setActiveOfficer(null);
  };
  const toggleSupport = (id: SquadId) => {
    if (!view?.support || (!support.includes(id) && availableMembers(id).length === 0)) return;
    setOverride({ actionId: view.id, ...toggleSupportingSquad({ acting, support }, id, view.support.maxSquads) });
  };

  const confirm = () => {
    const currentRun = getState().activeRun;
    // A second tap from the same rendered choice must not commit another decision.
    if (!view?.eligible || panel !== 'action' || currentRun?.id !== run.id || currentRun.stage !== run.stage || currentRun.revision !== run.revision || currentRun.status !== 'active') return;
    const res = act({ type: 'decide', actionId: view.id, actingSquadIds: acting, supportSquadIds: support });
    if (!res.ok) return;
    const r = lastResolution(getState());
    setPanel('none');
    setOverride(null);
    setSelection(null);
    setActiveOfficer(null);
    if (r) {
      const ids = new Set(spaces.map((s) => s.id));
      const spaceIds = [r.targetId, ...r.knowledgeChanges.map((k) => k.factId)].filter((x): x is Id => !!x && ids.has(x));
      setLastChange({ revision: r.revision, spaceIds });
      // The result card now leads the scene, so it replaces the toast that pointed down at it.
      // When the decision ends the call the debrief shows the result instead.
      if (getState().activeRun?.stage !== 'debrief' && typeof requestAnimationFrame === 'function') requestAnimationFrame(revealLastDecision);
    }
  };

  return (
    <LiveView
      {...model}
      people={people}
      onFocusSquad={(id) => {
        if (view && actorUnavailable(id)) return;
        setFocusId(id);
        setActiveOfficer(null);
        if (view) setOverride({ actionId: view.id, ...focusActingSquad({ acting, support }, id) });
      }}
      onSelectAction={selectAction}
      onSelectOfficer={setActiveOfficer}
      onSelectSpace={(id) => {
        setSelSpace(id);
        setPanel('room');
        const f = floorOf(id);
        if (f !== null) setFloor(f);
      }}
      onFloorChange={setFloor}
      onToggleRooms={() => setShowRooms((v) => !v)}
      onCancel={() => setConfirmCancel(true)}
      onOpenDetails={() => { setActionFromSupport(false); setPanel(panel === 'action' ? 'none' : 'action'); }}
      feedback={<OperationFeedback officers={g.officers} decisions={decisions} explicitCompletion={(scenario?.version ?? 0) >= 4} onOpenLog={() => setPanel('none')} />}
      scene={sceneFor(scenario?.incident?.type)}
      situation={scenario && <SituationPanel scenario={scenario} run={run} />}
      supportContext={scenario && <><IncidentPeopleStatus scenario={scenario} run={run} state={g} /><SupportContext scenario={scenario} run={run} actions={actions} open={panel === 'support'} onOpen={() => setPanel('support')} onClose={() => setPanel('none')} onPickAction={(id) => {
        setActionFromSupport(true);
        pickAction(id);
        setPanel('action');
      }} /></>}
      failedResponse={failurePlan && <section className="call operation-failed-response" aria-label="Failed response">
        <h3>{failurePlan.title}</h3>
        <p>{failurePlan.reason}</p>
        <p className="dim">Review the people and duties still unresolved before ending this response.</p>
        <Button variant="danger" block onClick={() => { setPanel('none'); setConfirmFailure({ runId: failurePlan.runId, revision: failurePlan.revision }); }}>Review failed response</Button>
      </section>}
    >
      <ActionSheet
        open={panel === 'action'}
        onBackToSupport={actionFromSupport ? () => setPanel('support') : undefined}
        onClose={() => setPanel('none')}
        view={view}
        all={actions}
        onPick={pickAction}
        squads={deployed}
        acting={acting}
        support={support}
        onToggleActing={toggleActing}
        onToggleSupport={toggleSupport}
        maxActing={maxActing}
        squadPositions={Object.fromEntries(run.squadTasks.map(task => [task.squadId, spaceById.get(task.positionId)?.label ?? task.positionId]))}
        unavailableActors={deployed.filter(squad => actorUnavailable(squad.id)).map(squad => squad.id)}
        unavailableSupport={deployed.filter(squad => availableMembers(squad.id).length === 0).map(squad => squad.id)}
        participantNames={view?.officerIds.map(id => g.officers[id]).filter(officer => !!officer).map(officer => `${officer.firstName} ${officer.surname}`) ?? []}
        supportTask={actionRule?.support ? `${actionRule.support.label} at ${spaceById.get(actionRule.support.coverSpaceId)?.label ?? actionRule.support.coverSpaceId}` : null}
        targetLabel={targetLabel}
        onConfirm={confirm}
        resupply={resupply}
        resupplyMinutes={(run.resupplies ?? []).reduce((sum, delivery) => sum + delivery.minutes, 0)}
        onResupply={() => {
          const currentRun = getState().activeRun;
          if (!view || panel !== 'action' || !resupply?.ok || currentRun?.id !== run.id || currentRun.stage !== run.stage || currentRun.revision !== run.revision || currentRun.status !== 'active') return;
          act({ type: 'resupplyAction', actionId: view.id, actingSquadIds: acting, supportSquadIds: support }, `Equipment delivered · +${resupply.minutes} min. Review the action, then confirm.`);
        }}
        alternatives={alternatives}
        onUseAlternative={(candidate) => {
          setFocusId(candidate.actingSquadIds[0] ?? null);
          setOverride({ actionId: candidate.id, acting: candidate.actingSquadIds, support: candidate.supportSquadIds });
          setActiveOfficer(null);
        }}
      />
      <RoomSheet
        open={panel === 'room'}
        onClose={() => setPanel('none')}
        space={selSpace ? (spaceById.get(selSpace) ?? null) : null}
        built={model.built}
        squads={deployed}
        actions={actions}
        onPickAction={(id) => {
          setActionFromSupport(false);
          pickAction(id);
          setPanel('action');
        }}
      />
      <Sheet
        open={!!failurePlan && confirmFailure?.runId === failurePlan.runId && confirmFailure.revision === failurePlan.revision}
        onClose={() => setConfirmFailure(null)}
        title={failurePlan?.title ?? 'Failed response'}
        footer={<div className="row-actions">
          <Button onClick={() => setConfirmFailure(null)}>Keep reviewing</Button>
          <Button variant="danger" onClick={() => {
            const current = getState().activeRun;
            if (!failurePlan || confirmFailure?.runId !== failurePlan.runId || confirmFailure.revision !== failurePlan.revision || current?.id !== failurePlan.runId || current.revision !== failurePlan.revision || current.status !== 'active') return;
            if (act({ type: 'endFailedResponse', runId: failurePlan.runId, revision: failurePlan.revision }).ok) setConfirmFailure(null);
          }}>Confirm failed response</Button>
        </div>}
      >
        {failurePlan && <>
          <p>{failurePlan.reason}</p>
          {!!failurePlan.progressRetained?.length && <><h3>Progress retained</h3><ul className="bullets">{failurePlan.progressRetained.map(item => <li key={item}>{item}</li>)}</ul></>}
          <h3>Still unresolved</h3>
          <ul className="bullets">{failurePlan.remainingTasks.map(task => <li key={task}>{task}</li>)}</ul>
          <p>{failurePlan.consequence}</p>
          <p className="note note-warn">No incident funding, development points or completion experience. Department trust falls by 2.</p>
        </>}
      </Sheet>
      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this operation?"
        footer={
          <div className="row-actions">
            <Button onClick={() => setConfirmCancel(false)}>Keep going</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (act({ type: 'cancelOperation' }, 'Operation canceled. Gear released.').ok) setConfirmCancel(false);
              }}
            >
              Cancel operation
            </Button>
          </div>
        }
      >
        <p>No decisions have been made yet, so squads return unchanged and reserved equipment is released.</p>
      </Sheet>
      {import.meta.env.DEV && <OpenInLab getState={() => g} />}
    </LiveView>
  );
}
