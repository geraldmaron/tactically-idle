import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChromeProvider, FlowHead, FlowScreen } from './chrome';

describe('chrome contract', () => {
  it('draws a flow head with back in words, the title and one trailing control', () => {
    const html = renderToStaticMarkup(createElement(FlowHead, { title: 'Going Live', backLabel: 'Calls', onBack: vi.fn(), trailing: createElement('button', null, 'Map') }));
    expect(html).toContain('aria-label="Back to Calls"');
    expect(html).toContain('<h1 class="flow-title" tabindex="-1">Going Live</h1>');
    expect(html).toContain('>Map</button>');
  });

  it('keeps a flow body in the screen when the shell has no slots yet', () => {
    const register = vi.fn(() => () => {});
    const html = renderToStaticMarkup(createElement(ChromeProvider, { value: { mode: 'desk', head: null, foot: null, register } },
      createElement(FlowScreen, { title: 'Hire', onBack: vi.fn(), footer: createElement('div', null, 'Foot'), children: createElement('p', null, 'Body') })));
    expect(html).toBe('<p>Body</p>');
  });
});
