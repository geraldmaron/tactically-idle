// Beat: the payoff for a commitment (station rebuild, "a beat on every commitment"). A stamp (OPEN,
// SIGNED, ENROLLED, PROMOTED), an optional face with one reaction line, and an optional sting, over
// the screen for about 1.5 seconds. It is an overlay: pointer-events none, no reserved space, so it never
// blocks a tap and never moves layout. Under reduced motion the final state shows at once.
//
// Toast decision: a Beat REPLACES the success toast for its command. Fire it through `useBeat().act`,
// which sends the command with no ok message, so the player gets one announcement, the Beat's own
// polite live region. A refusal still shows its reason as an error toast and plays no Beat. A screen
// that calls `play` directly after its own `act` passes no ok message to that `act`.
//
// This file is store-free (the Scenario Lab's station page draws it). `BeatProvider` in
// BeatProvider.tsx is the store-bound mount: once, inside `<ToastProvider>` and inside `.app`.
import { createContext, useContext, useSyncExternalStore } from 'react';
import { Face } from './Face';
import { beatAnnouncement, type ActiveBeat, type BeatApi, type BeatController } from './beat-controller';
import './beat.css';

export type { BeatApi, BeatFace, BeatSpec } from './beat-controller';

export const BeatContext = createContext<BeatApi | null>(null);

export function useBeat(): BeatApi {
  const v = useContext(BeatContext);
  if (!v) throw new Error('useBeat outside BeatProvider');
  return v;
}

/** The layer: a stable live region plus the visible beat, if any. */
export function BeatLayer({ controller }: { controller: BeatController }) {
  const active = useSyncExternalStore(controller.subscribe, controller.get, controller.get);
  return <div className="beat-layer">
    <div className="sr-only" role="status" aria-live="polite">{active ? beatAnnouncement(active.spec) : ''}</div>
    {active && <BeatView key={active.id} beat={active} />}
  </div>;
}

/** One beat as drawn. Decorative to assistive technology: the layer's live region says it. */
export function BeatView({ beat }: { beat: ActiveBeat }) {
  const { spec, still } = beat;
  const { face, line } = spec;
  return <div className="beat" data-still={still ? '' : undefined} aria-hidden="true">
    <span className="beat-stamp">{spec.stamp.toUpperCase()}</span>
    {(face || line) && <span className="beat-react">
      {face && <Face size="md" kind={face.kind ?? (face.officer ? 'officer' : 'person')} officer={face.officer} src={face.src} />}
      {line && <span className="beat-line">{line}</span>}
    </span>}
  </div>;
}
