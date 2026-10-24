// The order a player meets a call in: the board card, the backstory and briefing, the decisions, then
// the debrief. The strip under the path rail walks them with Back and Next, and a call opens on the
// card until the first decision is taken. Picking a step pins the frame to that screen, as the
// Director's Screen row does; "Follow the run" lets the run choose again.
import type { FrameScreen } from '../../types';
import { cx } from '../../viz';

const ORDER: { screen: FrameScreen; label: string; hint: string }[] = [
  { screen: 'card', label: 'Board card', hint: 'the hook on the Ops board' },
  { screen: 'brief', label: 'Backstory and briefing', hint: 'the cold open, who is inside, what dispatch knows' },
  { screen: 'live', label: 'The call', hint: 'stage prompts, the transcript and the choices' },
  { screen: 'debrief', label: 'Debrief', hint: 'the ending, the epilogue and what was really there' },
];

export function ScreenOrder({ screen, pinned, onPick, onFollow }: {
  screen: FrameScreen; pinned: boolean; onPick(screen: FrameScreen): void; onFollow(): void;
}) {
  const at = ORDER.findIndex(step => step.screen === screen);
  return (
    <nav className="lab-play-order" aria-label="Screens in the order the player sees them">
      <ol>
        {ORDER.map((step, index) => (
          <li key={step.screen}>
            <button type="button" className={cx('lab-play-order-step', index === at && 'lab-play-order-on')} aria-current={index === at ? 'step' : undefined}
              title={step.hint} onClick={() => onPick(step.screen)}>
              <span className="lab-play-order-n">{index + 1}</span>{step.label}
            </button>
          </li>
        ))}
      </ol>
      <span className="lab-play-order-nav">
        <button type="button" className="lab-button lab-button-quiet" disabled={at <= 0} onClick={() => onPick(ORDER[at - 1].screen)}>Back</button>
        <button type="button" className="lab-button lab-button-quiet" disabled={at >= ORDER.length - 1} onClick={() => onPick(ORDER[at + 1].screen)}>Next</button>
        {pinned && <button type="button" className="lab-button lab-button-quiet" onClick={onFollow}>Follow the run</button>}
      </span>
    </nav>
  );
}
