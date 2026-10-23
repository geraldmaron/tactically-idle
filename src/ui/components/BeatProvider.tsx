// The store-bound mount for Beat (components/Beat.tsx): `act` sends through the game's store and a
// refusal goes to the toast queue as an error, exactly as `useToast().act` does, but a success plays the
// beat instead of toasting. Mount once, inside `<ToastProvider>` and inside `.app`.
import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { send } from '../store';
import { BeatContext, BeatLayer } from './Beat';
import { createBeatApi, createBeatController, type BeatController } from './beat-controller';
import { useToast } from './toast';

export function BeatProvider({ children, controller }: { children: ReactNode; controller?: BeatController }) {
  const { notify } = useToast();
  const own = useRef<BeatController | null>(null);
  const beats = controller ?? (own.current ??= createBeatController());
  const api = useMemo(() => createBeatApi(beats, send, notify), [beats, notify]);
  return <BeatContext.Provider value={api}>
    {children}
    <BeatLayer controller={beats} />
  </BeatContext.Provider>;
}
