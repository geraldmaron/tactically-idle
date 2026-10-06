import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentProps, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChoiceRail, railKeyboardValue, revealRailSelection } from './ChoiceRail';

// Capture the rendered buttons to exercise their actual handlers in the node test environment.
function railButtons(props: Parameters<typeof ChoiceRail<string>>[0]) {
  let rendered!: ReactElement<{ children: ReactElement<ComponentProps<'button'>>[] }>;
  function Capture() {
    rendered = ChoiceRail(props);
    return rendered;
  }
  renderToStaticMarkup(createElement(Capture));
  return rendered.props.children.map(({ props: button }) => {
    const focus = vi.fn();
    if (typeof button.ref === 'function') button.ref({ focus } as unknown as HTMLButtonElement);
    return {
      focus,
      click: () => button.onClick?.({} as MouseEvent<HTMLButtonElement>),
      key(key: string) {
        const preventDefault = vi.fn();
        button.onKeyDown?.({ key, preventDefault } as unknown as KeyboardEvent<HTMLButtonElement>);
        return preventDefault;
      },
    };
  });
}

describe('single-row choice navigation', () => {
  const options = [{ value: 'first', label: 'First' }, { value: 'busy', label: 'Unavailable', disabled: true }, { value: 'last', label: 'A long visible label' }];
  it.each(['navigation', 'filter', 'tabs'] as const)('does not reset the current %s choice on a repeated click', (kind) => {
    const onChange = vi.fn();
    const buttons = railButtons({ value: 'first', options, onChange, label: 'Choices', kind });
    buttons[0].click();
    buttons[0].click();
    expect(onChange).not.toHaveBeenCalled();
    buttons[2].click();
    expect(onChange).toHaveBeenCalledExactlyOnceWith('last');
  });
  it.each([{ value: 'first', index: 0, key: 'Home' }, { value: 'last', index: 2, key: 'End' }])('keeps $key at the selected endpoint without firing a change', ({ value, index, key }) => {
    const onChange = vi.fn();
    const buttons = railButtons({ value, options, onChange, label: 'Choices', kind: 'navigation' });
    expect(buttons[index].key(key)).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(buttons[index].focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });
  it.each([{ value: 'last', current: 2, next: 0, key: 'Home', expected: 'first' }, { value: 'first', current: 0, next: 2, key: 'End', expected: 'last' }])('changes and focuses the $key endpoint when it differs from the selected value', ({ value, current, next, key, expected }) => {
    const onChange = vi.fn();
    const buttons = railButtons({ value, options, onChange, label: 'Choices', kind: 'navigation' });
    expect(buttons[current].key(key)).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(expected);
    expect(buttons[next].focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });
  it('compares the keyboard destination with the selected value when another navigation button has focus', () => {
    const onChange = vi.fn();
    const buttons = railButtons({ value: 'first', options, onChange, label: 'Choices', kind: 'navigation' });
    buttons[2].key('Home');
    expect(onChange).not.toHaveBeenCalled();
    expect(buttons[0].focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    buttons[2].key('End');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('last');
  });
  it('moves across available choices, wraps, and supports endpoints', () => {
    expect(railKeyboardValue(options, 'first', 'ArrowRight')).toBe('last');
    expect(railKeyboardValue(options, 'first', 'ArrowLeft')).toBe('last');
    expect(railKeyboardValue(options, 'last', 'ArrowRight')).toBe('first');
    expect(railKeyboardValue(options, 'last', 'Home')).toBe('first');
    expect(railKeyboardValue(options, 'first', 'End')).toBe('last');
    expect(railKeyboardValue(options, 'first', 'ArrowDown')).toBeNull();
    expect(railKeyboardValue([{ value: 'none', disabled: true }], 'none', 'End')).toBeNull();
  });
  it('exposes selected filter and one keyboard entry without changing labels', () => {
    const html = renderToStaticMarkup(createElement(ChoiceRail, { value: 'last', options, onChange: () => {}, label: 'Branches' }));
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-checked="true"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain('A long visible label');
  });
  it('uses destination semantics for page navigation', () => {
    const html = renderToStaticMarkup(createElement(ChoiceRail, { value: 'first', options, onChange: () => {}, label: 'Sections', kind: 'navigation' }));
    expect(html).toContain('role="navigation"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('role="radio"');
  });
  it('connects each squad tab to its panel with a stable label id', () => {
    const html = renderToStaticMarkup(createElement(ChoiceRail, { value: 'A', options: [{ value: 'A', label: 'Alpha' }, { value: 'B', label: 'Bravo' }], onChange: () => {}, label: 'Squads', kind: 'tabs', panelId: 'squad-panel' }));
    expect(html).toContain('id="squad-panel-tab-A" aria-selected="true" aria-controls="squad-panel" tabindex="0"');
    expect(html).toContain('id="squad-panel-tab-B" aria-selected="false" aria-controls="squad-panel" tabindex="-1"');
  });
  it.each([
    { left: 80, right: 150, expected: 76 },
    { left: 330, right: 420, expected: 124 },
    { left: 160, right: 270, expected: 100 },
  ])('reveals clipped selection horizontally without moving the page ($left–$right)', ({ left, right, expected }) => {
    const strip = { scrollLeft: 100, scrollTop: 27, getBoundingClientRect: () => ({ left: 100, right: 400 }) };
    const node = { getBoundingClientRect: () => ({ left, right }) };
    revealRailSelection(strip as HTMLDivElement, node as HTMLButtonElement);
    expect(strip.scrollLeft).toBe(expected);
    expect(strip.scrollTop).toBe(27);
  });
  it('keeps a keyboard entry when the selected option becomes unavailable', () => {
    const html = renderToStaticMarkup(createElement(ChoiceRail, { value: 'busy', options, onChange: () => {}, label: 'Options' }));
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="false" tabindex="0">First/);
  });
});
