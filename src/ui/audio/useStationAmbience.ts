// HQ and Build call this once: the faint station room tone plays while the screen is mounted. It obeys
// the Sound setting and reduced motion (live-audio.ts) and starts on the first touch.
import { useEffect } from 'react';
import { startStationAmbience, stopStationAmbience } from './live-audio';

export function useStationAmbience(): void {
  useEffect(() => {
    startStationAmbience();
    return stopStationAmbience;
  }, []);
}
