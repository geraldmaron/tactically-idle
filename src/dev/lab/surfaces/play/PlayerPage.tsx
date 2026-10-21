// The true-device page (spec 10.4 item 3): `/lab?frame=player&…` draws only the game, full window,
// for Play's "True device" iframe at 320, 360, 390 or 430 px, where the game's own width rules apply
// as on a phone. It opens the call from its own URL and replays the URL path on saved tuning (never
// the lab's unsaved patch). Nothing passes between it and the lab: a Confirm here rolls the run's own
// dice on this page only.
import { isLapse } from '../../../../sim/types';
import { useCallback, useEffect, useState } from 'react';
import { applyTuningPatch } from '../../../../sim/tuning';
import { readLabHandoff } from '../../../../ui/lab-handoff';
import type { LabMove } from '../../model/call';
import { currentFrame, openSession, replayTokens, stepSession } from '../../model/session';
import type { Session } from '../../model/session';
import type { LabUrl } from '../../types';
import { GameApp } from './GameFrame';
import type { FrameToast } from './GameFrame';

type Opened = { session: Session } | { error: string };

function open(u: LabUrl): Opened {
  if (!u.call) return { error: 'This link names no call.' };
  try {
    let handoff = null;
    if (u.handoff) { try { handoff = readLabHandoff(u.handoff); } catch { handoff = null; } }
    const opened = openSession(u, handoff);
    if (!('frames' in opened)) return { error: opened.message };
    return { session: u.path ? replayTokens(opened, u.path) : opened };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function PlayerPage({ url }: { url: LabUrl }) {
  // Saved tuning only, before the call opens: the lab's unsaved patch stays in the lab.
  const [opened, setOpened] = useState<Opened>(() => { applyTuningPatch({}); return open(url); });
  const [toast, setToast] = useState<FrameToast | null>(null);
  useEffect(() => { document.title = 'Scenario Lab · true device'; }, []);
  const session = 'session' in opened ? opened.session : null;
  const state = session ? currentFrame(session).state : null;
  const run = state?.activeRun;
  const ended = !!run && (run.status !== 'active' || run.stage === 'debrief');
  const screen = url.screen ?? (ended ? 'debrief' : 'live');
  const step = useCallback((move: LabMove) => {
    if (!session) return;
    const next = stepSession(session, move);
    if ('refused' in next) { setToast({ id: Date.now(), title: next.refused, tone: 'error' }); return; }
    setOpened({ session: next });
    const last = currentFrame(next).state.activeRun?.history.at(-1);
    const h = last && !isLapse(last) ? last : undefined;
    if (move.kind === 'roll' && h?.committed?.resultLabel) setToast({ id: Date.now(), title: h.committed.resultLabel, tone: 'info' });
  }, [session]);

  if (!state) {
    return (
      <div className="lab-player lab-player-error" data-lab="ti-lab-build-marker">
        <p>{'error' in opened ? opened.error : 'The call did not open.'}</p>
      </div>
    );
  }
  return (
    <div className="lab-player" data-lab="ti-lab-build-marker" data-screen={screen}>
      <GameApp state={state} screen={screen} names={url.names}
        onReview={() => {}} onConfirm={id => step({ kind: 'roll', actionId: id })} onFail={() => step({ kind: 'fail', actionId: 'response_failure' })}
        toast={toast} onToastDone={() => setToast(null)} />
    </div>
  );
}
