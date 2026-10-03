import { useEffect, useMemo, useState } from 'react';
import { getState, useGame } from '../store';
import {
  actionViews,
  currentBuilt,
  decisionViews,
  lastResolution,
  previewAction,
  spaceViews,
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
import { OperationFeedback, RESULT_LABEL } from './OperationFeedback';
import { SupportContext } from './SupportContext';
import { IncidentPeopleStatus } from '../components/IncidentPeople';

interface Override {
  actionId: Id;
  acting: SquadId[];
  support: SquadId[];
}

export function OpsLive() {
  const g = useGame();
  const now = Date.now();
  const { act, notify } = useToast();
  const run = g.activeRun!;

  const [focusId, setFocusId] = useState<SquadId | null>(null);
  const [selActionId, setSelActionId] = useState<Id | null>(null);
  const [activeOfficer, setActiveOfficer] = useState<Id | null>(null);
  const [selSpace, setSelSpace] = useState<Id | null>(null);
  const [panel, setPanel] = useState<'none' | 'action' | 'room' | 'support'>('none');
  const [actionFromSupport, setActionFromSupport] = useState(false);
  const [showRooms, setShowRooms] = useState(false);
  const [override, setOverride] = useState<Override | null>(null);
  const [lastChange, setLastChange] = useState<{ revision: number; spaceIds: Id[] } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [floor, setFloor] = useState(0);

  const built = currentBuilt(g);
  const deployed = g.squads.filter((s) => run.squadIds.includes(s.id));
  const focus = deployed.find((s) => s.id === focusId) ?? deployed[0] ?? null;
  const spaces = spaceViews(g);
  const progress = stageProgress(g);
  const decisions = decisionViews(g);
  const actions = actionViews(g, now, focus?.id ?? null);
  const base = actions.find((a) => a.id === selActionId) ?? actions.find((a) => a.eligible) ?? actions[0] ?? null;
  const ov = override && base && override.actionId === base.id ? override : null;
  const view = base && ov ? (previewAction(g, now, base.id, ov.acting, ov.support) ?? base) : base;
  const acting = ov?.acting ?? view?.actingSquadIds ?? [];
  const support = ov?.support ?? view?.supportSquadIds ?? [];
  const resupply = view && !view.eligible ? planActionResupply(g, now, view.id, acting, support) : null;
  const alternatives = view && !view.eligible ? deployed
    .filter((s) => !acting.includes(s.id))
    .map((s) => actionViews(g, now, s.id).find((a) => a.id === view.id))
    .filter((a): a is NonNullable<typeof a> => !!a?.eligible) : [];

  const officers = focus ? focus.officerIds.map((id) => g.officers[id]).filter((o) => !!o) : [];
  const defaultOfficer = view?.officerIds.find((id) => focus?.officerIds.includes(id)) ?? officers[0]?.id ?? null;
  const activeOfficerId = activeOfficer && officers.some((o) => o.id === activeOfficer) ? activeOfficer : defaultOfficer;

  const card = cardFor(g, run.scenarioId, now);
  const scenario = useMemo(() => getScenario(run.scenarioId), [run.scenarioId]);
  const environment = scenario?.environment ?? null;
  const floors = built?.location.floors ?? 1;
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

  const selectAction = (id: Id) => {
    setActionFromSupport(false);
    if (view?.id === id) {
      setPanel(panel === 'action' ? 'none' : 'action');
      return;
    }
    setSelActionId(id);
    setOverride(null);
    setActiveOfficer(null);
    setPanel('action');
  };

  const toggleActing = (id: SquadId) => {
    if (!view) return;
    const nextActing = acting.includes(id) ? acting.filter((x) => x !== id) : [...acting, id];
    if (nextActing.length === 0) return;
    setOverride({ actionId: view.id, acting: nextActing, support: support.filter((x) => !nextActing.includes(x)) });
  };
  const toggleSupport = (id: SquadId) => {
    if (!view || acting.includes(id)) return;
    setOverride({ actionId: view.id, acting, support: support.includes(id) ? support.filter((x) => x !== id) : [...support, id] });
  };

  const confirm = () => {
    const currentRun = getState().activeRun;
    // A second tap from the same rendered choice must not commit another decision.
    if (!view || currentRun?.id !== run.id || currentRun.revision !== run.revision || currentRun.status !== 'active') return;
    const res = act({ type: 'decide', actionId: view.id, actingSquadIds: acting, supportSquadIds: support });
    if (!res.ok) return;
    const r = lastResolution(getState());
    setPanel('none');
    setOverride(null);
    setSelActionId(null);
    setActiveOfficer(null);
    if (r) {
      const ids = new Set(spaces.map((s) => s.id));
      const spaceIds = [r.targetId, ...r.knowledgeChanges.map((k) => k.factId)].filter((x): x is Id => !!x && ids.has(x));
      setLastChange({ revision: r.revision, spaceIds });
      notify(`${RESULT_LABEL[r.band]}`, { tone: r.band === 'adverse' ? 'error' : r.band === 'favorable' ? 'ok' : 'amber', lines: ['See Last decision for the outcome, changes and causes.'] });
    }
  };

  return (
    <LiveView
      g={g}
      now={now}
      title={title}
      subtitle={subtitle}
      practice={run.practice}
      progress={progress}
      built={built}
      spaces={spaces}
      squadTasks={run.squadTasks}
      deployedSquads={deployed}
      focusSquadId={focus?.id ?? null}
      onFocusSquad={(id) => {
        setFocusId(id);
        setOverride(null);
        setActiveOfficer(null);
      }}
      officers={officers}
      actions={actions}
      selectedAction={view}
      onSelectAction={selectAction}
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
      feedback={<OperationFeedback officers={g.officers} decisions={decisions} practice={run.practice} explicitCompletion={(scenario?.version ?? 0) >= 4} onOpenLog={() => setPanel('none')} />}
      supportContext={scenario && <><IncidentPeopleStatus scenario={scenario} run={run} state={g} /><SupportContext scenario={scenario} run={run} actions={actions} open={panel === 'support'} onOpen={() => setPanel('support')} onClose={() => setPanel('none')} onPickAction={(id) => {
        setActionFromSupport(true);
        setSelActionId(id);
        setOverride(null);
        setActiveOfficer(null);
        setPanel('action');
      }} /></>}
    >
      <ActionSheet
        open={panel === 'action'}
        onBackToSupport={actionFromSupport ? () => setPanel('support') : undefined}
        onClose={() => setPanel('none')}
        view={view}
        all={actions}
        onPick={(id) => {
          setSelActionId(id);
          setOverride(null);
          setActiveOfficer(null);
        }}
        squads={deployed}
        acting={acting}
        support={support}
        onToggleActing={toggleActing}
        onToggleSupport={toggleSupport}
        targetLabel={targetLabel}
        onConfirm={confirm}
        resupply={resupply}
        resupplyMinutes={(run.resupplies ?? []).reduce((sum, delivery) => sum + delivery.minutes, 0)}
        onResupply={() => {
          if (!view || !resupply?.ok) return;
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
          setSelActionId(id);
          setOverride(null);
          setPanel('action');
        }}
      />
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
                if (act({ type: 'cancelOperation' }, 'Operation cancelled. Gear released.').ok) setConfirmCancel(false);
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
