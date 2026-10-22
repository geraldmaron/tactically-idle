import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { SaveManager } from './SaveManager';
import { Sheet } from './Sheet';
import { Button } from './ui';

const manageSave = vi.fn();
vi.mock('../store', () => ({
  useCampaigns: () => ({ slots: [{ name: 'Campaign 1', valid: true, day: 1, level: 1, officers: 8, funding: 0, savedAt: 0 }, ...Array(9).fill(null)], activeSlotId: 1 }),
  manageSave: (...args: unknown[]) => manageSave(...args),
  isResponsivePreview: true,
}));

type Element = ReactElement<{ children?: ReactNode; onClick?: () => Promise<void>; onClose?: () => void; interactionKey?: string }>;
function elements(node: ReactNode): Element[] {
  if (!isValidElement<Element['props']>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(elements)];
}
function capture(onClose = vi.fn()) {
  let tree!: ReactElement;
  function Capture() { tree = SaveManager({ open: true, onClose }); return tree; }
  renderToStaticMarkup(createElement(Capture));
  const all = elements(tree);
  return {
    onClose,
    sheet: all.find((node) => node.type === Sheet)!,
    button: (label: string) => all.find((node) => node.type === Button && Children.toArray(node.props.children).join('') === label)!,
    /** The active slot's one primary action, Save now. */
    saveNow: () => (all.find((node) => (node.props as { active?: boolean }).active === true && 'onSave' in node.props)!.props as unknown as { onSave: () => Promise<void> }).onSave,
  };
}

beforeEach(() => { manageSave.mockReset(); });

it('opts every save action surface into transition protection', () => {
  expect(capture().sheet.props.interactionKey).toBe('slots:false');
});

it('serializes repeated save callbacks immediately and ignores Close during the write', async () => {
  let complete!: (result: { ok: boolean }) => void;
  manageSave.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  const f = capture();
  const save = f.saveNow();
  const first = save();
  const second = save();
  f.sheet.props.onClose?.();
  expect(manageSave).toHaveBeenCalledTimes(1);
  expect(manageSave).toHaveBeenCalledWith({ type: 'save' });
  expect(f.onClose).not.toHaveBeenCalled();
  complete({ ok: true });
  await Promise.all([first, second]);
  f.sheet.props.onClose?.();
  expect(f.onClose).toHaveBeenCalledOnce();
});

it('releases the synchronous lock after a failed write so retry stays available', async () => {
  manageSave.mockResolvedValue({ ok: false, reason: 'Storage is full.' });
  const f = capture();
  const save = f.saveNow();
  await save();
  await save();
  expect(manageSave).toHaveBeenCalledTimes(2);
});
