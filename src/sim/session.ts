import { createInitialState } from './department';
import { dispatch } from './game';
import { loadGame, saveGame, SAVE_KEY, type SaveStorage } from './save';
import { randomCampaignSeed } from './personnel';

/** Persist the seed on the first frame, so reloading before the first tick cannot reroll a campaign. */
export function restoreCampaign(now: number, storage: SaveStorage | null, seedFactory = randomCampaignSeed) {
  let loaded = null;
  try { loaded = storage ? loadGame(storage) : null; }
  catch { storage = null; } // Browser privacy settings can allow the handle but deny reads.
  const initial = loaded ?? createInitialState(now, seedFactory());
  const state = dispatch(initial, { type: 'tick' }, { now }).state;
  if (storage) {
    try {
      const old = storage.getItem(SAVE_KEY);
      // Keep a recovery copy before replacing an unreadable or newer save.
      if (old && !loaded) storage.setItem(`${SAVE_KEY}/recovery`, old);
      saveGame(state, now, storage);
    } catch { /* Continue in memory when persistence is unavailable. */ }
  }
  return state;
}
