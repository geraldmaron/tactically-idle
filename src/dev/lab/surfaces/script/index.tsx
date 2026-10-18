// Script (spec 3.6): every line of the call in the order the player meets it, set in a phone-width
// column with the game's text sizes and people colors, bound for one variant of the draw (pronouns,
// group sizes, situation, turn, and twelve casts plus the longest names the CLI checks bind). What
// changed since the last variant or since a pinned baseline is marked word by word; the swat-call-
// prose checker runs through the dev server and its findings land on their lines; the people-name
// audit holds the game's matcher to the binder across the twelve casts. Logic lives in
// model/script.ts and model/notes.ts; this file wires it.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import type { CallTree, TreeState } from '../../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import { choiceActionId } from '../../../../gen/incident/trees-v13/compile';
import { requirementTree, roleNoun } from '../../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, ReqTarget, StateKey } from '../../../../gen/incident/trees-v13/dependencies';
import { callStringRows, parseFindings, toTsv } from '../../../../gen/incident/trees-v13/strings';
import type { StringFinding, StringRow } from '../../../../gen/incident/trees-v13/strings';
import { segmentPeople } from '../../../../ui/people/lexicon';
import type { Lexicon } from '../../../../ui/people/lexicon';
import { PeopleGlyph } from '../../../../ui/people/PeopleText';
import { peopleLabel } from '../../../../ui/people/lexicon';
import { useLab } from '../../context';
import type { Goal, CastSample } from '../../jobs/protocol';
import { castSample } from '../../jobs/runners';
import { contentKey } from '../../model/call';
import { runStringChecks } from '../../model/endpoints';
import { anchorCovers, pinRow } from '../../model/notes';
import {
  bindRows, castFor, castWords, changedRows, checkSummary, goneRows, groupSizes, lexiconForCast, longestSample, matcherAudit, PRONOUN_SETS, sampleFor,
  scriptSections, variantKey, variantRows, variantSpace,
} from '../../model/script';
import type { AuditHit, ScriptRow, ScriptSection, Variant } from '../../model/script';
import { sessionBinder } from '../../model/session';
import type { Session } from '../../model/session';
import { diffStrings, loadSnapshot, pinLabel, saveSnapshot, SNAPSHOT_PREFIX, takeSnapshot } from '../../model/snapshots';
import { goalFor } from '../../model/why';
import type { ReviewNote } from '../../types';
import { cx, Glyph, SegmentedControl } from '../../viz';
import { callNames, rowLabel } from '../review/labels';
import type { CallNames } from '../review/labels';
import './script.css';

type Show = 'all' | 'variant' | 'baseline' | 'flagged' | 'notes';
const BAND_WORDS = { favorable: 'Goes well', mixed: 'Complications', adverse: 'Goes badly' } as const;
const BAND_TONE = { favorable: 'well', mixed: 'mixed', adverse: 'badly' } as const;
const PRONOUN_LABEL: Record<Variant['pronouns'], string> = { drawn: 'As drawn', he: 'He', she: 'She', they: 'They' };
/** Casts in the carousel: the call in focus, then eleven more drawn by the casts job. */
const CASTS = 12;
const READ_KEY = (type: string) => `ti-lab-script-read:${type}`;
const SHOW_KEY = 'ti-lab-script-show';

/** Machado 2009 color-vision matrices, severity 1.0, linear RGB (design/contrast.mjs). */
const VISION: Record<'deutan' | 'protan' | 'tritan', number[][]> = {
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const VISION_LABEL = { deutan: 'Deuteranopia', protan: 'Protanopia', tritan: 'Tritanopia' } as const;

function readSet(type: string): Set<string> {
  try { const value: unknown = JSON.parse(sessionStorage.getItem(READ_KEY(type)) ?? '[]'); return new Set(Array.isArray(value) ? value.map(String) : []); } catch { return new Set(); }
}
function writeSet(type: string, set: Set<string>) {
  try { sessionStorage.setItem(READ_KEY(type), JSON.stringify([...set])); } catch { /* blocked storage: the count lasts for this page */ }
}

export default function ScriptSurface() {
  const { url, call } = useLab();
  const template = url.call ? INCIDENT_TEMPLATES[url.call.type] : undefined;
  if (!template) return <p className="lab-script-empty">This call type has no call tree, so it has no script.</p>;
  if (call.status !== 'ready') return <p className="lab-script-empty">{call.status === 'error' ? 'The call didn’t open, so there is nothing to bind the script to.' : 'Building the call…'}</p>;
  return <Script template={template} session={call.session} />;
}

interface Checks { status: 'running' | 'done' | 'unavailable' | 'error'; variant: string; findings: Map<string, StringFinding[]>; summary: string[]; stderr: string; code: number }

function Script({ template, session }: { template: IncidentTemplate; session: Session }) {
  const { url, navigate, jobs, tuning, notes, dev, deps, playHere } = useLab();
  const tree = template.tree;
  const type = template.type;
  const names = useMemo(() => callNames(template, sessionBinder(session)), [template, session]);

  // ------------------------------------------------ casts: the call in focus first, then the casts job
  const spec = session.resolved.spec!;
  const own = useMemo(() => { try { return castSample(spec.type, spec.familyId, spec.buildingSeed, spec.tier, spec.seed); } catch { return null; } }, [session.key]);
  const [drawn, setDrawn] = useState<{ key: string; casts: CastSample[] } | null>(null);
  const castKey = `${type}|${spec.familyId}|${spec.buildingSeed}|${spec.tier}|${session.situation}`;
  useEffect(() => {
    const handle = jobs.run({ kind: 'casts', type, family: spec.familyId, seed: spec.buildingSeed, tier: spec.tier, variant: session.situation, n: CASTS },
      { patch: tuning.patch, contentKey: session.contentKey, cache: 'memory' });
    let live = true;
    handle.promise.then(result => { if (live && result.kind === 'casts') setDrawn({ key: castKey, casts: result.casts }); }, () => { /* the carousel keeps the call in focus */ });
    return () => { live = false; };
  }, [castKey]);
  const casts = useMemo(() => {
    const list = own ? [own] : [];
    for (const sample of drawn?.key === castKey ? drawn.casts : []) if (list.length < CASTS && !list.some(entry => entry.call === sample.call)) list.push(sample);
    return list;
  }, [own, drawn, castKey]);
  const longest = useMemo(() => longestSample(template), [template]);

  // ------------------------------------------------ the variant
  const callVariant = (): Variant => ({ pronouns: 'drawn', counts: { ...session.counts }, situation: session.situation, turns: { ...session.turnDrawn }, cast: 0 });
  const [state, setState] = useState<{ for: string; v: Variant; prev: Variant | null }>(() => ({ for: session.key, v: callVariant(), prev: null }));
  const current = state.for === session.key ? state : { for: session.key, v: callVariant(), prev: null };
  useEffect(() => { if (state.for !== session.key) setState(current); }, [session.key]);
  const v = current.v;
  const setVariant = (patch: Partial<Variant>) => setState(s => ({ for: session.key, v: { ...(s.for === session.key ? s.v : callVariant()), ...patch }, prev: s.for === session.key ? s.v : null }));

  const space = useMemo(() => variantSpace(tree, template, 0), [tree, template]);
  const [read, setRead] = useState(() => readSet(type));
  useEffect(() => {
    const key = variantKey(v);
    setRead(prev => { if (prev.has(key)) return prev; const next = new Set(prev); next.add(key); writeSet(type, next); return next; });
  }, [variantKey(v), type]);
  useEffect(() => setRead(readSet(type)), [type]);
  const sweep = () => {
    const at = space.findIndex(entry => variantKey(entry) === variantKey(v));
    const next = space[(at + 1) % space.length];
    setVariant({ pronouns: next.pronouns, counts: next.counts, situation: next.situation, turns: next.turns });
  };

  // ------------------------------------------------ rows
  const raw = useMemo(() => variantRows(tree, v), [tree, v.situation, JSON.stringify(v.counts), JSON.stringify(v.turns)]);
  const sample = sampleFor(v, casts, longest);
  const bound = useMemo(() => castFor(tree, sample, v), [tree, sample, v.pronouns, JSON.stringify(v.counts)]);
  const rows = useMemo(() => bindRows(raw, bound), [raw, bound]);
  const lex = useMemo(() => (url.names ? lexiconForCast(tree, bound) : null), [tree, bound, url.names]);
  const prevRows = useMemo(() => {
    const p = current.prev;
    if (!p) return null;
    return bindRows(variantRows(tree, p), castFor(tree, sampleFor(p, casts, longest), p));
  }, [current.prev, tree, casts, longest]);
  const changed = useMemo(() => (prevRows ? changedRows(prevRows, rows) : new Map<string, [number, number][]>()), [prevRows, rows]);
  const gone = useMemo(() => (prevRows ? goneRows(prevRows, rows) : []), [prevRows, rows]);

  // ------------------------------------------------ baseline (bound as the call in focus, every situation)
  const ownBound = useMemo(() => (own ? castFor(tree, own, { pronouns: 'drawn', counts: session.counts }) : null), [tree, own, session.counts]);
  const callRows = useMemo(() => (ownBound ? bindRows(callStringRows(tree, text => text, session.counts), ownBound) : []), [tree, ownBound, session.counts]);
  const [baseline, setBaseline] = useState(() => loadSnapshot(type));
  useEffect(() => setBaseline(loadSnapshot(type)), [type]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === SNAPSHOT_PREFIX + type) setBaseline(loadSnapshot(type)); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [type]);
  const sinceBase = useMemo(() => (baseline ? diffStrings(baseline, callRows.map(row => ({ ...row.row, text: row.text }))) : null), [baseline, callRows]);
  const pin = () => {
    const snapshot = takeSnapshot(session, callRows.map(row => ({ ...row.row, text: row.text })));
    if (saveSnapshot(snapshot)) setBaseline(snapshot);
  };
  const unpin = () => { try { localStorage.removeItem(SNAPSHOT_PREFIX + type); } catch { /* nothing stored */ } setBaseline(null); };
  const contentNow = contentKey(type);

  // ------------------------------------------------ the audit, across the twelve casts
  const audit = useMemo(() => {
    const byRow = new Map<string, (AuditHit & { cast: number; kind: 'missed' | 'false' })[]>();
    let missed = 0, falseMatches = 0;
    casts.forEach((entry, i) => {
      const b = castFor(tree, entry, v);
      const lexicon = lexiconForCast(tree, b);
      const result = matcherAudit(bindRows(raw, b), () => lexicon);
      missed += result.missed.length; falseMatches += result.falseMatches.length;
      for (const hit of result.missed) byRow.set(hit.key, [...byRow.get(hit.key) ?? [], { ...hit, cast: i, kind: 'missed' }]);
      for (const hit of result.falseMatches) byRow.set(hit.key, [...byRow.get(hit.key) ?? [], { ...hit, cast: i, kind: 'false' }]);
    });
    return { missed, falseMatches, byRow, casts: casts.length };
  }, [casts, raw, tree, v.pronouns, JSON.stringify(v.counts)]);

  // ------------------------------------------------ string checks (dev server)
  const [checks, setChecks] = useState<Checks | null>(null);
  const runChecks = async () => {
    const key = variantKey(v) + `|${v.cast}`;
    setChecks({ status: 'running', variant: key, findings: new Map(), summary: [], stderr: '', code: 0 });
    const strings = rows.filter(row => !row.error).map(row => ({ ...row.row, text: row.text }));
    try {
      const result = await runStringChecks(toTsv(strings), castWords(bound));
      if ('unavailable' in result) { setChecks({ status: 'unavailable', variant: key, findings: new Map(), summary: [], stderr: '', code: -1 }); return; }
      const parsed = parseFindings(result.stdout, strings);
      const findings = new Map<string, StringFinding[]>();
      for (const finding of parsed.findings) findings.set(finding.where, [...findings.get(finding.where) ?? [], finding]);
      setChecks({ status: result.code < 0 ? 'error' : 'done', variant: key, findings, summary: parsed.summary, stderr: result.stderr, code: result.code });
    } catch (error) {
      setChecks({ status: 'error', variant: key, findings: new Map(), summary: [], stderr: error instanceof Error ? error.message : String(error), code: -1 });
    }
  };
  const checksHere = checks && checks.variant === variantKey(v) + `|${v.cast}` ? checks : null;
  const findingsOf = (row: ScriptRow) => checksHere?.findings.get(row.row.where) ?? [];
  const checkable = dev.available === true && dev.python !== false;

  // ------------------------------------------------ notes, flags, selection
  const notesOn = (row: ScriptRow) => notes.file.notes.filter(note => anchorCovers(note.anchor, row.row.where));
  const pinsOn = (row: ScriptRow) => notes.file.notes.filter(note => pinRow(note.anchor) === row.row.where);
  const flagged = (row: ScriptRow) => !!row.error || findingsOf(row).length > 0 || audit.byRow.has(row.key);
  const selKey = url.sel?.kind === 'string' ? url.sel.row : null;
  const selectRow = (row: ScriptRow) => navigate({ sel: { kind: 'string', row: row.key } });

  // The filter is a per-viewer convenience: kept for this tab, so it survives the reload a content edit causes.
  const [show, setShowState] = useState<Show>(() => { try { const kept = sessionStorage.getItem(SHOW_KEY); return (['all', 'variant', 'baseline', 'flagged', 'notes'] as const).find(entry => entry === kept) ?? 'all'; } catch { return 'all'; } });
  const setShow = (next: Show) => { setShowState(next); try { sessionStorage.setItem(SHOW_KEY, next); } catch { /* blocked storage: lasts for this page */ } };
  const sinceRows = useMemo(() => callRows.filter(row => sinceBase?.has(row.key)), [callRows, sinceBase]);
  const visible = (row: ScriptRow): boolean => show === 'all' ? true : show === 'variant' ? changed.has(row.key)
    : show === 'flagged' ? flagged(row) : show === 'notes' ? notesOn(row).length > 0 : true;
  const shownRows = show === 'baseline' ? sinceRows : rows.filter(visible);
  // Filtered views keep each choice's title as dim context, so a changed line still says whose it is.
  const baseRows = show === 'baseline' ? callRows : rows;
  const shownKeys = useMemo(() => new Set(shownRows.map(row => row.key)), [shownRows]);
  const sections = useMemo(() => scriptSections(tree, baseRows, names.node)
    .map(section => ({ ...section, choices: section.choices.filter(choice => [choice.title, choice.summary, ...choice.modifiers, ...choice.bands.flatMap(band => [band.preview, ...band.outcomes])].some(row => row && shownKeys.has(row.key))) }))
    .filter(section => section.rows.some(row => shownKeys.has(row.key))), [tree, baseRows, shownKeys, names]);
  // Changed words are marked where the view is about change; "All" stays clean to read.
  const marksOf = (row: ScriptRow): [number, number][] | undefined => show === 'baseline' ? sinceBase?.get(row.key)?.words : show === 'variant' ? changed.get(row.key) : undefined;

  const selected = (selKey ? rows.find(row => row.key === selKey || row.row.where === selKey.replace(/@s\d$/, '')) ?? callRows.find(row => row.key === selKey) : null) ?? null;
  const columnRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selKey) columnRef.current?.querySelector(`[data-row="${CSS.escape(selKey)}"]`)?.scrollIntoView({ block: 'nearest' }); }, [selKey, show]);

  const counts = {
    variant: changed.size, baseline: sinceBase?.size ?? 0, flagged: rows.filter(flagged).length, notes: rows.filter(row => notesOn(row).length > 0).length,
  };
  const sizes = groupSizes(template);
  const castName = (i: number) => i < 0 ? 'Longest names' : i === 0 ? 'This call' : `Call seed ${casts[i]?.call ?? '?'}`;
  const vision = url.vision;

  return (
    <div className="lab-script">
      <svg className="lab-script-defs" width="0" height="0" aria-hidden="true">
        <defs>
          {(Object.keys(VISION) as (keyof typeof VISION)[]).map(id => (
            <filter key={id} id={`lab-vision-${id}`} colorInterpolationFilters="linearRGB">
              <feColorMatrix type="matrix" values={VISION[id].map(row => `${row.join(' ')} 0 0`).join(' ') + ' 0 0 0 1 0'} />
            </filter>
          ))}
        </defs>
      </svg>

      <header className="lab-script-bar" aria-label="Variant">
        <div className="lab-script-bar-row">
          <div className="lab-script-cast" role="group" aria-label="Cast">
            <span className="lab-field-label">Cast</span>
            <button type="button" className="lab-icon-button" aria-label="Previous cast" disabled={v.cast <= 0 || casts.length < 2} onClick={() => setVariant({ cast: Math.max(0, v.cast - 1) })}><Glyph name="caret" size={13} className="lab-script-left" /></button>
            <span className="lab-script-cast-n" aria-live="polite">{v.cast < 0 ? 'Longest names' : <><b>{v.cast + 1}</b> of {casts.length}{casts.length < CASTS ? <span className="lab-muted"> (drawing {CASTS - casts.length} more)</span> : null}</>}</span>
            <button type="button" className="lab-icon-button" aria-label="Next cast" disabled={v.cast < 0 ? false : v.cast >= casts.length - 1} onClick={() => setVariant({ cast: v.cast < 0 ? 0 : v.cast + 1 })}><Glyph name="caret" size={13} className="lab-script-right" /></button>
            <span className="lab-script-cast-name" title={sample.place}>{castName(v.cast)}</span>
            <button type="button" className={cx('lab-button', 'lab-button-quiet', v.cast < 0 && 'lab-script-on')} aria-pressed={v.cast < 0}
              title="The names npm run check:strings binds: the longest in the pools, singular they" onClick={() => setVariant({ cast: v.cast < 0 ? 0 : -1 })}>Longest names</button>
          </div>
          <div className="lab-script-ctl">
            <span className="lab-field-label">Pronouns</span>
            <SegmentedControl label="Pronouns" size="small" value={v.pronouns} onChange={pronouns => setVariant({ pronouns })} options={PRONOUN_SETS.map(value => ({ value, label: PRONOUN_LABEL[value] }))} />
          </div>
          {Object.entries(sizes).map(([group, list]) => (
            <div key={group} className="lab-script-ctl">
              <span className="lab-field-label" title={tree.groups?.[group]?.label}>{group.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())}</span>
              <SegmentedControl label={`Group size, ${group}`} size="small" value={v.counts[group] ?? 0} onChange={n => setVariant({ counts: { ...v.counts, [group]: n } })}
                options={list.map(n => ({ value: n, label: String(n) }))} />
            </div>
          ))}
          <div className="lab-script-ctl">
            <span className="lab-field-label">Situation</span>
            <SegmentedControl label="Situation" size="small" value={v.situation} onChange={situation => setVariant({ situation })} options={([0, 1, 2] as const).map(i => ({ value: i, label: String(i + 1), title: tree.situations[i].note }))} />
          </div>
          {Object.entries(tree.turns ?? {}).map(([group, members]) => (
            <label key={group} className="lab-script-ctl">
              <span className="lab-field-label">Turn</span>
              <select className="lab-input lab-script-select" value={v.turns[group] ?? members[0]} onChange={event => setVariant({ turns: { ...v.turns, [group]: event.target.value } })}>
                {members.map(member => <option key={member} value={member}>{names.node(member)}</option>)}
              </select>
            </label>
          ))}
          <div className="lab-script-sweep">
            <button type="button" className="lab-button" onClick={sweep} title="Step to the next combination of pronouns, group size, situation and turn"><Glyph name="play" size={10} />Next variant</button>
            <span className="lab-script-read" title="Combinations of pronouns, group size, situation and turn read in this tab">Variants read <b>{[...read].filter(key => space.some(entry => variantKey(entry) === key)).length}</b> of {space.length}</span>
          </div>
        </div>
        <div className="lab-script-bar-row">
          <div className="lab-script-ctl">
            <span className="lab-field-label">Show</span>
            <SegmentedControl label="Show" size="small" value={show} onChange={setShow} options={[
              { value: 'all', label: <>All <span className="lab-script-n">{rows.length}</span></> },
              { value: 'variant', label: <>Changed in this variant <span className="lab-script-n">{counts.variant}</span></>, title: current.prev ? 'Lines that read differently from the previous variant' : 'Change a control to compare' },
              { value: 'baseline', label: <>Changed since baseline <span className="lab-script-n">{baseline ? counts.baseline : '–'}</span></>, disabled: !baseline, title: baseline ? 'Lines that differ from the pinned baseline, bound as this call' : 'Pin a baseline first' },
              { value: 'flagged', label: <>Flagged <span className="lab-script-n">{counts.flagged}</span></> },
              { value: 'notes', label: <>Has notes <span className="lab-script-n">{counts.notes}</span></> },
            ]} />
          </div>
          <div className="lab-script-ctl">
            <span className="lab-field-label">Baseline</span>
            {baseline ? <>
              <span className="lab-script-base" title={baseline.label}>{pinLabel(baseline.at)}{baseline.contentKey !== contentNow ? <span className="lab-script-base-moved"> · content changed since</span> : null}</span>
              <button type="button" className="lab-button lab-button-quiet" onClick={pin}>Re-pin</button>
              <button type="button" className="lab-button lab-button-quiet" onClick={unpin}>Clear</button>
            </> : <button type="button" className="lab-button lab-button-quiet" onClick={pin} title="Keep this call’s lines as they read now, to compare after an edit">Pin baseline</button>}
          </div>
          <div className="lab-script-ctl">
            <span className="lab-field-label">Checks</span>
            <button type="button" className="lab-button lab-button-quiet" onClick={() => void runChecks()} disabled={!checkable || checksHere?.status === 'running'}
              title={checkable ? 'Run the swat-call-prose string checker on these lines' : 'String checks need the dev server and python3. Run npm run check:strings locally.'}>
              {checksHere?.status === 'running' ? 'Checking…' : 'Run checks'}
            </button>
            {checksHere?.status === 'done' && <span className="lab-script-checked">{checkSummary([...checksHere.findings.values()].flat().length, checksHere.findings.size)}</span>}
          </div>
          <div className="lab-script-ctl">
            <span className="lab-field-label">Vision</span>
            <select className="lab-input lab-script-select" value={vision ?? ''} onChange={event => navigate({ vision: (event.target.value || null) as typeof vision }, 'replace')} aria-label="Color vision">
              <option value="">Typical</option>
              {(Object.keys(VISION_LABEL) as (keyof typeof VISION_LABEL)[]).map(id => <option key={id} value={id}>{VISION_LABEL[id]}</option>)}
            </select>
          </div>
          <span className={cx('lab-script-audit', audit.missed + audit.falseMatches > 0 && 'lab-script-audit-bad')} title="The game's people matcher against the binder, every line of this variant, each cast">
            <Glyph name={audit.missed + audit.falseMatches > 0 ? 'warn' : 'names'} size={13} />
            Matcher audit: {audit.missed} missed · {audit.falseMatches} false {audit.falseMatches === 1 ? 'match' : 'matches'} across {audit.casts} {audit.casts === 1 ? 'cast' : 'casts'}
          </span>
        </div>
        {checks?.status === 'unavailable' && <p className="lab-script-note">String checks need the dev server and python3. Run <code>npm run check:strings</code> locally.</p>}
        {checksHere?.status === 'error' && <details className="lab-script-note"><summary>The checker stopped (exit {checksHere.code}).</summary><pre>{checksHere.stderr}</pre></details>}
      </header>

      <div className="lab-script-body">
        <nav className="lab-script-outline" aria-label="Sections">
          {sections.map(section => (
            <button key={section.id} type="button" className="lab-script-toc" onClick={() => columnRef.current?.querySelector(`[data-section="${section.id}"]`)?.scrollIntoView({ block: 'start' })}>
              <span className="lab-script-toc-title">{section.title}</span>
              {section.stage && <span className="lab-script-toc-stage">{tree.stageLabels[section.stage] ?? section.stage}</span>}
              <span className="lab-script-toc-n">{section.rows.filter(row => shownKeys.has(row.key)).length}</span>
              {section.rows.some(flagged) && <Glyph name="warn" size={11} className="lab-script-toc-flag" />}
              {section.rows.some(row => pinsOn(row).length) && <Glyph name="note" size={11} className="lab-script-toc-pin" />}
            </button>
          ))}
        </nav>

        <div className="lab-script-stage" ref={columnRef}>
          {show === 'variant' && !current.prev && <p className="lab-script-hint">Change the pronouns, a group size, the situation, the turn or the cast: the lines that read differently show here, the changed words marked.</p>}
          {show === 'variant' && gone.length > 0 && <p className="lab-script-hint">{gone.length} {gone.length === 1 ? 'line' : 'lines'} from the previous variant {gone.length === 1 ? 'doesn’t' : 'don’t'} show in this one.</p>}
          {show === 'baseline' && <p className="lab-script-hint">Bound as this call ({sample.place}), in every situation. {sinceBase && [...sinceBase.values()].some(entry => !entry.after) ? `${[...sinceBase.values()].filter(entry => !entry.after).length} baseline lines are gone.` : ''}</p>}
          {sections.length === 0 && <p className="lab-script-hint">{show === 'variant' ? (current.prev ? 'No line reads differently between these two variants.' : '') : show === 'baseline' ? 'No line differs from the baseline.' : 'Nothing to show with this filter.'}</p>}
          <div className={cx('lab-script-col', vision && 'lab-script-col-vision')} style={vision ? { filter: `url(#lab-vision-${vision})` } : undefined}>
            {sections.map(section => (
              <ScriptSectionView key={section.id} section={section} tree={tree} deps={deps} names={names} lex={lex} selKey={selKey} marksOf={marksOf} shown={shownKeys}
                onSelect={selectRow} findingsOf={findingsOf} audit={audit.byRow} pinsOn={pinsOn} />
            ))}
          </div>
        </div>

        <aside className="lab-script-inspector" aria-label="Line">
          {selected ? <Inspector row={selected} tree={tree} names={names} lex={lex} prevRows={prevRows} changed={changed.get(selected.key)} since={sinceBase?.get(selected.key) ?? null}
            findings={findingsOf(selected)} audit={audit.byRow.get(selected.key) ?? []} notesOn={notesOn(selected)} castName={castName}
            onNote={() => navigate({ notes: true }, 'replace')} onPlay={goal => playHere(goal)} onPlayScreen={screen => navigate({ tab: 'play', screen })}
            onWhy={() => navigate({ tab: 'deps', sel: { kind: 'string', row: selected.key } })} onFlow={node => navigate({ tab: 'flow', sel: { kind: 'node', node } })} />
            : <div className="lab-script-pick"><Glyph name="row" size={16} /><p>Select a line to see where it sits, how it reads in each situation, what changed and what the checks say.</p></div>}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the column

interface LineProps { row: ScriptRow; lex: Lexicon | null; marks?: [number, number][] }

/** One bound line in the game's people colors, the changed words marked, `{lead}` shown as the
 * engine's placeholder for the lead officer. */
function Line({ row, lex, marks }: LineProps) {
  const text = row.text;
  const people = lex ? segmentPeople(text, lex) : [{ text }];
  const cuts = new Set<number>([0, text.length]);
  let at = 0;
  for (const part of people) { cuts.add(at); at += part.text.length; cuts.add(at); }
  for (const [start, end] of marks ?? []) { cuts.add(start); cuts.add(end); }
  const points = [...cuts].filter(n => n >= 0 && n <= text.length).sort((a, b) => a - b);
  const owner = (start: number) => { let pos = 0; for (const part of people) { if (start >= pos && start < pos + part.text.length) return { part, pos }; pos += part.text.length; } return null; };
  const marked = (start: number) => (marks ?? []).some(([s, e]) => start >= s && start < e);
  const out: ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i], end = points[i + 1];
    if (start === end) continue;
    const piece = text.slice(start, end);
    const own = owner(start);
    const person = own?.part.person;
    let node: ReactNode = piece.includes('{lead}')
      ? piece.split('{lead}').flatMap((chunk, j) => j ? [<span key={`l${j}`} className="lab-script-lead" title="The engine writes the lead officer’s surname here at play time">lead officer</span>, chunk] : [chunk])
      : piece;
    if (person) {
      const first = person.first && own!.pos === start;
      node = <span className="people-name" data-kind={person.kind} data-person={person.id} title={peopleLabel(person.kind)}>{first && <PeopleGlyph kind={person.kind} />}{node}</span>;
    }
    out.push(marked(start) ? <mark key={start} className="lab-script-mark">{node}</mark> : <Fragment key={start}>{node}</Fragment>);
  }
  return <>{out}</>;
}

interface RowViewProps { row: ScriptRow | null; lex: Lexicon | null; selKey: string | null; marksOf: (row: ScriptRow) => [number, number][] | undefined; onSelect: (row: ScriptRow) => void;
  findingsOf: (row: ScriptRow) => StringFinding[]; audit: Map<string, unknown[]>; pinsOn: (row: ScriptRow) => ReviewNote[]; className?: string; lead?: ReactNode }

function RowView({ row, lex, selKey, marksOf, onSelect, findingsOf, audit, pinsOn, className, lead }: RowViewProps) {
  if (!row) return null;
  const marks = marksOf(row);
  const findings = findingsOf(row).length + (audit.get(row.key)?.length ?? 0) + (row.error ? 1 : 0);
  const pins = pinsOn(row).length;
  const on = selKey === row.key || (selKey !== null && selKey.replace(/@s\d$/, '') === row.row.where);
  return (
    <div className={cx('lab-sline', className, on && 'lab-sline-on', marks && 'lab-sline-changed', findings > 0 && 'lab-sline-flagged')} data-row={row.key}
      role="button" tabIndex={0} aria-pressed={on} onClick={() => onSelect(row)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(row); } }}>
      {lead}
      <span className="lab-sline-text"><Line row={row} lex={lex} marks={marks} /></span>
      {(findings > 0 || pins > 0) && (
        <span className="lab-sline-flags">
          {findings > 0 && <span className="lab-sline-flag" title={`${findings} ${findings === 1 ? 'finding' : 'findings'}`}><Glyph name="warn" size={11} />{findings}</span>}
          {pins > 0 && <span className="lab-sline-pin" title={`${pins} ${pins === 1 ? 'note' : 'notes'}`}><Glyph name="note" size={11} />{pins}</span>}
        </span>
      )}
    </div>
  );
}

/** A public state condition in words, from the dependency index's labels. */
function whenText(state: TreeState | undefined, tree: CallTree, deps: DependencyIndex | null): string {
  if (!state) return '';
  const label = (key: string, fallback: string) => { const text = deps?.keys.get(key as StateKey)?.label ?? fallback; return text.charAt(0).toLowerCase() + text.slice(1); };
  const parts = [
    ...(state.marks ?? []).map(mark => label(`mark:${mark}`, mark)),
    ...(state.notMarks ?? []).map(mark => `not: ${label(`mark:${mark}`, mark)}`),
    ...(state.safe ?? []).map(role => `${roleNoun(tree, role)} out safe`),
    ...(state.notSafe ?? []).map(role => `${roleNoun(tree, role)} not yet out safe`),
    ...state.count ? [`${state.count.role} ${state.count.min !== undefined ? `at least ${state.count.min}` : `at most ${state.count.max}`}`] : [],
  ];
  return parts.join(' and ');
}

function ScriptSectionView({ section, tree, deps, lex, selKey, marksOf, onSelect, findingsOf, audit, pinsOn, shown }: { section: ScriptSection; tree: CallTree; deps: DependencyIndex | null; shown: ReadonlySet<string>;
  names: CallNames; lex: Lexicon | null; selKey: string | null; marksOf: RowViewProps['marksOf']; onSelect: (row: ScriptRow) => void; findingsOf: RowViewProps['findingsOf'];
  audit: Map<string, unknown[]>; pinsOn: RowViewProps['pinsOn'] }) {
  const common = { lex, selKey, marksOf, onSelect, findingsOf, audit, pinsOn };
  const only = (row: ScriptRow | null) => (row && shown.has(row.key) ? row : null);
  const node = section.kind === 'node' ? tree.nodes.find(entry => entry.id === section.id) : undefined;
  return (
    <section className={cx('lab-script-section', `lab-script-sec-${section.kind}`)} data-section={section.id}>
      <h2 className="lab-script-sec-title">
        <span>{section.title}</span>
        {section.stage && <span className="lab-script-sec-stage">{tree.stageLabels[section.stage] ?? section.stage}</span>}
      </h2>
      {section.kind !== 'node' && section.rows.filter(row => shown.has(row.key)).map(row => (
        <RowView key={row.key} row={row} {...common} className={`lab-sline-${row.row.surface}`}
          lead={<span className="lab-sline-kind">{rowKind(row)}</span>} />
      ))}
      {section.prompts.filter(row => shown.has(row.key)).map(row => {
        const variant = /promptIf\[(\d+)\]/.exec(row.row.where);
        const when = variant && node ? whenText(node.promptIf?.[Number(variant[1])]?.when, tree, deps) : '';
        return <RowView key={row.key} row={row} {...common} className="lab-sline-prompt"
          lead={variant ? <span className="lab-tag lab-tag-xray lab-sline-variant" title={when ? `Shows when ${when}` : undefined}>variant {Number(variant[1]) + 1}{when ? ` · when ${when}` : ''}</span> : undefined} />;
      })}
      {section.choices.map(choice => (
        <div key={choice.choice} className="lab-script-choice">
          <div className="lab-script-card">
            <RowView row={choice.title} {...common} className={cx('lab-sline-title', choice.title && !shown.has(choice.title.key) && 'lab-sline-context')} />
            <RowView row={only(choice.summary)} {...common} className="lab-sline-summary" />
            {choice.modifiers.filter(row => shown.has(row.key)).map(row => <RowView key={row.key} row={row} {...common} className="lab-sline-modifier" lead={<span className="lab-sline-kind">odds</span>} />)}
          </div>
          <div className="lab-script-bands">
            {choice.bands.filter(band => only(band.preview) || band.outcomes.some(row => shown.has(row.key))).map(band => (
              <div key={band.band} className={`lab-script-band lab-script-band-${BAND_TONE[band.band]}`}>
                <span className={`lab-script-band-name lab-tone-${BAND_TONE[band.band]}`}><Glyph name={BAND_TONE[band.band]} size={12} />{BAND_WORDS[band.band]}</span>
                <RowView row={only(band.preview)} {...common} className="lab-sline-preview" lead={<span className="lab-sline-kind">preview</span>} />
                {band.outcomes.filter(row => shown.has(row.key)).map(row => <RowView key={row.key} row={row} {...common} className="lab-sline-result"
                  lead={<span className="lab-sline-kind">{band.outcomes.length > 1 ? `result ${Number(/\[(\d+)\]$/.exec(row.row.where)?.[1] ?? 0) + 1}` : 'result'}{row.row.situation !== 'all' ? ` · ${row.row.situation.replace('s', 'situation ')} only` : ''}</span>} />)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function rowKind(row: ScriptRow): string {
  const where = row.row.where;
  if (where === 'card.title') return 'call title';
  if (where === 'card.summary') return 'card hook';
  if (where === 'card.pressure') return 'pressure line';
  if (where === 'briefing.dispatch') return 'dispatch';
  if (where.startsWith('briefing.known')) return 'known';
  if (where.startsWith('briefing.unknown')) return 'unknown';
  if (where.startsWith('briefing.team')) return 'team job';
  if (where.startsWith('stage.')) return 'stage label';
  if (where.startsWith('objective.')) return 'objective';
  if (where.startsWith('ending.')) return where.endsWith('.title') ? 'ending title' : where.endsWith('.summary') ? 'ending summary' : 'still needed';
  if (where.startsWith('fact.')) return where.endsWith('.label') ? 'fact label' : where.endsWith('.claim') ? 'claim' : where.endsWith('.confirmed') ? 'confirmed' : 'disproved';
  if (where.startsWith('clock.')) return where.endsWith('.label') ? 'clock label' : 'clock cue';
  return row.row.surface.replace(/_/g, ' ');
}

// ---------------------------------------------------------------- the inspector

function rowGoal(row: ScriptRow, tree: CallTree): Goal | 'card' | 'brief' | null {
  const where = row.row.where;
  if (where.startsWith('card.')) return 'card';
  if (where.startsWith('briefing.') || where.startsWith('objective.') || where.startsWith('stage.')) return 'brief';
  const ending = /^ending\.([a-z0-9_]+)\./.exec(where);
  if (ending) return { ending: ending[1] };
  const node = row.row.path;
  if (!node) return null;
  const prompt = /\.promptIf\[(\d+)\]$/.exec(where);
  const line = /^[a-z0-9_]+\.([a-z0-9_]+)\.(favorable|mixed|adverse)\[(\d+)\]$/.exec(where);
  let target: ReqTarget | null = null;
  if (prompt) target = { prompt: [node, Number(prompt[1])] };
  else if (line) target = { outcome: [node, line[1], line[2] as 'favorable', Number(line[3])] };
  else if (row.row.action) return { offered: choiceActionId(tree.type, node, row.row.action) };
  else return { node };
  try { return goalFor(tree, requirementTree(tree, target), target); } catch { return { node }; }
}

function Inspector({ row, tree, names, lex, prevRows, changed, since, findings, audit, notesOn, castName, onNote, onPlay, onPlayScreen, onWhy, onFlow }: {
  row: ScriptRow; tree: CallTree; names: CallNames; lex: Lexicon | null; prevRows: ScriptRow[] | null; changed: [number, number][] | undefined;
  since: { before: string; after: string; words: [number, number][] } | null; findings: StringFinding[]; audit: (AuditHit & { cast: number; kind: 'missed' | 'false' })[];
  notesOn: ReviewNote[]; castName: (i: number) => string; onNote: () => void; onPlay: (goal: Goal) => void; onPlayScreen: (screen: 'card' | 'brief') => void; onWhy: () => void; onFlow: (node: string) => void }) {
  const goal = rowGoal(row, tree);
  const before = prevRows?.find(entry => entry.row.where === row.row.where);
  const situations = ([0, 1, 2] as const).map(i => {
    const found = callStringRowsFor(tree, row.row.where, i);
    return found;
  });
  const same = situations.every(entry => entry === situations[0]);
  const authored = row.row.text;
  return (
    <div className="lab-script-insp">
      <p className="lab-insp-crumb">{rowLabel(row.key, names, tree)}</p>
      <code className="lab-raw">{row.row.where}</code>
      <div className="lab-insp-reads"><Line row={row} lex={lex} marks={changed} /></div>
      <p className="lab-insp-meta"><span><b>{row.text.length}</b> characters</span><span>Length budgets: run the checks</span></p>
      {row.error && <p className="lab-insp-error"><Glyph name="error" size={12} />This line can’t bind in this variant: {row.error}</p>}

      <h3 className="lab-insp-h">As written</h3>
      <p className="lab-insp-authored">{authored.split(/(\{[^{}]+\})/).map((piece, i) => i % 2 ? <span key={i} className="lab-insp-token">{piece}</span> : piece)}</p>

      <h3 className="lab-insp-h">Situations</h3>
      {same ? <p className="lab-insp-p">{situations[0] === null ? 'Not in this call’s rows for any situation.' : 'Reads the same in situations 1, 2 and 3.'}</p> : (
        <ul className="lab-insp-sits">
          {situations.map((text, i) => <li key={i}><span className="lab-tag lab-tag-tape">{i + 1}</span>{text === null ? <span className="lab-muted">Doesn’t show</span> : <span>{names.bind(text)}</span>}</li>)}
        </ul>
      )}

      {before && changed && before.text !== row.text && (
        <>
          <h3 className="lab-insp-h">Changed from the previous variant</h3>
          <p className="lab-insp-diff lab-insp-before">{before.text}</p>
          <p className="lab-insp-diff lab-insp-after"><Line row={row} lex={null} marks={changed} /></p>
        </>
      )}
      {since && (
        <>
          <h3 className="lab-insp-h">Since the baseline</h3>
          {since.before && <p className="lab-insp-diff lab-insp-before">{since.before}</p>}
          {since.after ? <p className="lab-insp-diff lab-insp-after"><Line row={{ ...row, text: since.after }} lex={null} marks={since.words} /></p> : <p className="lab-insp-p">Gone since the baseline.</p>}
        </>
      )}

      <h3 className="lab-insp-h">Checks</h3>
      {findings.length === 0 && audit.length === 0 ? <p className="lab-insp-p lab-muted">No findings on this line{findings.length === 0 ? ' (run the checks for the prose rules)' : ''}.</p> : (
        <ul className="lab-insp-findings">
          {findings.map((finding, i) => <li key={`f${i}`}><span className="lab-insp-kind">{finding.kind}</span>{finding.detail}</li>)}
          {audit.map((hit, i) => <li key={`a${i}`}><span className="lab-insp-kind">name matcher</span>{hit.kind === 'missed' ? `“${hit.text}” isn’t colored as ${hit.expected} (${castName(hit.cast)})` : `“${hit.text}” is colored as ${hit.got}, the binder wrote ${hit.expected ?? 'no one'} (${castName(hit.cast)})`}</li>)}
        </ul>
      )}

      <h3 className="lab-insp-h">Notes</h3>
      {notesOn.length === 0 ? <p className="lab-insp-p lab-muted">No notes on this line.</p> : (
        <ul className="lab-insp-notes">{notesOn.map(note => <li key={note.id}><span className={`lab-insp-sev lab-rsev-${note.severity}`}>{note.severity === 'fix' ? 'fix before freeze' : note.severity}</span>{note.text}</li>)}</ul>
      )}

      <div className="lab-insp-actions">
        {goal === 'card' || goal === 'brief' ? <button type="button" className="lab-button" onClick={() => onPlayScreen(goal)}><Glyph name="play" size={10} />See it in Play</button>
          : goal ? <button type="button" className="lab-button" onClick={() => onPlay(goal)}><Glyph name="play" size={10} />Play to where this shows</button> : null}
        {row.row.path && <button type="button" className="lab-button lab-button-quiet" onClick={() => onFlow(row.row.path!)}>Flow</button>}
        {row.row.path && <button type="button" className="lab-button lab-button-quiet" onClick={onWhy}>Why</button>}
        <button type="button" className="lab-button lab-button-quiet" onClick={onNote}><Glyph name="note" size={13} />Note</button>
      </div>
    </div>
  );
}

const authoredBySituation = new WeakMap<CallTree, Map<string, string>>();
/** The authored text of a row in one situation (unbound), or null when it doesn't show there. */
function callStringRowsFor(tree: CallTree, where: string, situation: 0 | 1 | 2): string | null {
  let rows = authoredBySituation.get(tree);
  if (!rows) {
    rows = new Map();
    for (const row of callStringRows(tree, text => text) as StringRow[]) rows.set(`${row.where}|${row.situation}`, row.text);
    authoredBySituation.set(tree, rows);
  }
  return rows.get(`${where}|s${situation + 1}`) ?? rows.get(`${where}|all`) ?? null;
}
