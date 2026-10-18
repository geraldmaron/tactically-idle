// The call strip under the top bar: one chip per part of the call draw (building, situation, pacing,
// tier, squad, kit, and the turn and group sizes once the call is open). On Play a chip opens the
// matching Director section; elsewhere it opens a small popover that changes that part. The path is
// kept and replayed on the new call (spec 2.3), and situation, pacing, turns and group sizes are
// found by call seed, never forced. On the right: how this type usually ends (cached runs) and the
// static lint count, less what an accepted note muted.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import { lintTree } from '../../../gen/incident/trees-v13/dependencies';
import type { LintFinding } from '../../../gen/incident/trees-v13/dependencies';
import { CERT_LABEL } from '../../../sim/resolution';
import type { IncidentType } from '../../../sim/scenario-types';
import { plural } from '../../../ui/format';
import { DRAW_NOTICE, useLab } from '../context';
import { usePoolStored } from '../jobs/use-pool';
import { contentKey, familyLabel } from '../model/call';
import { percent, weightLabel } from '../model/label';
import { mutedFindings } from '../model/notes';
import type { Session } from '../model/session';
import { currentFrame } from '../model/session';
import { seekBase, seekCallSeed } from '../model/seek';
import type { DrawWant } from '../model/seek';
import { squadLine } from '../model/squads';
import { glyphRun, usuallyOf, WEIGHTS_BEST_FIRST } from '../surfaces/calls/calls-model';
import type { Usually } from '../surfaces/calls/calls-model';
import { useGate } from '../surfaces/calls/gate-store';
import type { LabCall } from '../types';
import { REFERENCE_SQUAD } from '../url';
import { cx, Glyph, LintGlyph, Popover, SegmentedControl } from '../viz';
import { onDirector, openDirector } from './director';
import type { DirectorSection } from './director';
import { useNarrow } from './media';

/** "vehicle_operations" → "vehicle operations"; "out_keys" → "Out keys". */
export const words = (id: string) => id.replace(/_/g, ' ');
export const sentence = (id: string) => { const text = words(id); return text.charAt(0).toUpperCase() + text.slice(1); };
export const CERTS = Object.keys(CERT_LABEL).sort();
const PACING_LABEL = { ordinary: 'Steady', deliberate_answers: 'Slow to answer' } as const;
const randomSeed = () => Math.floor(Math.random() * 100000);

/** `director`: on Play, the chip opens this Director section instead of its popover. */
function StripChip({ label, title, children, wide, director }: { label: ReactNode; title: string; children: ReactNode; wide?: boolean; director?: DirectorSection | null }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  if (director) {
    return (
      <button type="button" className="lab-strip-chip" title={`${title}: open it in the Director`} onClick={() => openDirector(director)}>
        <span className="lab-strip-label">{label}</span>
      </button>
    );
  }
  return (
    <>
      <button ref={anchor} type="button" className={cx('lab-strip-chip', open && 'lab-strip-chip-open')} aria-haspopup="dialog" aria-expanded={open} title={title} onClick={() => setOpen(value => !value)}>
        <span className="lab-strip-label">{label}</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label={title} width={wide ? 340 : 280}>
        <div className="lab-strip-pop">{children}</div>
      </Popover>
    </>
  );
}

function SeedField({ label, value, onCommit, placeholder }: { label: string; value: number | null; onCommit: (seed: number) => void; placeholder?: string }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => setText(value === null ? '' : String(value)), [value]);
  const commit = () => { const n = Math.floor(Number(text)); if (text.trim() !== '' && Number.isFinite(n) && n >= 0 && n !== value) onCommit(n); };
  return (
    <span className="lab-field-row">
      <label className="lab-field">
        <span className="lab-field-label">{label}</span>
        <input className="lab-input lab-input-num" inputMode="numeric" value={text} placeholder={placeholder} onChange={event => setText(event.target.value)}
          onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') commit(); }} />
      </label>
      <button type="button" className="lab-button lab-button-quiet" title="A random seed" onClick={() => { const seed = randomSeed(); setText(String(seed)); onCommit(seed); }}>
        <Glyph name="drawn" />Random
      </button>
    </span>
  );
}

/** Static lint for the type, less the findings an accepted note muted (spec 6.3). */
function useStaticLint(type: LabCall['type'] | undefined, muted: ReadonlyMap<string, unknown>): { findings: LintFinding[] | null; reason: string | null } {
  const all = useMemo(() => {
    const template = type ? INCIDENT_TEMPLATES[type] : undefined;
    if (!template) return { findings: null, reason: null };
    try { return { findings: lintTree(template), reason: null }; } catch (error) {
      return { findings: null, reason: `Lint failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }, [type]);
  return useMemo(() => (all.findings ? { ...all, findings: all.findings.filter(finding => !muted.has(finding.id)) } : all), [all, muted]);
}

/** How this type usually ends, random style: a cached this-type run, else the gate's random-style calls. */
function useUsually(type: IncidentType | undefined): Usually | null {
  const { jobs } = useLab();
  const { gate } = useGate();
  // Read again whenever the cache takes a result: a this-type run on Outcomes fills it on this page.
  const stored = usePoolStored(jobs);
  return useMemo(() => {
    if (!type) return null;
    const hit = jobs.cached?.({ kind: 'reach-type', type, tier: 2, style: 'random', calls: 60 }, { patch: {}, contentKey: contentKey(type) });
    return usuallyOf(type, hit && hit.result.kind === 'reach' ? hit.result.tally : null, gate.runs);
  }, [type, jobs, gate.runs, stored]);
}

export function CallStrip() {
  const { url, navigate, call, notify, notes } = useLab();
  const narrow = useNarrow();
  const draw = url.call;
  const template = draw ? INCIDENT_TEMPLATES[draw.type] : undefined;
  const session: Session | null = call.status === 'ready' ? call.session : null;
  const muted = useMemo(() => mutedFindings(notes.file), [notes.file]);
  const lint = useStaticLint(template?.type, muted);
  const usually = useUsually(template?.type);
  if (!draw) return null;

  /** A draw change keeps the path (it is replayed on the new call); an ID gives way to plain params. */
  const setDraw = (patch: Partial<LabCall>) => navigate({ call: { ...draw, ...patch, id: null } });
  /** The nearest call seed with what's wanted, keeping the rest of this call's draw (as the Director does). */
  const seek = (want: DrawWant) => {
    try {
      const found = seekCallSeed(draw.type, seekBase(draw, session), want);
      if (!found) { notify('No call seed on this building draws that with the rest kept. Try another building seed.'); return; }
      setDraw({ call: found.call });
      if (found.changed.length) notify(`Also changed: ${found.changed.join('; ')}.`, undefined, DRAW_NOTICE);
    } catch (error) {
      notify(`Could not search call seeds: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  /** On Play with the call open, chips open the Director; elsewhere their own popovers. */
  const onPlay = url.tab === 'play' && !!session;
  const director = (section: DirectorSection) => (onPlay ? section : null);
  const tree = template?.tree;
  const situation = session ? session.situation : draw.variant;
  const pacing = session?.resolved.situation?.characteristic ?? draw.pacing;
  const chips: { key: string; node: ReactNode }[] = [];

  chips.push({ key: 'building', node: (
    <StripChip label={<>{familyLabel(draw.family)} <b>{draw.seed}</b></>} title="Building" director={director('draw')}>
      <label className="lab-field">
        <span className="lab-field-label">Building type</span>
        <select className="lab-input" value={draw.family} onChange={event => setDraw({ family: event.target.value })}>
          {(tree?.families ?? [draw.family]).map(family => <option key={family} value={family}>{familyLabel(family)}</option>)}
        </select>
      </label>
      <SeedField label="Building seed" value={draw.seed} onCommit={seed => setDraw({ seed })} />
    </StripChip>
  ) });

  chips.push({ key: 'situation', node: (
    <StripChip label={draw.call !== null && !session ? <>Call seed <b>{draw.call}</b></> : <>Situation <b>{situation + 1}</b> of 3</>} title="Situation and call seed" wide director={director('draw')}>
      <span className="lab-field">
        <span className="lab-field-label">Situation (hidden truth)</span>
        <SegmentedControl label="Situation" value={situation}
          options={[0, 1, 2].map(i => ({ value: i, label: `Situation ${i + 1}` }))}
          onChange={variant => { if (variant !== situation) seek({ variant: variant as LabCall['variant'] }); }} />
      </span>
      <SeedField label="Exact call seed (cast and rooms; the situation follows it)" value={draw.call} placeholder="None" onCommit={seed => setDraw({ call: seed })} />
      {draw.call !== null && <button type="button" className="lab-button lab-button-quiet" onClick={() => setDraw({ call: null })}>Pick by situation instead</button>}
    </StripChip>
  ) });

  chips.push({ key: 'pacing', node: (
    <StripChip label={PACING_LABEL[pacing]} title="Pacing" director={director('draw')}>
      <SegmentedControl label="Pacing" value={pacing} options={[{ value: 'ordinary', label: 'Steady' }, { value: 'deliberate_answers', label: 'Slow to answer' }] as const}
        onChange={next => { if (next !== pacing) seek({ pacing: next }); }} />
    </StripChip>
  ) });

  chips.push({ key: 'tier', node: (
    <StripChip label={<>Tier <b>{draw.tier}</b></>} title="Tier" director={director('draw')}>
      <SegmentedControl label="Tier" value={draw.tier} options={[1, 2, 3, 4, 5].map(tier => ({ value: tier, label: String(tier) }))} onChange={tier => setDraw({ tier })} />
    </StripChip>
  ) });

  const grants = url.certs.map(words);
  // With the call open, the label is the session's own ("Your squad (from game)" on a game handoff).
  const line = session ? squadLine(currentFrame(session).state, session.squad) : null;
  const squadLabel = line ? line.label
    : <>Squad A (<b>{url.squad}</b>){grants.length > 0 && <span className="lab-strip-grant"> + {grants.join(', ')} (lab grant)</span>}</>;
  chips.push({ key: 'squad', node: (
    <StripChip label={squadLabel} title={session?.squad.kind === 'game' ? 'Squad from your game' : 'Reference squad'} wide director={director('squad')}>
      <SeedField label="Campaign seed (day-one squad A)" value={url.squad} onCommit={squad => navigate({ squad })} />
      {url.squad !== REFERENCE_SQUAD && <button type="button" className="lab-button lab-button-quiet" onClick={() => navigate({ squad: REFERENCE_SQUAD })}>Use reference squad {REFERENCE_SQUAD}</button>}
      <span className="lab-field">
        <span className="lab-field-label">Lab cert grants (first officer)</span>
        {url.certs.length === 0 && <span className="lab-muted">None</span>}
        {url.certs.map(cert => (
          <span key={cert} className="lab-field-row">
            <span>{words(cert)}</span>
            <button type="button" className="lab-icon-button" aria-label={`Remove ${words(cert)}`} onClick={() => navigate({ certs: url.certs.filter(c => c !== cert) })}><Glyph name="close" size={12} /></button>
          </span>
        ))}
        <select className="lab-input" value="" aria-label="Grant a cert" onChange={event => { if (event.target.value) navigate({ certs: [...url.certs, event.target.value] }); }}>
          <option value="">Grant a cert…</option>
          {CERTS.filter(cert => !url.certs.includes(cert)).map(cert => <option key={cert} value={cert}>{words(cert)}</option>)}
        </select>
      </span>
    </StripChip>
  ) });

  chips.push({ key: 'kit', node: (
    <StripChip label={draw.kit === 'full' ? 'Full kit' : 'Day-one kit'} title="Kit" director={director('kit')}>
      <SegmentedControl label="Kit" value={draw.kit} options={[{ value: 'day1', label: 'Day one' }, { value: 'full', label: 'Every item' }] as const} onChange={kit => setDraw({ kit })} />
    </StripChip>
  ) });

  if (session && tree) {
    for (const [group, members] of Object.entries(tree.turns ?? {})) {
      const drawn = session.turnDrawn[group];
      chips.push({ key: `turn:${group}`, node: (
        <StripChip label={<>Turn: <b>{drawn ? words(drawn) : 'none'}</b></>} title={`Turn group ${words(group)}`} director={director('draw')}>
          <SegmentedControl label="Turn" value={drawn ?? ''} options={members.map(member => ({ value: member, label: sentence(member) }))} onChange={member => seek({ turns: { [group]: member } })} />
        </StripChip>
      ) });
    }
    for (const [group, info] of Object.entries(tree.groups ?? {})) {
      const n = session.counts[group] ?? 0;
      // Members are the slot's people past its key roles, so the size runs over the slot's range less those.
      const slot = template?.cast.find(entry => entry.id === info.slot);
      const lo = Math.max(0, (slot?.count.min ?? 0) - (slot?.keyRoles.length ?? 0)), hi = Math.max(lo, (slot?.count.max ?? 3) - (slot?.keyRoles.length ?? 0));
      chips.push({ key: `count:${group}`, node: (
        <StripChip label={<>{sentence(group)}: <b>{n}</b></>} title={`Group size of ${words(group)}`} director={director('draw')}>
          <SegmentedControl label="Group size" value={n} options={Array.from({ length: hi - lo + 1 }, (_, i) => ({ value: lo + i, label: String(lo + i) }))} onChange={size => seek({ counts: { [group]: size } })} />
        </StripChip>
      ) });
    }
  }

  const shown = narrow ? chips.slice(0, 4) : chips;
  const folded = narrow ? chips.slice(4) : [];
  const errors = lint.findings?.filter(f => f.severity === 'error').length ?? 0;
  const warns = lint.findings?.filter(f => f.severity === 'warn').length ?? 0;
  const infos = lint.findings?.filter(f => f.severity === 'info').length ?? 0;

  return (
    <div className="lab-strip" role="toolbar" aria-label="Call draw">
      {draw.id && <span className="lab-strip-id" title={draw.id}>From ID</span>}
      <div className="lab-strip-chips">
        {shown.map(chip => <span key={chip.key} className="lab-strip-slot">{chip.node}</span>)}
        {folded.length > 0 && <MoreChips chips={folded} />}
      </div>
      <div className="lab-strip-end">
        {call.status === 'loading' && <span className="lab-strip-loading" role="status">Building the call…</span>}
        <UsuallyStrip usually={usually} />
        <button type="button" className={cx('lab-strip-lint', !lint.findings && 'lab-strip-lint-off')} onClick={() => navigate({ tab: 'deps' })}
          title={lint.findings ? `Static lint: ${plural(errors, 'error')}, ${plural(warns, 'warning')}, ${plural(infos, 'note')}` : lint.reason ?? 'Static lint'}>
          <LintGlyph severity={errors ? 'error' : 'warn'} size={13} />
          {lint.findings && <span>{errors + warns}</span>}
        </button>
      </div>
    </div>
  );
}

/** "usually ✓✓✓◐◐◌✚†": eight glyphs for how this type's random-style runs ended; the title gives the shares. */
function UsuallyStrip({ usually }: { usually: Usually | null }) {
  if (!usually) {
    return <span className="lab-strip-usually" title="How this type usually ends, random style. Run the gate on Calls or a this-type run on Outcomes to fill it."><span className="lab-muted">Usually</span> not run</span>;
  }
  const shares = WEIGHTS_BEST_FIRST.filter(w => usually.counts[w] > 0).map(w => `${weightLabel(w)} ${percent(usually.counts[w] / usually.n)}`).join(', ');
  return (
    <span className="lab-strip-usually" title={`Usually, random style, ${usually.n} calls of this type (${usually.source === 'gate' ? 'the gate’s calls' : 'cached runs'}): ${shares}`}>
      <span className="lab-muted">Usually</span>
      <span className="lab-strip-glyphs" aria-hidden="true">
        {glyphRun(usually.counts).map((w, i) => <span key={i} className={`lab-mark lab-tone-${w}`}><Glyph name={w} size={12} /></span>)}
      </span>
    </span>
  );
}

function MoreChips({ chips }: { chips: { key: string; node: ReactNode }[] }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  // A folded chip that opens the Director closes this list behind it.
  useEffect(() => onDirector(() => setOpen(false)), []);
  return (
    <>
      <button ref={anchor} type="button" className="lab-strip-chip" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        +{chips.length}<Glyph name="caret" size={11} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label="More of the call draw">
        <div className="lab-strip-more">{chips.map(chip => <span key={chip.key} className="lab-strip-slot">{chip.node}</span>)}</div>
      </Popover>
    </>
  );
}
