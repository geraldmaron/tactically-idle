import type { Id } from '../../sim/types';

export const TRAINING_CHOOSER_HISTORY_KEY = 'tacticallyIdleTrainingChooser';
export interface TrainingChoice { courseId: Id; reviewOfficerId: Id | null }
type HistoryPort = Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>;
interface Callbacks {
  owner: string;
  request: () => number;
  select: (choice: TrainingChoice | null) => void;
}

/** One history entry per chooser: Back dismisses it, review Back stays within it. */
export function createTrainingChooserNavigation(history: HistoryPort, callbacks: Callbacks) {
  let closing = false;
  const owned = () => {
    const value = history.state?.[TRAINING_CHOOSER_HISTORY_KEY];
    return value?.owner === callbacks.owner && value.request === callbacks.request() && typeof value.courseId === 'string'
      ? value as TrainingChoice & { owner: string; request: number } : null;
  };
  const removeMarker = () => {
    if (history.state?.[TRAINING_CHOOSER_HISTORY_KEY]?.owner !== callbacks.owner) return;
    const next = { ...history.state };
    delete next[TRAINING_CHOOSER_HISTORY_KEY];
    history.replaceState(next, '');
  };
  return {
    open(courseId: Id) {
      if (closing || owned()) return false;
      const choice = { courseId, reviewOfficerId: null };
      history.pushState({ ...history.state, [TRAINING_CHOOSER_HISTORY_KEY]: { ...choice, owner: callbacks.owner, request: callbacks.request() } }, '');
      callbacks.select(choice);
      return true;
    },
    review(officerId: Id | null) {
      const choice = owned();
      if (!choice || closing) return;
      const next = { ...choice, reviewOfficerId: officerId };
      history.replaceState({ ...history.state, [TRAINING_CHOOSER_HISTORY_KEY]: next }, '');
      callbacks.select(next);
    },
    close(completed = false) {
      if (closing) return;
      callbacks.select(null);
      if (!owned()) return;
      if (completed) removeMarker();
      closing = true;
      history.back();
    },
    onPop() {
      closing = false;
      callbacks.select(owned());
    },
    discard() {
      closing = false;
      removeMarker();
      callbacks.select(null);
    },
    dispose: removeMarker,
  };
}
