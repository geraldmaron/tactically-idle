import { useEffect, useState } from 'react';
import { getState, send, setLiveCallShown, settleLapse, useGame } from '../store';
import { liveDither } from '../timer';
import { playHeartbeat, setMurmur, stopLiveAudio, unlockAudio } from '../audio/live-audio';
import { leadingPressure, liveFillViews } from './fill-gauge';
import { stalledRun } from '../../sim/clocks';
import { decisionViews, lastResolution } from '../../sim/operation-selectors';
import type { Id, SquadId } from '../../sim/types';
import { decisionsOf } from '../../sim/types';
import { useToast } from '../components/toast';
import { ChromeFoot, useChromeMode } from '../components/chrome';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/ui';
import { OpenInLab } from '../components/OpenInLab';
import { ActionSheet, FillGauge, LiveView, RoomSheet, ThreatPill } from './LiveView';
import { Blueprint } from '../blueprint/Blueprint';
import { OperationFeedback } from './OperationFeedback';
import { sceneFor } from '../art/Plates';
import { SituationPanel } from './SituationPanel';
import { SupportContext } from './SupportContext';
import { IncidentPeopleStatus } from '../components/IncidentPeople';
import { focusActingSquad, pickLead, toggleActingSquad, toggleSupportingSquad } from './operation-squads';
import { responseFailurePlan } from '../../sim/response-failure';
import { liveScreen, type ActionSelection, type Override } from './live-model';
import { lexiconFor } from '../people/lexicon';
import { runRoster } from '../../sim/squads';
import { isHotCall } from '../../sim/authorization';

/** A beat change (result, then the next decision) starts at the top of the call. */
function revealLastDecision() {
  document.querySelector('.live')?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

/** `onStepOut` leaves the call for HQ without cancelling it (Ops.tsx passes the shell's navigation). */
export function OpsLive({ onStepOut }: { onStepOut?: () => void } = {}) {
  const g = useGame();
  const now = Date.now();
  const { act } = useToast();
  const run = g.activeRun!;

  const [focusId, setFocusId] = useState<SquadId | null>(() => decisionsOf(run.history).at(-1)?.actingSquadIds[0] ?? null);
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
  // The stall so far (docs/call-pressure.md): the cards show it and the commit charges what they showed.
  // The scene moves while the player decides (docs/call-pressure.md, "The live decision"), so the
  // screen reads the clock four times a second (the store's own tick is every five).
  // When the drain runs out with no choice made the call moves on (docs/call-pressure.md, "When the
  // time runs out"). Off this screen the decision is paused, so nothing runs out there.
  const [, setSecond] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => { settleLapse(); setSecond((n) => n + 1); }, 250);
    return () => window.clearInterval(timer);
  }, []);
  // The open decision's stall runs only while this screen shows and the page is visible; stepping
  // off the call pauses it and coming back resumes it (ui/decision-pause.ts, owned by the store).
  useEffect(() => {
    setLiveCallShown(true);
    return () => setLiveCallShown(false);
  }, []);
  // The call in focus (components/chrome.tsx): its strip replaces the resource bar and Step out the tabs.
  useChromeMode('focus');
  // Sound starts on the first touch (browsers refuse it before) and fades out when the call ends.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); stopLiveAudio(); };
  }, []);
  const dither = liveDither(g, now);
  const screen = liveScreen(g, now, { focusId, selection, override, floor, activeOfficer, selectedSpaceId: selSpace, lastChange, showRooms, detailsOpen: panel === 'action', dither });
  const decisions = decisionViews(g);
  // The result beat is the saved run's: a commit or a lapse leaves its result pending until the player
  // reads on, so a reload mid-result comes back on the result.
  const beat = run.status === 'active' && run.decisionPending && decisions.length > 0 ? 'result' : 'decide';
  const nextStage = screen?.model.progress.stages.find((step) => step.state === 'current')?.label;
  // Older states could carry a pending decision with no result to read: open it at once.
  useEffect(() => {
    if (run.status === 'active' && run.decisionPending && decisions.length === 0) send({ type: 'openDecision', revision: run.revision });
  }, [run.status, run.decisionPending, run.revision, decisions.length]);
  // A result that lands while the screen shows (a lapse) starts at the top of the call, as a commit's does.
  useEffect(() => {
    if (beat === 'result' && typeof requestAnimationFrame === 'function') requestAnimationFrame(revealLastDecision);
  }, [beat, run.revision]);
  // The heartbeat in a threat's last quarter, and the crowd's murmur at its level.
  const threatOpen = screen?.model.progress.threat ?? null;
  const threatShare = threatOpen && beat === 'decide' ? Math.max(0, threatOpen.minutes - dither) / threatOpen.minutes : 1;
  const heartbeat = beat === 'decide' && threatShare > 0 && threatShare <= 0.25;
  useEffect(() => {
    if (!heartbeat) return;
    playHeartbeat();
    const timer = window.setInterval(playHeartbeat, 1000);
    return () => window.clearInterval(timer);
  }, [heartbeat]);
  const crowdLevel = liveFillViews(g, dither).filter((view) => view.kind === 'crowd' && !view.owner).reduce((max, view) => Math.max(max, view.value / 100), 0);
  useEffect(() => { setMurmur(run.status === 'active' ? crowdLevel : 0); }, [Math.round(crowdLevel * 20), run.status]);
  const failurePlan = responseFailurePlan(g);
  // Follow the selected action: when its target is on another floor, show that floor.
  const targetFloor = screen?.review.targetFloor ?? null;
  useEffect(() => {
    if (targetFloor !== null) setFloor(targetFloor);
  }, [screen?.review.view?.id, targetFloor]);

  // Lights and sirens while a hot call runs; one short buzz the moment they start, where supported.
  const scenarioDef = screen?.review.scenario;
  const hot = !!scenarioDef && run.status === 'active' && run.stage !== 'debrief' && isHotCall(scenarioDef, run);
  useEffect(() => {
    if (hot && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(30);
  }, [hot]);

  if (!screen) return <div className="page"><p className="dim">This call's building is unavailable.</p></div>;
  const { model, review } = screen;
  const livePressure = beat === 'decide' ? leadingPressure(model.progress.threat ?? null, dither, liveFillViews(g, dither)) : null;
  const { deployed, focus, view, acting, support, actionRule, maxActing, resupply, lead, bestFit, leadOrder, leadOfficerId, leadMarks, leadBlend, leadCerts, alternatives, scenario, spaceById, targetLabel, availableMembers, actorUnavailable, floorOf } = review;
  const actions = model.actions;
  const spaces = model.spaces;
  // The deployed officers, by squad, for the names in this call's text.
  const people = scenario ? lexiconFor(scenario, run, deployed.flatMap((squad) => runRoster(g, run, squad.id).flatMap((id) => g.officers[id] ? [{ ...g.officers[id], squad: squad.id, squadName: squad.name }] : []))) : null;

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
    // Support doesn't change who takes part, so the lead pick stays.
    setOverride({ actionId: view.id, ...toggleSupportingSquad({ acting, support }, id, view.support.maxSquads), ...(leadOfficerId ? { lead: leadOfficerId } : {}) });
  };
  const chooseLead = (id: Id) => {
    if (!view) return;
    const next = pickLead(view.officerIds, bestFit, leadOfficerId, id);
    setOverride({ actionId: view.id, acting, support, ...(next ? { lead: next } : {}) });
  };

  const confirm = () => {
    const currentRun = getState().activeRun;
    // A second tap from the same rendered choice must not commit another decision.
    if (!view?.eligible || panel !== 'action' || currentRun?.id !== run.id || currentRun.stage !== run.stage || currentRun.revision !== run.revision || currentRun.status !== 'active') return;
    const res = act({ type: 'decide', actionId: view.id, actingSquadIds: acting, supportSquadIds: support, ...(leadOfficerId ? { leadOfficerId } : {}), ditherMinutes: dither, revision: run.revision });
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
    }
  };

  return (
    <LiveView
      {...model}
      dither={dither}
      sirens={hot}
      beat={beat}
      onContinue={() => {
        // The next decision's stall starts when it shows, not while its result is read (openDither).
        const current = getState().activeRun;
        if (current?.status === 'active' && current.decisionPending) send({ type: 'openDecision', revision: current.revision });
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(revealLastDecision);
      }}
      continueLabel="Continue"
      footWrap={(node) => <ChromeFoot><div className="action-bar live-continue">{node}</div></ChromeFoot>}
      continueNote={nextStage ? `Next: ${nextStage}` : undefined}
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
      onStepOut={onStepOut}
      onOpenDetails={() => { setActionFromSupport(false); setPanel(panel === 'action' ? 'none' : 'action'); }}
      feedback={<OperationFeedback officers={g.officers} decisions={decisions} folded={beat === 'decide'} explicitCompletion={(scenario?.version ?? 0) >= 4} currentPrompt={model.progress.prompt} onOpenLog={() => setPanel('none')} />}
      scene={sceneFor(scenario?.incident?.type)}
      // The briefing sheet holds the reference: the call's briefing and who has been located. The map
      // shows where they are; the story column keeps only what helps the next decision.
      // The people panel reads the subjects as the stall has left them, so it agrees with the strip.
      situation={scenario && <><SituationPanel scenario={scenario} run={run} /><IncidentPeopleStatus scenario={scenario} run={{ ...run, meters: stalledRun(scenario, run, dither).meters }} state={g} /></>}
      supportContext={scenario && <><SupportContext scenario={scenario} run={run} actions={actions} open={panel === 'support'} onOpen={() => setPanel('support')} onClose={() => setPanel('none')} onPickAction={(id) => {
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
      {livePressure && <ChromeFoot><div className="live-pressure-cue">
        {livePressure.kind === 'threat'
          ? <ThreatPill label={livePressure.label} minutes={livePressure.minutes} dither={dither} />
          : <FillGauge view={{ ...livePressure.view, effect: null }} />}
      </div></ChromeFoot>}
      <ActionSheet
        open={panel === 'action'}
        preview={view && <div className="action-sheet-map" aria-label={`Where ${view.title} happens`}>
          <Blueprint built={model.built} spaces={model.spaces} squadTasks={model.squadTasks} squads={g.squads} selectedSpaceId={null} focusSquadId={model.focusSquadId}
            highlightSpaceIds={model.highlightSpaceIds} onSelectSpace={() => undefined} lastChange={null} overlays={view.overlays} showMaterials={false}
            floor={model.floor} onFloorChange={setFloor} environment={model.environment ?? undefined} />
        </div>}
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
        officers={g.officers}
        lead={lead}
        bestFit={bestFit}
        leadOrder={leadOrder}
        leadMarks={leadMarks}
        leadBlend={leadBlend}
        leadCerts={leadCerts}
        onPickLead={chooseLead}
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
          <p className="note note-warn">No incident funding or completion experience. Department trust falls by 2.</p>
        </>}
      </Sheet>
      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this call?"
        footer={
          <div className="row-actions">
            <Button onClick={() => setConfirmCancel(false)}>Keep going</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (act({ type: 'cancelOperation' }, 'Call canceled. Gear released.').ok) setConfirmCancel(false);
              }}
            >
              Cancel the call
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
