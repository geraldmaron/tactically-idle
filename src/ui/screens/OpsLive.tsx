import { useEffect, useMemo, useState } from 'react';
import { getState, useGame } from '../store';
import {
  actionViews,
  currentBuilt,
  decisionViews,
  lastResolution,
  previewAction,
  spaceViews,
  stageContinuations,
  stageProgress,
} from '../../sim/operation-selectors';
import type { Id, SquadId } from '../../sim/types';
import { useToast } from '../components/toast';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/ui';
import { getScenario } from '../../sim/scenario-registry';
import { ActionSheet, LiveView, RoomSheet } from './LiveView';
import { cardFor } from './helpers';
import { planActionResupply } from '../../sim/equipment-resupply';
import { LastDecisionPeek, OperationFeedback, RESULT_LABEL } from './OperationFeedback';
import { SituationPanel } from './SituationPanel';
import { SupportContext } from './SupportContext';
import { IncidentPeopleStatus } from '../components/IncidentPeople';
import { incidentOfficerUnavailable } from '../../sim/incident-consequences';
import { focusActingSquad, toggleActingSquad, toggleSupportingSquad } from './operation-squads';
import { responseFailurePlan } from '../../sim/response-failure';
import { floorCount } from '../blueprint/floors';

interface Override {
  actionId: Id;
  acting: SquadId[];
  support: SquadId[];
}

interface ActionSelection {
  runId: Id;
  stage: string;
  actionId: Id;
}

/** Scroll the saved result into view without moving focus away from the player's place. */
function revealLastDecision() {
  document.querySelector('.operation-feedback')?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

export function OpsLive() {
  const g = useGame();
  const now = Date.now();
  const { act, notify } = useToast();
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

  const built = currentBuilt(g);
  const deployed = g.squads.filter((s) => run.squadIds.includes(s.id));
  const focus = deployed.find((s) => s.id === focusId) ?? deployed[0] ?? null;
  const spaces = spaceViews(g);
  const progress = stageProgress(g);
  const continuations = stageContinuations(g);
  const decisions = decisionViews(g);
  const failurePlan = responseFailurePlan(g);
  // Forecast the visibly focused squad without assigning supporting squads.
  // A decision remains unselected until the player opens it for review.
  const actions = actionViews(g, now, focus?.id ?? null).map((action) =>
    previewAction(g, now, action.id, focus ? [focus.id] : [], []) ?? action);
  const selectedId = selection?.runId === run.id && selection.stage === run.stage ? selection.actionId : null;
  const base = actions.find((a) => a.id === selectedId) ?? null;
  const ov = override && base && override.actionId === base.id ? override : null;
  const view = base && ov ? (previewAction(g, now, base.id, ov.acting, ov.support) ?? base) : base;
  const acting = ov?.acting ?? view?.actingSquadIds ?? [];
  const support = ov?.support ?? view?.supportSquadIds ?? [];
  const resupply = view && !view.eligible ? planActionResupply(g, now, view.id, acting, support) : null;
  const alternatives = view && !view.eligible ? deployed
    .filter((s) => !acting.includes(s.id))
    .map((s) => previewAction(g, now, view.id, [s.id], support.filter((id) => id !== s.id)))
    .filter((a): a is NonNullable<typeof a> => !!a?.eligible) : [];

  const officers = focus ? focus.officerIds.map((id) => g.officers[id]).filter((o) => !!o) : [];
  const defaultOfficer = view?.officerIds.find((id) => focus?.officerIds.includes(id)) ?? officers[0]?.id ?? null;
  const activeOfficerId = activeOfficer && officers.some((o) => o.id === activeOfficer) ? activeOfficer : defaultOfficer;

  const card = cardFor(g, run.scenarioId, now);
  const scenario = useMemo(() => getScenario(run.scenarioId), [run.scenarioId]);
  const actionRule = run.stage === 'debrief' ? undefined : scenario?.stages[run.stage].actions.find(action => action.id === view?.id);
  const maxActing = actionRule?.maxActing ?? 1;
  const availableMembers = (id: SquadId) => deployed.find(squad => squad.id === id)?.officerIds.filter(officerId => !!g.officers[officerId] && !incidentOfficerUnavailable(g, run, officerId)) ?? [];
  const actorUnavailable = (id: SquadId) => !actionRule?.commandOnly && availableMembers(id).length === 0;
  const environment = scenario?.environment ?? null;
  const floors = built ? floorCount(built.location) : 1;
  /** Floor a room or zone sits on (exterior zones are ground). */
  const floorOf = (id: Id | null): number | null => {
    if (!id || !built) return null;
    return built.derived.spaces[id]?.floor ?? built.location.rooms.find((r) => r.id === id)?.floor ?? 0;
  };
  // Follow the selected action: when its target is on another floor, show that floor.
  const targetFloor = floorOf(view?.targetId ?? null);
  useEffect(() => {
    if (targetFloor !== null) setFloor(targetFloor);
  }, [view?.id, targetFloor]);
  const title = (card?.title ?? built?.location.name ?? run.scenarioId.replace(/_/g, ' ')).toUpperCase();
  const subtitle = `${(card?.setting ?? built?.location.setting ?? '').toUpperCase()} / ${card?.code ?? 'OP'}`;

  const spaceById = new Map(spaces.map((s) => [s.id, s]));
  const targetLabel = view?.targetId ? (spaceById.get(view.targetId)?.label ?? built?.location.rooms.find((r) => r.id === view.targetId)?.label ?? null) : null;

  if (!built) return <div className="page"><p className="dim">Operation location unavailable.</p></div>;

  const pickAction = (id: Id) => {
    if (view?.id === id || !actions.some((action) => action.id === id)) return;
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
      // When the decision ends the call the debrief already shows the result; there is nothing to reveal.
      const ended = getState().activeRun?.stage === 'debrief';
      notify(r.committed?.resultLabel ?? RESULT_LABEL[r.band], { tone: r.committed?.resultLabel ? 'info' : r.band === 'adverse' ? 'error' : r.band === 'favorable' ? 'ok' : 'amber', ...(ended ? {} : { lines: ['Tap to see what happened and what changed.'], onSelect: revealLastDecision }) });
    }
  };

  return (
    <LiveView
      g={g}
      now={now}
      title={title}
      subtitle={subtitle}
      progress={progress}
      built={built}
      spaces={spaces}
      squadTasks={run.squadTasks}
      deployedSquads={deployed}
      focusSquadId={focus?.id ?? null}
      unavailableSquadIds={view ? deployed.filter(squad => actorUnavailable(squad.id)).map(squad => squad.id) : []}
      onFocusSquad={(id) => {
        if (view && actorUnavailable(id)) return;
        setFocusId(id);
        setActiveOfficer(null);
        if (view) setOverride({ actionId: view.id, ...focusActingSquad({ acting, support }, id) });
      }}
      officers={officers}
      actions={actions}
      selectedAction={view}
      onSelectAction={selectAction}
      continuations={continuations}
      onContinueStage={(actionId) => {
        const currentRun = getState().activeRun;
        const continuation = continuations.find((entry) => entry.actionId === actionId);
        if (!continuation || currentRun?.id !== run.id || currentRun.stage !== run.stage || currentRun.revision !== continuation.revision || currentRun.status !== 'active') return;
        if (!act({ type: 'continueStage', actionId, revision: continuation.revision }).ok) return;
        setPanel('none');
        setSelection(null);
        setOverride(null);
        setActiveOfficer(null);
      }}
      activeOfficerId={activeOfficerId}
      onSelectOfficer={setActiveOfficer}
      selectedSpaceId={selSpace}
      onSelectSpace={(id) => {
        setSelSpace(id);
        setPanel('room');
        const f = floorOf(id);
        if (f !== null) setFloor(f);
      }}
      floor={Math.min(floor, Math.max(0, floors - 1))}
      onFloorChange={setFloor}
      environment={environment}
      highlightSpaceIds={view?.targetId ? [view.targetId] : []}
      lastChange={lastChange}
      showRooms={showRooms}
      onToggleRooms={() => setShowRooms((v) => !v)}
      clock={run.clock}
      pressure={run.pressure}
      canCancel={run.history.length === 0 && !run.resupplies?.length}
      onCancel={() => setConfirmCancel(true)}
      onOpenDetails={() => { setActionFromSupport(false); setPanel(panel === 'action' ? 'none' : 'action'); }}
      detailsOpen={panel === 'action'}
      lastDecision={<LastDecisionPeek decisions={decisions} onReveal={revealLastDecision} />}
      feedback={<OperationFeedback officers={g.officers} decisions={decisions} explicitCompletion={(scenario?.version ?? 0) >= 4} onOpenLog={() => setPanel('none')} />}
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
        built={built}
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
    </LiveView>
  );
}
