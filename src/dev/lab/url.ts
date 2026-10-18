// The lab's whole state lives in the query string (spec section 2.4). parseLabUrl reads it and
// rewrites links from the retired story sheet; labUrlToSearch writes it back with defaults left out
// and `: , ~ /` unescaped, so a shared link stays short and readable. The call draw itself still goes
// through readParams and paramsToQuery (model/call.ts), the one parser for those fields.
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import { parseIncidentId } from '../../gen/incident';
import type { Policy } from '../../gen/incident/trees-v13/balance';
import type { IncidentType } from '../../sim/scenario-types';
import type { OutcomeBand } from '../../sim/types';
import { isKit, paramsToQuery, readParams } from './model/call';
import type { CompareDraw, FrameScreen, LabCall, LabUrl, Scope, Selection, Surface, Vision } from './types';

export interface ParsedUrl { url: LabUrl; rewritten: boolean; notices: string[] }

export const SURFACES: readonly Surface[] = ['calls', 'play', 'flow', 'outcomes', 'deps', 'script', 'tuning'];
const STYLES: readonly Policy[] = ['random', 'best_odds', 'patient', 'fast'];
const SCOPES: readonly Scope[] = ['call', 'step', 'type'];
const SCREENS: readonly FrameScreen[] = ['card', 'brief', 'live', 'debrief'];
const VISIONS: readonly Vision[] = ['deutan', 'protan', 'tritan'];
const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

/** The reference squad: day-one squad A of this campaign seed (Singh, Aung, Vann, Moretti). */
export const REFERENCE_SQUAD = 719;

export const GATE_RETIRED_NOTICE = 'Gate review covered the retired typed frameworks and was retired. The lab covers the four call trees.';
export const OLD_LAB_NOTICE = 'The old lab was retired. This link opens the same call in the new lab.';
export const noTreeNotice = (type: string) => `${type} has no call tree. The lab covers barricaded, armed, hostage and rescue calls.`;

/** Old story sheet tabs and where each one lives now, with the params that recreate its view. */
const LEGACY_TABS: Record<string, { tab: Surface; set?: Record<string, string> }> = {
  run: { tab: 'play' },
  instance: { tab: 'play' },
  map: { tab: 'play', set: { screen: 'live' } },
  graph: { tab: 'flow', set: { mode: 'structure' } },
  choices: { tab: 'play' },
  writing: { tab: 'script' },
  balance: { tab: 'outcomes', set: { scope: 'type' } },
  notes: { tab: 'play', set: { notes: '1' } },
};

/** Every param that describes a call draw or a move through it. */
const CALL_KEYS = ['type', 'family', 'seed', 'variant', 'pacing', 'tier', 'call', 'id', 'kit', 'path', 'node'];

const isTreeType = (type: string | null): type is IncidentType => !!type && !!INCIDENT_TEMPLATES[type as IncidentType];
const pick = <T extends string>(value: string | null, options: readonly T[]): T | null => options.includes(value as T) ? value as T : null;
const list = (value: string | null): string[] => (value ?? '').split(',').map(part => part.trim()).filter(Boolean);
const int = (value: string | null, lo: number, hi: number): number | null => {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.floor(n))) : null;
};

/** Applies the legacy table in place (spec 2.4). True when anything changed. */
function applyLegacy(q: URLSearchParams, notices: string[]): boolean {
  let changed = false;
  // `legacy=1` opened the old lab; its own old params below map onto the new surfaces like any other.
  if (q.has('legacy')) { q.delete('legacy'); notices.push(OLD_LAB_NOTICE); changed = true; }
  const view = q.get('view');
  if (view === 'gates' || (!view && q.has('journeys'))) {
    // Gate review read typed framework packages, never a call tree, so none of its params carry over.
    for (const key of [...CALL_KEYS, 'view', 'journeys', 'tab']) q.delete(key);
    q.set('tab', 'calls');
    notices.push(GATE_RETIRED_NOTICE);
    return true;
  }
  if (view !== null) { q.delete('view'); changed = true; }
  if (q.has('journeys')) { q.delete('journeys'); changed = true; }
  const legacyTab = LEGACY_TABS[q.get('tab') ?? ''];
  if (legacyTab) {
    q.set('tab', legacyTab.tab);
    for (const [key, value] of Object.entries(legacyTab.set ?? {})) if (!q.has(key)) q.set(key, value);
    changed = true;
  }
  const type = q.get('type');
  if (type && !q.get('id') && !isTreeType(type)) {
    for (const key of CALL_KEYS) q.delete(key);
    q.set('tab', 'calls');
    notices.push(noTreeNotice(type));
    changed = true;
  }
  return changed;
}

/** The call draw from the query: readParams, with the type limited to the four call trees and the
 * building to the families that tree fits. An `id` wins over every other field. */
function parseCall(q: URLSearchParams): LabCall | null {
  const id = q.get('id');
  const type = q.get('type');
  if (!id && !isTreeType(type)) return null;
  const raw = readParams(q);
  let call: LabCall = { type: raw.type, family: raw.family, seed: raw.seed, variant: raw.variant, pacing: raw.pacing, tier: raw.tier, call: raw.call, id: raw.id, kit: raw.kit };
  if (id) {
    // Only the id is written back; the parsed fields let the shell name the call before it opens.
    const spec = parseIncidentId(id);
    if (spec) call = { ...call, type: spec.type, family: spec.familyId, seed: spec.buildingSeed, tier: spec.tier, call: spec.seed };
    return call;
  }
  const families = INCIDENT_TEMPLATES[call.type]!.tree.families;
  if (!families.includes(q.get('family') ?? '')) call.family = families[0];
  return call;
}

/** The default draw of a call type, the one `/lab?type=<type>` opens. */
export function defaultCall(type: IncidentType): LabCall {
  return parseCall(new URLSearchParams({ type }))!;
}

export function parseSelection(text: string | null): Selection | null {
  if (!text) return null;
  const at = text.indexOf(':');
  if (at <= 0) return null;
  const kind = text.slice(0, at), rest = text.slice(at + 1);
  if (!rest) return null;
  const parts = rest.split('/');
  switch (kind) {
    case 'node': return { kind, node: rest };
    case 'ending': return { kind, ending: rest };
    case 'key': return { kind, key: rest };
    case 'string': return { kind, row: rest };
    case 'field': return { kind, path: rest };
    case 'finding': return { kind, id: rest };
    case 'choice': return parts.length === 2 && parts[0] && parts[1] ? { kind, node: parts[0], choice: parts[1] } : null;
    case 'band': {
      const band = pick(parts[2] ?? null, BANDS);
      return parts.length === 3 && parts[0] && parts[1] && band ? { kind, node: parts[0], choice: parts[1], band } : null;
    }
    default: return null;
  }
}

export function selectionText(sel: Selection): string {
  switch (sel.kind) {
    case 'node': return `node:${sel.node}`;
    case 'choice': return `choice:${sel.node}/${sel.choice}`;
    case 'band': return `band:${sel.node}/${sel.choice}/${sel.band}`;
    case 'ending': return `ending:${sel.ending}`;
    case 'key': return `key:${sel.key}`;
    case 'string': return `string:${sel.row}`;
    case 'field': return `field:${sel.path}`;
    case 'finding': return `finding:${sel.id}`;
  }
}

/** The surface a URL with no `tab` opens: Play when a call is in focus, else the Calls landing. */
export const defaultTab = (call: LabCall | null): Surface => call ? 'play' : 'calls';

/** Instance B of the compare view: `vs=kit:none,family:market_row,seed:9,tier:3,squad:12,certs:a~b`.
 * Unknown fields are dropped; `vs=on` (or any text with no field) opens the view with nothing changed
 * yet, read back as an empty draw. Null when the param is absent. */
export function parseVs(text: string | null): CompareDraw | null {
  if (text === null) return null;
  const draw: CompareDraw = {};
  for (const part of list(text)) {
    const at = part.indexOf(':');
    if (at <= 0) continue;
    const key = part.slice(0, at), value = part.slice(at + 1);
    if (key === 'family' && value) draw.family = value;
    else if (key === 'kit' && isKit(value)) draw.kit = value;
    else if (key === 'seed') { const n = int(value, 0, 0xffffffff); if (n !== null) draw.seed = n; }
    else if (key === 'tier') { const n = int(value, 1, 5); if (n !== null) draw.tier = n; }
    else if (key === 'squad') { const n = int(value, 0, 0xffffffff); if (n !== null) draw.squad = n; }
    else if (key === 'certs') draw.certs = value.split(/[~+ ]/).map(cert => cert.trim()).filter(Boolean);
  }
  return draw;
}

/** The `vs` param for a draw, fields in a fixed order; `on` for an empty draw. */
export function vsText(draw: CompareDraw): string {
  const parts: string[] = [];
  if (draw.family !== undefined) parts.push(`family:${draw.family}`);
  if (draw.seed !== undefined) parts.push(`seed:${draw.seed}`);
  if (draw.tier !== undefined) parts.push(`tier:${draw.tier}`);
  if (draw.kit !== undefined) parts.push(`kit:${draw.kit}`);
  if (draw.squad !== undefined) parts.push(`squad:${draw.squad}`);
  if (draw.certs !== undefined) parts.push(`certs:${draw.certs.join('~')}`);
  return parts.length ? parts.join(',') : 'on';
}

function readUrl(q: URLSearchParams): LabUrl {
  const call = parseCall(q);
  return {
    tab: pick(q.get('tab'), SURFACES) ?? defaultTab(call),
    call,
    squad: int(q.get('squad'), 0, 0xffffffff) ?? REFERENCE_SQUAD,
    certs: list(q.get('certs')),
    handoff: q.get('handoff') || null,
    hist: q.get('hist') ?? '',
    path: call ? q.get('path') ?? '' : '',
    node: call ? q.get('node') || null : null,
    sel: parseSelection(q.get('sel')),
    scope: pick(q.get('scope'), SCOPES) ?? 'call',
    style: pick(q.get('style'), STYLES) ?? 'random',
    runs: int(q.get('runs'), 1, 1_000_000),
    xray: q.get('x') !== '0',
    names: q.get('names') !== '0',
    truth: q.get('truth') === '1',
    screen: pick(q.get('screen'), SCREENS),
    dice: q.get('dice') === 'force' ? 'force' : 'roll',
    width: q.get('w') === '430' ? 430 : 390,
    zoom: q.get('zoom') === '1' ? '1' : 'fit',
    flow: {
      mode: pick(q.get('mode'), ['reach', 'structure', 'state'] as const) ?? 'reach',
      color: q.get('color') === 'fate' ? 'fate' : 'band',
      pruned: q.get('pruned') === '1',
      expanded: list(q.get('exp')),
    },
    vision: pick(q.get('vision'), VISIONS),
    tuning: { group: q.get('grp') || 'odds', advanced: q.get('adv') === '1' },
    filter: q.get('f') ?? '',
    notes: q.get('notes') === '1',
    frame: q.get('frame') === 'player' ? 'player' : null,
    labAlias: q.has('lab'),
    vs: call ? parseVs(q.get('vs')) : null,
  };
}

/** Keep IDs, paths and selections readable in a shared link; none of these need escaping in a query. */
const readable = (text: string) => text.replace(/%3A/gi, ':').replace(/%2C/gi, ',').replace(/%7E/gi, '~').replace(/%2F/gi, '/');

/** The canonical query for a URL: defaults left out, `lab` kept bare and first. */
export function labUrlToSearch(u: LabUrl): string {
  const out: [string, string][] = [];
  const put = (key: string, value: string | null | undefined, skip?: boolean) => { if (value !== null && value !== undefined && value !== '' && !skip) out.push([key, value]); };
  if (u.call) for (const [key, value] of Object.entries(paramsToQuery({ ...u.call, path: '' }))) put(key, value);
  put('squad', String(u.squad), u.squad === REFERENCE_SQUAD);
  put('certs', u.certs.join(','));
  put('handoff', u.handoff);
  put('hist', u.hist);
  put('tab', u.tab, u.tab === defaultTab(u.call));
  if (u.call) { put('path', u.path); put('node', u.node); }
  put('sel', u.sel && selectionText(u.sel));
  put('scope', u.scope, u.scope === 'call');
  put('style', u.style, u.style === 'random');
  put('runs', u.runs === null ? null : String(u.runs));
  put('x', '0', u.xray);
  put('names', '0', u.names);
  put('truth', '1', !u.truth);
  put('screen', u.screen);
  put('dice', u.dice, u.dice === 'roll');
  put('w', String(u.width), u.width === 390);
  put('zoom', u.zoom, u.zoom === 'fit');
  put('mode', u.flow.mode, u.flow.mode === 'reach');
  put('color', u.flow.color, u.flow.color === 'band');
  put('pruned', '1', !u.flow.pruned);
  put('exp', u.flow.expanded.join(','));
  put('vision', u.vision);
  put('grp', u.tuning.group, u.tuning.group === 'odds');
  put('adv', '1', !u.tuning.advanced);
  put('f', u.filter);
  put('notes', '1', !u.notes);
  put('frame', u.frame);
  if (u.call) put('vs', u.vs && vsText(u.vs));
  const query = readable(new URLSearchParams(out).toString());
  const search = u.labAlias ? (query ? `lab&${query}` : 'lab') : query;
  return search ? `?${search}` : '';
}

export function parseLabUrl(search: string): ParsedUrl {
  const q = new URLSearchParams(search);
  const notices: string[] = [];
  const legacy = applyLegacy(q, notices);
  const url = readUrl(q);
  const given = search.startsWith('?') ? search : search ? `?${search}` : '';
  return { url, rewritten: legacy || labUrlToSearch(url) !== given, notices };
}

/** The true-device page for a lab URL (`frame=player`, spec 10.4): the same call, squad, path,
 * screen and switches; no selection, drawer or tab, which that page doesn't draw. */
export function playerSearch(u: LabUrl): string {
  return labUrlToSearch({ ...u, frame: 'player', tab: defaultTab(u.call), notes: false, sel: null, node: null, vs: null });
}

/** What makes a call different: the draw, the squad and its lab grants, the kit, a handoff, and the
 * game's moves a link replays when its snapshot is gone (`hist`, which sets where the path starts). */
export function callKey(u: LabUrl): string {
  if (!u.call) return 'none';
  return JSON.stringify([paramsToQuery({ ...u.call, path: '' }), u.squad, u.certs, u.handoff, u.hist]);
}
