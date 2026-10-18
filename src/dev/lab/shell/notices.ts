// The notice list's rules (spec 3.0), kept pure for the shell and its tests: a notice with the same
// text as one shown replaces it, a notice with a key replaces any other with that key (a draw
// change's "Also changed: …" is one at a time), and a key's notice can be cleared on its own (Back
// and Undo draw change undo what it says).
import type { Notice } from './NoticeBar';

export function addNotice(list: readonly Notice[], notice: Notice): Notice[] {
  return [...list.filter(entry => entry.text !== notice.text && (!notice.key || entry.key !== notice.key)), notice];
}

export function dropNoticeKey(list: readonly Notice[], key: string): Notice[] {
  return list.filter(entry => entry.key !== key);
}
