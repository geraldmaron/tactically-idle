// The call model's content key: stable for unchanged content, different per call type, new when a
// template changes (an HMR edit replaces the template object).
import { afterEach, describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import { contentKey, decodePath, encodePath, startLabRun, toLab } from './call';
import { readParams, resolveScenario } from './call';
import { startGateRun } from '../../../gen/incident/gates/engine-driver';
import { labUrlToSearch, parseLabUrl } from '../url';

const ORIGINAL = INCIDENT_TEMPLATES.hostage_crisis!;
afterEach(() => { INCIDENT_TEMPLATES.hostage_crisis = ORIGINAL; });

describe('contentKey', () => {
  it('is stable, differs per type, and changes with the content', () => {
    const key = contentKey('hostage_crisis');
    expect(key).toMatch(/^hostage_crisis:[0-9a-f]{8}[0-9a-z]+$/);
    expect(contentKey('hostage_crisis')).toBe(key);
    expect(new Set(['hostage_crisis', 'barricaded', 'active_armed_incident', 'protected_rescue'].map(type => contentKey(type as never))).size).toBe(4);
    const edited = structuredClone(ORIGINAL);
    edited.tree.nodes[0].prompt += ' Edited.';
    INCIDENT_TEMPLATES.hostage_crisis = edited;
    expect(contentKey('hostage_crisis')).not.toBe(key);
    expect(contentKey('burglary' as never)).toBe('none:burglary');
  });
});

describe('moves and starts', () => {
  it('encodes engine moves as path tokens both ways', () => {
    const moves = [toLab({ kind: 'decide', actionId: 'a_b', band: 'mixed' }), toLab({ kind: 'fail', actionId: 'c' }), { kind: 'roll' as const, actionId: 'd' }];
    expect(encodePath(moves)).toBe('a_b~mixed,c~fail,d~roll');
    expect(decodePath(encodePath(moves))).toEqual(moves);
  });

  it('starts a day-one run as the gate does, and a full-kit run on the same dice', () => {
    const id = resolveScenario(readParams(new URLSearchParams('type=barricaded'))).id!;
    expect(startLabRun(id, 'day1')).toEqual(startGateRun(id));
    expect(startLabRun(id, 'full').activeRun!.rngState).toBe(startGateRun(id).activeRun!.rngState);
  });
});

describe('path tokens with drawn results', () => {
  it('decodes every old token exactly as before, and writes it back unchanged', () => {
    const old = 't13_hostage_crisis_offer_take_courier~favorable,b~mixed,c_d~adverse,e~roll,f~fail,response_failure~fail';
    const moves = decodePath(old);
    expect(moves).toEqual([
      { kind: 'decide', actionId: 't13_hostage_crisis_offer_take_courier', band: 'favorable' }, { kind: 'decide', actionId: 'b', band: 'mixed' },
      { kind: 'decide', actionId: 'c_d', band: 'adverse' }, { kind: 'roll', actionId: 'e' }, { kind: 'fail', actionId: 'f' },
      { kind: 'fail', actionId: 'response_failure' },
    ]);
    expect(moves.some(move => 'drawn' in move)).toBe(false);
    expect(encodePath(moves)).toBe(old);
    // Still nothing for a token that isn't a move.
    expect(decodePath('nonsense,~favorable,a~sideways')).toEqual([]);
  });

  it('carries an aimed decision\'s drawn keys after its band, in effect order', () => {
    const moves = [
      { kind: 'decide' as const, actionId: 't13_hostage_crisis_fired_on_go_in', band: 'adverse' as const, drawn: ['firearm:none', 'wounded'] },
      { kind: 'decide' as const, actionId: 'g', band: 'favorable' as const, drawn: ['follows+stays+out'] },
    ];
    const text = encodePath(moves);
    expect(text).toBe('t13_hostage_crisis_fired_on_go_in~adverse/firearm:none/wounded,g~favorable/follows.stays.out');
    expect(decodePath(text)).toEqual(moves);
    // The shell reads the action id as everything before the last `~` (LabApp refusedStep).
    for (const token of text.split(',')) expect(token.slice(0, token.lastIndexOf('~'))).toBe(moves[text.split(',').indexOf(token)].actionId);
    // A `+` typed into a link, or read back from a query string as a space, is the same key.
    expect(decodePath('g~favorable/follows+stays,h~mixed/follows stays')).toEqual([
      { kind: 'decide', actionId: 'g', band: 'favorable', drawn: ['follows+stays'] }, { kind: 'decide', actionId: 'h', band: 'mixed', drawn: ['follows+stays'] }]);
    // Only a band takes drawn keys, and an empty key is no key.
    expect(decodePath('a~roll/none,b~fail/none,c~adverse/,d~adverse//none,e~adverse/none/')).toEqual([]);
    // An empty list writes the old token.
    expect(encodePath([{ kind: 'decide', actionId: 'a', band: 'mixed', drawn: [] }])).toBe('a~mixed');
  });

  it('survives the lab URL both ways, readably', () => {
    const path = 't13_hostage_crisis_fired_on_go_in~adverse/firearm:none/wounded,t13_x_y~favorable/follows.stays,t13_x_z~roll';
    const search = labUrlToSearch(parseLabUrl(`?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=2&path=${path}`).url);
    expect(search).toContain(`&path=${path}`);
    expect(search).not.toMatch(/%/);
    expect(parseLabUrl(search).url.path).toBe(path);
    expect(decodePath(parseLabUrl(search).url.path)).toEqual(decodePath(path));
  });
});
