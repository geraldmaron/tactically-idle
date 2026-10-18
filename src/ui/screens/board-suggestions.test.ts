import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BoardShortage } from '../../sim/board-suggestions';
import { BringRow } from './CallTile';

const render = (short: BoardShortage[]) => renderToStaticMarkup(createElement(BringRow, { short }));
const labels = (html: string) => [...html.matchAll(/class="chip [^"]+" aria-label="([^"]+)"/g)].map((m) => m[1]);

const CERT: BoardShortage = { kind: 'cert', id: 'entry_team', have: 0 };
const HAILER: BoardShortage = { kind: 'gear', label: 'Loud hailer', itemIds: ['loud_hailer'], need: 1, have: 0 };
const SUPPLY: BoardShortage = { kind: 'gear', label: 'Impact rounds', itemIds: ['impact_supply'], need: 2, have: 1 };
const VEHICLE: BoardShortage = { kind: 'cert', id: 'vehicle_operations', have: 0 };

describe('Bring row on the board card', () => {
  it('is hidden when nothing is short', () => {
    expect(render([])).toBe('');
  });

  it('keeps the selector’s order and says each shortage in full to a screen reader', () => {
    const html = render([CERT, HAILER, SUPPLY]);
    expect(html).toContain('aria-label="Short for this call"');
    expect(labels(html)).toEqual([
      'Entry team, no officer free to deploy holds it',
      'Loud hailer, 0 ready of 1 needed',
      'Impact rounds, 1 ready of 2 needed',
    ]);
    expect(html).toContain('Loud hailer 0<');
    expect(html).toContain('Impact rounds 1/2<');
  });

  it('shows at most three chips and folds the rest into +N', () => {
    const html = render([CERT, HAILER, SUPPLY, VEHICLE]);
    expect((html.match(/class="chip chip-warn"/g) ?? [])).toHaveLength(3);
    expect(html).toContain('>+1</span>');
    expect(labels(html).at(-1)).toBe('1 more short, Vehicle operations, no officer free to deploy holds it');
  });
});
