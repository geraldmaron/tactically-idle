// A roster row names its status only when the officer is not ready, and every qualification glyph carries its name.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CERT_NAME } from '../../content/certs';
import { makeState, NOW } from '../../sim/test-fixtures';
import { OfficerRow } from './OfficerRow';

const row = (patch: Partial<ReturnType<typeof officer>>) => renderToStaticMarkup(createElement(OfficerRow, { officer: { ...officer(), ...patch }, now: NOW }));
const officer = () => Object.values(makeState().officers)[0];

describe('OfficerRow', () => {
  it('draws no status mark for a ready officer, and one for everyone else', () => {
    expect(row({ stress: 0, injury: null, assignment: null })).not.toContain('kit-mark');
    expect(row({ stress: 40, injury: null, assignment: null })).toContain('kit-mark--strained');
    expect(row({ stress: 0, injury: { label: 'Sprain', until: NOW + 1000 } })).toContain('kit-mark--injured');
  });

  it('keeps the condition in the row’s spoken name even when no mark is drawn', () => {
    expect(row({ stress: 0, injury: null, assignment: null })).toMatch(/aria-label="[^"]*, ready, stress 0/);
  });

  it('names each qualification glyph with a tooltip', () => {
    const html = row({ certs: ['entry_team', 'advanced_first_aid'] });
    for (const cert of ['entry_team', 'advanced_first_aid'] as const) expect(html).toContain(`title="${CERT_NAME[cert]}"`);
  });
});
