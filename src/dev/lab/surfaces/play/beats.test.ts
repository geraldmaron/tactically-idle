// The play frame's two beats (docs/call-presentation.md), as the game's OpsLive keeps them: the
// frame's own Confirm opens the result beat; a lab step, a rewind or a replay starts on the decide
// beat, with the last result folded to one row.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseLabUrl } from '../../url';
import { currentFrame, openSession, rewindSession, stepSession } from '../../model/session';
import type { Session } from '../../model/session';
import { GameApp, labResultOf } from './GameFrame';

const REFERENCE = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';

function open(): Session {
  const opened = openSession(parseLabUrl(`?${REFERENCE}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}
/** The first eligible choice, rolled. */
function rolled(s: Session): { s: Session; actionId: string } {
  const view = currentFrame(s).views.find(entry => entry.eligible);
  if (!view) throw new Error('no eligible choice');
  const next = stepSession(s, { kind: 'roll', actionId: view.id });
  if ('refused' in next) throw new Error(next.refused);
  return { s: next, actionId: view.id };
}

describe('play frame beats', () => {
  const start = open();
  const before = currentFrame(start).state;
  const { s: after, actionId } = rolled(start);
  const landed = currentFrame(after).state;
  const confirmed = { actionId, decisions: before.activeRun!.history.length };

  it('opens the result beat when the frame confirmed the decision that landed', () => {
    expect(labResultOf(confirmed, landed)).toBe(landed.activeRun!.history.at(-1)!.revision);
  });

  it('starts a lab step, a rewind or another move on the decide beat', () => {
    expect(labResultOf(null, landed)).toBeNull();
    expect(labResultOf(confirmed, currentFrame(rewindSession(after, 0)).state)).toBeNull();
    expect(labResultOf({ ...confirmed, actionId: 'some_other_choice' }, landed)).toBeNull();
    const { s: twice } = rolled(after);
    expect(labResultOf(confirmed, currentFrame(twice).state)).toBeNull();
  });

  it('draws a stepped frame on the decide beat with the last result folded', () => {
    const html = renderToStaticMarkup(createElement(GameApp, { state: landed, screen: 'live', names: false, onReview() {}, onConfirm() {}, onFail() {}, toast: null, onToastDone() {} }));
    expect(html).toContain('live-beat-decide');
    expect(html).toContain('operation-feedback-folded');
    expect(html).not.toContain('live-continue');
  });
});
