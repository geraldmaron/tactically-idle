import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChromeProvider, FlowHead, FlowScreen } from './chrome';

describe('chrome contract', () => {
  it('draws a flow head with back in words, the title and one trailing control', () => {
    const html = renderToStaticMarkup(createElement(FlowHead, { title: 'Going Live', backLabel: 'Calls', onBack: vi.fn(), trailing: createElement('button', null, 'Map') }));
    expect(html).toContain('aria-label="Back to Calls"');
    expect(html).toContain('<h1 class="flow-title" tabindex="-1"><span class="flow-title-text">Going Live</span></h1>');
    expect(html).toContain('>Map</button>');
  });

  it('draws no Back when a flow has no way back, keeping the title centred', () => {
    const html = renderToStaticMarkup(createElement(FlowHead, { title: 'Debrief' }));
    expect(html).not.toContain('<button');
    expect(html).toContain('<span class="flow-back flow-back-none" aria-hidden="true"></span><h1 class="flow-title" tabindex="-1"><span class="flow-title-text">Debrief</span></h1>');
  });

  it('puts a decorative icon before the title when a flow passes one', () => {
    const html = renderToStaticMarkup(createElement(FlowHead, { title: 'Debrief', icon: createElement('svg', { 'data-icon': 'flag' }) }));
    expect(html).toContain('<h1 class="flow-title" tabindex="-1"><span class="flow-title-icon" aria-hidden="true"><svg data-icon="flag"></svg></span><span class="flow-title-text">Debrief</span></h1>');
  });

  it('keeps a flow body in the screen when the shell has no slots yet', () => {
    const register = vi.fn(() => () => {});
    const html = renderToStaticMarkup(createElement(ChromeProvider, { value: { mode: 'desk', head: null, foot: null, register } },
      createElement(FlowScreen, { title: 'Hire', onBack: vi.fn(), footer: createElement('div', null, 'Foot'), children: createElement('p', null, 'Body') })));
    expect(html).toBe('<p>Body</p>');
  });
});
