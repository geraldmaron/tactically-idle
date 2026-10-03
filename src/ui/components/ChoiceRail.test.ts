import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChoiceRail, railKeyboardValue } from './ChoiceRail';

describe('single-row choice navigation', () => {
  const options = [{ value: 'first', label: 'First' }, { value: 'busy', label: 'Unavailable', disabled: true }, { value: 'last', label: 'A long visible label' }];
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
  it('keeps a keyboard entry when the selected option becomes unavailable', () => {
    const html = renderToStaticMarkup(createElement(ChoiceRail, { value: 'busy', options, onChange: () => {}, label: 'Options' }));
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="false" tabindex="0">First/);
  });
});
