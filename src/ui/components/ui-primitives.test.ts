import { createElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ICON_SIZE, ICON_STROKE, Icon, iconPx } from '../icons';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Row, Section, Text } from './ui';
import type { TextKind } from './ui';

const html = (node: ReactNode) => renderToStaticMarkup(node);

describe('icon contract', () => {
  it('names three sizes and one stroke', () => {
    expect(ICON_SIZE).toEqual({ sm: 16, md: 20, lg: 24 });
    expect(ICON_STROKE).toBe(1.75);
  });

  it('draws a named size at its pixels and still takes a number', () => {
    expect(iconPx('md')).toBe(20);
    expect(iconPx(18)).toBe(18);
    expect(html(createElement(Icon, { name: 'check', size: 'sm' }))).toContain('width="16" height="16"');
    expect(html(createElement(Icon, { name: 'check' }))).toContain('width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"');
    expect(html(createElement(Icon, { name: 'check', size: 18 }))).toContain('width="18"');
  });
});

describe('shared variants', () => {
  it('marks a selected button as pressed and leaves a caller-set aria-pressed alone', () => {
    expect(html(createElement(Button, { selected: true, children: 'On' }))).toContain('btn-selected');
    expect(html(createElement(Button, { selected: true, children: 'On' }))).toContain('aria-pressed="true"');
    expect(html(createElement(Button, { 'aria-pressed': false, selected: true, children: 'On' }))).toContain('aria-pressed="false"');
    expect(html(createElement(Button, { children: 'Off' }))).not.toContain('aria-pressed');
  });

  it('keeps button icons on the kit sizes', () => {
    expect(html(createElement(Button, { icon: 'check', children: 'Do' }))).toContain('width="20"');
    expect(html(createElement(Button, { icon: 'check', size: 'sm', children: 'Do' }))).toContain('width="16"');
  });

  it('gives chips, badges and cards named states', () => {
    expect(html(createElement(Chip, { selected: true, children: 'Chosen' }))).toContain('chip-selected');
    expect(html(createElement(Chip, { disabled: true, children: 'Away' }))).toContain('chip-disabled');
    expect(html(createElement(Badge, { tone: 'good', children: '+40 XP' }))).toContain('stamp stamp-good');
    expect(html(createElement(Card, { tone: 'harm', selected: true, children: 'x' }))).toContain('card card-harm card-selected');
    expect(html(createElement(Card, { onClick: () => undefined, disabled: true, children: 'x' }))).toContain('<button type="button" class="card card-link card-disabled"');
  });

  it('gives rows selected and disabled states and flags a row with no lead', () => {
    const lead = createElement('span', null, 'L');
    expect(html(createElement(Row, { title: 'Name', lead, selected: true }))).toContain('ui-row-selected');
    expect(html(createElement(Row, { title: 'Name', lead, disabled: true, onClick: () => undefined }))).toContain('ui-row-disabled');
    expect(html(createElement(Row, { title: 'Name', lead }))).not.toContain('data-lead');
    expect(html(createElement(Row, { title: 'Name' }))).toContain('data-lead="none"');
  });

  it('flags a section without an icon', () => {
    expect(html(createElement(Section, { title: 'A', icon: 'info', children: 'x' }))).not.toContain('data-lead');
    expect(html(createElement(Section, { title: 'A', children: 'x' }))).toContain('data-lead="none"');
  });

  it('names the five type styles', () => {
    const kinds: TextKind[] = ['section', 'row', 'meta', 'price', 'decision'];
    for (const kind of kinds) expect(html(createElement(Text, { kind, children: 'x' }))).toContain(`class="t-${kind}"`);
  });
});

describe('empty, loading and error states', () => {
  it('shares one family with a compact inline form', () => {
    expect(html(createElement(EmptyState, { title: 'Nothing here' }))).toContain('class="empty"');
    const compact = html(createElement(EmptyState, { title: 'Nothing here', compact: true, spot: 'noCalls' }));
    expect(compact).toContain('empty empty-compact');
    expect(compact).not.toContain('kit-spot');
  });

  it('announces loading politely and an error at once', () => {
    const loading = html(createElement(LoadingState, { compact: true }));
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-live="polite"');
    expect(loading).toContain('Loading');
    const error = html(createElement(ErrorState, { title: 'The save would not load', action: createElement(Button, { children: 'Try again' }) }));
    expect(error).toContain('role="alert"');
    expect(error).toContain('Try again');
  });
});
