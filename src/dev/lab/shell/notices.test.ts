// Review finding draw-change-churns-cast-and-stacks-notices: each draw change used to add an "Also
// changed: …" notice that never cleared, so they stacked and shrank the frame, and after Back they
// described name changes that had been undone.
import { describe, expect, it } from 'vitest';
import LAB_APP from '../LabApp.tsx?raw';
import { DRAW_NOTICE } from '../context';
import type { Notice } from './NoticeBar';
import { addNotice, dropNoticeKey } from './notices';

const notice = (id: string, text: string, key?: string): Notice => ({ id, text, tone: 'info', ...key ? { key } : {} });

describe('the notice list', () => {
  it('keeps one draw-change notice: each new one replaces the last', () => {
    let list: Notice[] = [notice('a', 'The old lab was retired.')];
    for (const [id, names] of [['b', 'Beatriz → Diego'], ['c', 'Diego → Gulnara'], ['d', 'Gulnara → Bram']]) list = addNotice(list, notice(id, `Also changed: names ${names}.`, DRAW_NOTICE));
    expect(list.map(entry => entry.id)).toEqual(['a', 'd']);
    expect(list[1].text).toBe('Also changed: names Gulnara → Bram.');
  });
  it('replaces a notice with the same text, and keeps unkeyed notices apart', () => {
    let list = addNotice([], notice('a', 'Path kept to step 1.'));
    list = addNotice(list, notice('b', 'Path kept to step 1.'));
    list = addNotice(list, notice('c', 'Path kept to step 2.'));
    expect(list.map(entry => entry.id)).toEqual(['b', 'c']);
  });
  it('clears the draw-change notice alone, as Back and Undo draw change do', () => {
    const list = [notice('a', 'Path kept to step 1.'), notice('b', 'Also changed: names Lee → Omar.', DRAW_NOTICE)];
    expect(dropNoticeKey(list, DRAW_NOTICE).map(entry => entry.id)).toEqual(['a']);
    // The shell wires it: popstate and undoDraw both clear it.
    const onPop = LAB_APP.slice(LAB_APP.indexOf('const onPop = () => {'));
    expect(onPop.slice(0, onPop.indexOf('};'))).toContain('clearDrawNotice()');
    const undo = LAB_APP.slice(LAB_APP.indexOf('const undoDraw = useCallback('));
    expect(undo.slice(0, undo.indexOf('}, []);'))).toContain('clearDrawNotice()');
  });
});
