import { describe, expect, it } from 'vitest';
import { callKey, defaultCall, GATE_RETIRED_NOTICE, labUrlToSearch, noTreeNotice, OLD_LAB_NOTICE, parseLabUrl, parseSelection, parseVs, playerSearch, selectionText, vsText } from './url';
import type { LabUrl, Selection } from './types';

const HOSTAGE = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';
const parse = (search: string) => parseLabUrl(search);
/** The URL the lab writes with replaceState after reading `search`. */
const canonical = (search: string) => labUrlToSearch(parse(search).url);

describe('the hostage reference call', () => {
  it('reads every draw field and writes the same link back', () => {
    const { url, rewritten, notices } = parse(`?${HOSTAGE}`);
    expect(url.tab).toBe('play');
    expect(url.call).toMatchObject({ type: 'hostage_crisis', family: 'market_row', seed: 7, tier: 2, variant: 1, pacing: 'ordinary', call: null, id: null, kit: 'day1' });
    expect(url.squad).toBe(719);
    expect(rewritten).toBe(false);
    expect(notices).toEqual([]);
    expect(labUrlToSearch(url)).toBe(`?${HOSTAGE}`);
  });

  it('keeps a path readable: ~ , and : are never escaped', () => {
    const search = `?${HOSTAGE}&path=t13_hostage_crisis_offer_take_courier~favorable,t13_hostage_crisis_his_side_write~roll`;
    const { url, rewritten } = parse(search);
    expect(url.path).toBe('t13_hostage_crisis_offer_take_courier~favorable,t13_hostage_crisis_his_side_write~roll');
    expect(rewritten).toBe(false);
    expect(labUrlToSearch(url)).toBe(search);
  });

  it('unescapes a link that arrived percent-encoded', () => {
    const { url, rewritten } = parse(`?${HOSTAGE}&path=a%7Efavorable%2Cb%7Eadverse&sel=choice%3Aoffer%2Ftake_courier`);
    expect(url.path).toBe('a~favorable,b~adverse');
    expect(url.sel).toEqual({ kind: 'choice', node: 'offer', choice: 'take_courier' });
    expect(rewritten).toBe(true);
    expect(labUrlToSearch(url)).toBe(`?${HOSTAGE}&path=a~favorable,b~adverse&sel=choice:offer/take_courier`);
  });
});

describe('deep links from docs and skills (verify-and-shell.md "Docs to update")', () => {
  it('?type=<type> opens Play on the default draw of each call tree', () => {
    for (const type of ['hostage_crisis', 'barricaded', 'active_armed_incident', 'protected_rescue'] as const) {
      const { url, notices } = parse(`?type=${type}`);
      expect(url.tab).toBe('play');
      expect(url.call).toEqual(defaultCall(type));
      expect(notices).toEqual([]);
    }
    // The draw is spelled out on load so the link pins the call (paramsToQuery always writes it).
    expect(canonical('?type=hostage_crisis')).toBe('?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=0');
    expect(parse('?type=hostage_crisis').rewritten).toBe(true);
  });

  it('hostage-signature-review.md:48 (?type=hostage_crisis&variant=0)', () => {
    expect(canonical('?type=hostage_crisis&variant=0')).toBe('?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=0');
  });

  it('hostage-signature-review.md:51 (view=lab … tab=run) lands on Play with the view param dropped', () => {
    const { url, rewritten, notices } = parse(`?view=lab&${HOSTAGE}&tab=run`);
    expect(url.tab).toBe('play');
    expect(rewritten).toBe(true);
    expect(notices).toEqual([]);
    expect(labUrlToSearch(url)).toBe(`?${HOSTAGE}`);
  });

  it('hostage-signature-review.md:486 (&pacing=deliberate_answers) keeps the pacing', () => {
    const { url } = parse(`?view=lab&${HOSTAGE}&tab=run&pacing=deliberate_answers`);
    expect(url.call?.pacing).toBe('deliberate_answers');
    expect(labUrlToSearch(url)).toBe(`?${HOSTAGE}&pacing=deliberate_answers`);
  });

  it('review-example.md:32-34 (false_intruder has no call tree) goes to Calls with a notice', () => {
    for (const search of ['?type=false_intruder', '?view=lab&type=false_intruder&family=cedar_close&seed=7&tier=2&variant=1']) {
      const { url, rewritten, notices } = parse(search);
      expect(url.tab).toBe('calls');
      expect(url.call).toBeNull();
      expect(rewritten).toBe(true);
      expect(notices).toEqual([noTreeNotice('false_intruder')]);
      expect(labUrlToSearch(url)).toBe('');
    }
  });

  it('design-sheet.md:320 (?type=burglary) names the type in the notice', () => {
    const { url, notices } = parse('?type=burglary');
    expect(url.tab).toBe('calls');
    expect(notices).toEqual(['burglary has no call tree. The lab covers barricaded, armed, hostage and rescue calls.']);
  });

  it('content-pipeline.md:193-196 (typed framework links, with and without journeys)', () => {
    for (const search of ['?type=water_leak', '?type=water_leak&pacing=deliberate_answers', '?type=water_leak&seed=12']) {
      const { url, notices } = parse(search);
      expect(url.tab).toBe('calls');
      expect(url.call).toBeNull();
      expect(notices).toEqual([noTreeNotice('water_leak')]);
      expect(labUrlToSearch(url)).toBe('');
    }
    const gates = parse('?type=water_leak&journeys=1');
    expect(gates.url.tab).toBe('calls');
    expect(gates.notices).toEqual([GATE_RETIRED_NOTICE]);
    expect(labUrlToSearch(gates.url)).toBe('');
  });
});

describe('the story sheet URL contract (current-lab.md "Soft URL contract")', () => {
  it('keeps call, id, kit, path and node', () => {
    const literal = parse(`?type=hostage_crisis&family=market_row&seed=7&tier=2&call=123&kit=full&path=a~mixed&node=talking`);
    expect(literal.url.call).toMatchObject({ call: 123, kit: 'full' });
    expect(literal.url.node).toBe('talking');
    // A literal call seed wins over the situation and pacing, so neither is written.
    expect(labUrlToSearch(literal.url)).toBe('?type=hostage_crisis&family=market_row&seed=7&tier=2&call=123&kit=full&path=a~mixed&node=talking');

    const id = 'gen:hostage_crisis:market_row:7:123:2:13';
    const byId = parse(`?id=${id}&path=a~continue`);
    expect(byId.url.tab).toBe('play');
    expect(byId.url.call).toMatchObject({ id, type: 'hostage_crisis', family: 'market_row', seed: 7, call: 123, tier: 2 });
    expect(labUrlToSearch(byId.url)).toBe(`?id=${id}&path=a~continue`);
  });

  it('keeps an id from an older content version for the call error to name', () => {
    const id = 'gen:hostage_crisis:market_row:7:123:2:12';
    const { url, notices } = parse(`?id=${id}`);
    expect(url.call?.id).toBe(id);
    expect(notices).toEqual([]);
    expect(labUrlToSearch(url)).toBe(`?id=${id}`);
  });

  it('snaps a variant that does not exist for the pacing (readParams)', () => {
    const { url } = parse('?type=hostage_crisis&variant=9');
    expect(url.call?.variant).toBeGreaterThanOrEqual(0);
    expect(url.call?.variant).toBeLessThanOrEqual(2);
  });

  it('limits the building to the families the tree fits', () => {
    expect(parse('?type=protected_rescue&family=market_row').url.call?.family).toBe('cedar_close');
    expect(parse('?type=protected_rescue&family=bungalow_g2').url.call?.family).toBe('bungalow_g2');
  });

  it('view=gates and journeys=1 retire to Calls with the gate notice, dropping their params', () => {
    for (const search of ['?view=gates&type=water_leak', '?view=gates&type=water_leak&pacing=deliberate_answers&seed=40&journeys=1', '?journeys=1', `?view=gates&${HOSTAGE}`]) {
      const { url, rewritten, notices } = parse(search);
      expect(url.tab).toBe('calls');
      expect(url.call).toBeNull();
      expect(rewritten).toBe(true);
      expect(notices).toEqual([GATE_RETIRED_NOTICE]);
    }
  });

  it('a lab view with a journeys flag stays the lab', () => {
    const { url, notices } = parse(`?view=lab&journeys=1&${HOSTAGE}`);
    expect(url.tab).toBe('play');
    expect(notices).toEqual([]);
    expect(labUrlToSearch(url)).toBe(`?${HOSTAGE}`);
  });
});

describe('legacy tabs (spec 2.4)', () => {
  const cases: [string, string][] = [
    ['run', ''],
    ['instance', ''],
    ['map', '&screen=live'],
    ['graph', '&tab=flow&mode=structure'],
    ['choices&node=talking', '&node=talking'],
    ['writing', '&tab=script'],
    ['balance', '&tab=outcomes&scope=type'],
    ['notes', '&notes=1'],
  ];
  for (const [old, now] of cases) {
    it(`tab=${old}`, () => {
      const { url, rewritten, notices } = parse(`?view=lab&${HOSTAGE}&tab=${old}`);
      expect(rewritten).toBe(true);
      expect(notices).toEqual([]);
      expect(labUrlToSearch(url)).toBe(`?${HOSTAGE}${now}`);
    });
  }

  it('an unknown tab falls back to the default surface', () => {
    expect(parse(`?${HOSTAGE}&tab=nope`).url.tab).toBe('play');
    expect(parse('?tab=nope').url.tab).toBe('calls');
  });

  it('a surface with no call keeps its tab', () => {
    expect(labUrlToSearch(parse('?tab=tuning').url)).toBe('?tab=tuning');
    expect(labUrlToSearch(parse('?tab=calls').url)).toBe('');
    expect(labUrlToSearch(parse(`?${HOSTAGE}&tab=calls`).url)).toBe(`?${HOSTAGE}&tab=calls`);
  });
});

describe('new params', () => {
  it('reads every param and writes it back unchanged', () => {
    const search = `?${HOSTAGE}&squad=42&certs=vehicle_operations,crisis_negotiation&handoff=n1&hist=a~favorable&tab=flow&path=a~mixed&sel=band:offer/take_courier/adverse`
      + '&scope=type&style=best_odds&runs=150&x=0&names=0&truth=1&screen=debrief&dice=force&w=430&zoom=1'
      + '&mode=state&color=fate&pruned=1&exp=offer,talking&vision=deutan&grp=harm&adv=1&f=Ruth+terms&notes=1&frame=player';
    const { url, rewritten } = parse(search);
    expect(url).toMatchObject({
      squad: 42, certs: ['vehicle_operations', 'crisis_negotiation'], handoff: 'n1', hist: 'a~favorable', tab: 'flow', path: 'a~mixed',
      sel: { kind: 'band', node: 'offer', choice: 'take_courier', band: 'adverse' }, scope: 'type', style: 'best_odds', runs: 150,
      xray: false, names: false, truth: true, screen: 'debrief', dice: 'force', width: 430, zoom: '1',
      flow: { mode: 'state', color: 'fate', pruned: true, expanded: ['offer', 'talking'] }, vision: 'deutan',
      tuning: { group: 'harm', advanced: true }, filter: 'Ruth terms', notes: true, frame: 'player', labAlias: false,
    });
    expect(rewritten).toBe(false);
    expect(labUrlToSearch(url)).toBe(search);
  });

  it('drops every default on write', () => {
    const search = `?${HOSTAGE}&squad=719&scope=call&style=random&x=1&names=1&truth=0&dice=roll&w=390&zoom=fit&mode=reach&color=band&pruned=0&grp=odds&adv=0&notes=0&tab=play`;
    const { url, rewritten } = parse(search);
    expect(rewritten).toBe(true);
    expect(labUrlToSearch(url)).toBe(`?${HOSTAGE}`);
  });

  it('ignores values it does not know', () => {
    const { url } = parse(`?${HOSTAGE}&scope=all&style=lucky&runs=abc&screen=map&w=320&vision=mono&frame=x&sel=nope`);
    expect(url).toMatchObject({ scope: 'call', style: 'random', runs: null, screen: null, width: 390, vision: null, frame: null, sel: null });
  });

  it('a path or node without a call is dropped', () => {
    const { url } = parse('?path=a~favorable&node=talking');
    expect(url.path).toBe('');
    expect(url.node).toBeNull();
    expect(labUrlToSearch(url)).toBe('');
  });
});

describe('the lab alias', () => {
  it('is kept bare and first on every write', () => {
    const { url } = parse(`?lab&${HOSTAGE}`);
    expect(url.labAlias).toBe(true);
    expect(labUrlToSearch(url)).toBe(`?lab&${HOSTAGE}`);
    expect(labUrlToSearch({ ...url, call: null, tab: 'calls' })).toBe('?lab');
    expect(labUrlToSearch(parse('?lab=1&tab=tuning').url)).toBe('?lab&tab=tuning');
  });

  it('survives the legacy rewrites', () => {
    expect(labUrlToSearch(parse(`?lab&view=lab&${HOSTAGE}&tab=graph`).url)).toBe(`?lab&${HOSTAGE}&tab=flow&mode=structure`);
    expect(labUrlToSearch(parse('?lab&type=burglary').url)).toBe('?lab');
  });
});

describe('legacy=1 (the retired old lab)', () => {
  it('opens the same call in the new lab, its old tab mapped like any old link, and says so', () => {
    const { url, rewritten, notices } = parse(`?legacy=1&view=lab&${HOSTAGE}&tab=run`);
    expect(rewritten).toBe(true);
    expect(url.tab).toBe('play');
    expect(labUrlToSearch(url)).toBe(`?${HOSTAGE}`);
    expect(notices).toEqual([OLD_LAB_NOTICE]);
    expect(labUrlToSearch(parse(`?legacy=1&view=lab&${HOSTAGE}&tab=graph`).url)).toBe(`?${HOSTAGE}&tab=flow&mode=structure`);
  });
});

describe('the true-device page', () => {
  it('keeps the call, squad, path and switches and drops what that page does not draw', () => {
    const { url } = parse(`?${HOSTAGE}&certs=vehicle_operations&tab=flow&path=a~mixed&sel=node:talking&notes=1&names=0&screen=live`);
    expect(playerSearch(url)).toBe(`?${HOSTAGE}&certs=vehicle_operations&path=a~mixed&names=0&screen=live&frame=player`);
    expect(parse(playerSearch(url)).url).toMatchObject({ frame: 'player', path: 'a~mixed', names: false, screen: 'live', certs: ['vehicle_operations'] });
    expect(playerSearch(parse(`?lab&${HOSTAGE}`).url)).toBe(`?lab&${HOSTAGE}&frame=player`);
  });
});

describe('selections', () => {
  const all: Selection[] = [
    { kind: 'node', node: 'talking' },
    { kind: 'choice', node: 'offer', choice: 'take_courier' },
    { kind: 'band', node: 'offer', choice: 'take_courier', band: 'mixed' },
    { kind: 'ending', ending: 'owner_killed' },
    { kind: 'key', key: 'mark:terms' },
    { kind: 'string', row: 'offer.choices.take_courier.preview.mixed' },
    { kind: 'field', path: 'RESOLUTION_TUNING.bandTime.mixed' },
    { kind: 'finding', id: 'threat_only:mark:turned' },
  ];
  it('round-trip through text', () => {
    for (const sel of all) expect(parseSelection(selectionText(sel))).toEqual(sel);
  });
  it('round-trip through the URL', () => {
    for (const sel of all) {
      const url = parse(`?${HOSTAGE}`).url;
      const search = labUrlToSearch({ ...url, sel });
      expect(search).toContain(`&sel=${selectionText(sel)}`);
      expect(parse(search).url.sel).toEqual(sel);
    }
  });
  it('rejects malformed text', () => {
    for (const text of ['node:', 'choice:offer', 'band:offer/take/maybe', 'what:x', ':x']) expect(parseSelection(text)).toBeNull();
  });
});

describe('callKey', () => {
  const base = parse(`?${HOSTAGE}`).url;
  const key = (u: LabUrl) => callKey(u);
  it('changes with the draw, squad, grants, kit, handoff and replayed game moves', () => {
    const variants: Partial<LabUrl>[] = [
      { call: { ...base.call!, seed: 8 } }, { call: { ...base.call!, kit: 'full' } }, { squad: 1 }, { certs: ['vehicle_operations'] }, { handoff: 'n' },
      { hist: 't13_hostage_crisis_offer_hear_him~mixed' },
    ];
    for (const change of variants) expect(key({ ...base, ...change })).not.toBe(key(base));
  });
  it('reopens a hist-only link when "Use reference squad as is" clears hist (review finding callkey-omits-hist)', () => {
    const linked = parse('?id=gen:hostage_crisis:market_row:7:2:2:13&hist=t13_hostage_crisis_offer_hear_him~mixed').url;
    expect(linked.handoff).toBeNull();
    expect(key({ ...linked, handoff: null, hist: '' })).not.toBe(key(linked));
  });
  it('ignores the path, selection, surface and view toggles', () => {
    expect(key({ ...base, path: 'a~favorable', sel: { kind: 'node', node: 'x' }, tab: 'flow', xray: false, notes: true })).toBe(key(base));
  });
  it('is "none" with no call', () => {
    expect(callKey(parse('').url)).toBe('none');
  });
});

describe('compare instance B (vs)', () => {
  it('reads each draw field and writes the same link back', () => {
    const search = `?${HOSTAGE}&vs=family:market_row,seed:9,tier:3,kit:full,squad:42,certs:vehicle_operations~crisis_negotiation`;
    const { url, rewritten } = parse(search);
    expect(url.vs).toEqual({ family: 'market_row', seed: 9, tier: 3, kit: 'full', squad: 42, certs: ['vehicle_operations', 'crisis_negotiation'] });
    expect(rewritten).toBe(false);
    expect(labUrlToSearch(url)).toBe(search);
  });

  it('opens with nothing changed as vs=on, and is absent when closed', () => {
    expect(parse(`?${HOSTAGE}&vs=on`).url.vs).toEqual({});
    expect(canonical(`?${HOSTAGE}&vs=on`)).toBe(`?${HOSTAGE}&vs=on`);
    expect(parse(`?${HOSTAGE}`).url.vs).toBeNull();
  });

  it('drops unknown fields and bad values, and needs a call', () => {
    expect(parseVs('kit:gold,tier:9,colour:red,seed:x')).toEqual({ tier: 5 });
    expect(vsText({ kit: 'day1', tier: 2 })).toBe('tier:2,kit:day1');
    expect(parse('?vs=kit:full').url.vs).toBeNull();
  });

  it('leaves the true-device page out of the comparison', () => {
    expect(playerSearch(parse(`?${HOSTAGE}&vs=kit:full`).url)).not.toContain('vs=');
  });
});
