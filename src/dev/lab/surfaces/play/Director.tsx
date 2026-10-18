// The Director (spec 3.2): everything that sets up the call the frame plays, each control bound to
// the URL. The draw (building, situation, turn, group size, pacing, tier), the squad (campaign seed,
// faces, certs, lab grants), the kit, how a Confirm resolves (dice), which screen the frame shows,
// and the frame's width and zoom. Situation, turn, group size and pacing are never forced onto a call:
// the lab finds the nearest call seed that draws them (seekCallSeed) and says what else changed.
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import { Portrait } from '../../../../ui/portraits/Portrait';
import { DRAW_NOTICE, useLab } from '../../context';
import { familyLabel } from '../../model/call';
import { seekBase, seekCallSeed } from '../../model/seek';
import type { DrawWant } from '../../model/seek';
import type { DirectorSection } from '../../shell/director';
import { sessionBinder } from '../../model/session';
import type { Session } from '../../model/session';
import { certWords, squadLine } from '../../model/squads';
import type { FrameScreen, LabCall } from '../../types';
import { REFERENCE_SQUAD } from '../../url';
import { cx, Glyph, SegmentedControl, Tag } from '../../viz';
import { TrueDeviceButton } from './TrueDevice';
import { CERT_IDS } from '../../../../content/certs';

const CERTS = [...CERT_IDS].sort();
const words = (id: string) => id.replace(/_/g, ' ');
const sentence = (id: string) => { const text = words(id); return text.charAt(0).toUpperCase() + text.slice(1); };
const randomSeed = () => Math.floor(Math.random() * 100000);

/** Which section a call strip chip asked for, and when (a new `seq` asks again). */
export interface DirectorFocus { section: DirectorSection; seq: number }

function Section({ id, focus, title, children, open = true, aside }: { id: DirectorSection; focus: DirectorFocus | null; title: string; children: ReactNode; open?: boolean; aside?: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!focus || focus.section !== id || !el) return;
    el.open = true;
    el.scrollIntoView({ block: 'nearest' });
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(timer);
  }, [focus?.seq]);
  return (
    <details ref={ref} className={cx('lab-dir-section', flash && 'lab-dir-section-flash')} open={open} data-section={id}>
      <summary className="lab-dir-head"><span>{title}</span>{aside && <span className="lab-dir-aside">{aside}</span>}<Glyph name="caret" size={12} className="lab-dir-caret" /></summary>
      <div className="lab-dir-body">{children}</div>
    </details>
  );
}

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return <div className="lab-dir-row"><span className="lab-dir-label">{label}{hint && <span className="lab-dir-hint">{hint}</span>}</span>{children}</div>;
}

export function SeedInput({ label, value, onCommit }: { label: string; value: number | null; onCommit(seed: number): void }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => setText(value === null ? '' : String(value)), [value]);
  const commit = () => { const n = Math.floor(Number(text)); if (text.trim() !== '' && Number.isFinite(n) && n >= 0 && n !== value) onCommit(n); };
  return (
    <span className="lab-dir-seed">
      <input className="lab-input lab-input-num" aria-label={label} inputMode="numeric" value={text} onChange={event => setText(event.target.value)}
        onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') commit(); }} />
      <button type="button" className="lab-icon-button" title={`Random ${label.toLowerCase()}`} aria-label={`Random ${label.toLowerCase()}`} onClick={() => onCommit(randomSeed())}><Glyph name="drawn" /></button>
    </span>
  );
}

export function Director({ session, focus = null }: { session: Session | null; focus?: DirectorFocus | null }) {
  const { url, navigate, notify } = useLab();
  const draw = url.call;
  if (!draw) return null;
  const template = INCIDENT_TEMPLATES[draw.type];
  const tree = template?.tree;
  const fromGame = session?.squad.kind === 'game';
  const setDraw = (patch: Partial<LabCall>) => navigate({ call: { ...draw, ...patch, id: null } });

  /** The nearest call seed with what's wanted, keeping the rest of this call's draw. */
  const seek = (want: DrawWant) => {
    const found = seekCallSeed(draw.type, seekBase(draw, session), want);
    if (!found) { notify('No call seed on this building draws that with the rest kept. Try another building seed.'); return; }
    setDraw({ call: found.call });
    if (found.changed.length) notify(`Also changed: ${found.changed.join('; ')}.`, undefined, DRAW_NOTICE);
  };

  const bind = session ? sessionBinder(session) : (text: string) => text;
  const situation = session ? session.situation : draw.variant;
  const line = session ? squadLine(session.frames[0].state, session.squad) : null;

  return (
    <div className="lab-dir">
      {fromGame && (
        <div className="lab-dir-from-game">
          <p><Glyph name="names" /> This call came from your game: its draw, squad and kit are the game's.</p>
          <button type="button" className="lab-button" onClick={() => navigate({ handoff: null, hist: '', path: '' })}>Use reference squad</button>
        </div>
      )}
      <Section id="draw" focus={focus} title="Call draw" aside={session?.resolved.spec ? <span className="lab-dir-callseed" title="Call seed: the cast, rooms and every draw follow it">call {session.resolved.spec.seed}</span> : undefined}>
        <Row label="Building">
          <span className="lab-dir-inline">
            <select className="lab-input lab-dir-grow" aria-label="Building type" value={draw.family} disabled={fromGame} onChange={event => setDraw({ family: event.target.value })}>
              {(tree?.families ?? [draw.family]).map(family => <option key={family} value={family}>{familyLabel(family)}</option>)}
            </select>
            <SeedInput label="Building seed" value={draw.seed} onCommit={seed => setDraw({ seed })} />
          </span>
        </Row>
        <Row label="Situation" hint={<Tag variant="tape" title="Hidden truth: the player never sees this">hidden truth</Tag>}>
          <div className="lab-dir-sits" role="radiogroup" aria-label="Situation">
            {(tree?.situations ?? []).map((entry, i) => (
              <button key={i} type="button" role="radio" aria-checked={situation === i} disabled={fromGame} className={cx('lab-dir-sit', situation === i && 'lab-dir-sit-on')}
                onClick={() => { if (situation !== i) seek({ variant: i as 0 | 1 | 2 }); }}>
                <span className="lab-dir-sit-n">{i + 1}</span>
                <span className="lab-dir-sit-note">{bind(entry.note)}</span>
              </button>
            ))}
          </div>
        </Row>
        {session && Object.entries(tree?.turns ?? {}).map(([group, members]) => (
          <Row key={group} label={`Turn: ${words(group)}`}>
            <select className="lab-input" aria-label={`Turn ${words(group)}`} value={session.turnDrawn[group] ?? ''} disabled={fromGame} onChange={event => seek({ turns: { [group]: event.target.value } })}>
              {members.map(member => <option key={member} value={member}>{sentence(member)}</option>)}
            </select>
          </Row>
        ))}
        {session && Object.entries(tree?.groups ?? {}).map(([group, info]) => {
          const slot = template?.cast.find(entry => entry.id === info.slot);
          const lo = Math.max(0, (slot?.count.min ?? 0) - (slot?.keyRoles.length ?? 0)), hi = Math.max(lo, (slot?.count.max ?? 3) - (slot?.keyRoles.length ?? 0));
          return (
            <Row key={group} label={`Group size: ${words(group)}`} hint={info.label ? words(info.label) : undefined}>
              <SegmentedControl label={`Group size of ${words(group)}`} size="small" value={session.counts[group] ?? 0}
                options={Array.from({ length: hi - lo + 1 }, (_, i) => ({ value: lo + i, label: String(lo + i), disabled: fromGame }))}
                onChange={size => seek({ counts: { [group]: size } })} />
            </Row>
          );
        })}
        <Row label="Pacing">
          <SegmentedControl label="Pacing" size="small" value={session?.resolved.situation?.characteristic ?? draw.pacing}
            options={[{ value: 'ordinary', label: 'Steady', disabled: fromGame }, { value: 'deliberate_answers', label: 'Slow to answer', disabled: fromGame }] as const}
            onChange={pacing => seek({ pacing })} />
        </Row>
        <Row label="Tier">
          <span className="lab-dir-pips" role="radiogroup" aria-label="Tier">
            {[1, 2, 3, 4, 5].map(tier => (
              <button key={tier} type="button" role="radio" aria-checked={draw.tier === tier} aria-label={`Tier ${tier}`} title={`Tier ${tier}`} disabled={fromGame}
                className={cx('lab-dir-pip', tier <= draw.tier && 'lab-dir-pip-on')} onClick={() => setDraw({ tier })} />
            ))}
            <span className="lab-dir-pip-n">{draw.tier}</span>
          </span>
        </Row>
      </Section>

      <Section id="squad" focus={focus} title="Squad" aside={line ? <span className="lab-dir-squad-label">{line.label}</span> : undefined}>
        {!fromGame && <Row label="Campaign seed" hint={url.squad === REFERENCE_SQUAD ? 'reference' : undefined}>
          <span className="lab-dir-inline">
            <SeedInput label="Campaign seed" value={url.squad} onCommit={squad => navigate({ squad })} />
            {url.squad !== REFERENCE_SQUAD && <button type="button" className="lab-button lab-button-quiet" onClick={() => navigate({ squad: REFERENCE_SQUAD })}>719</button>}
          </span>
        </Row>}
        {line && (
          <ul className="lab-dir-faces" aria-label="Officers">
            {line.officers.map(officer => {
              const record = session!.frames[0].state.officers[officer.id];
              return (
                <li key={officer.id} className="lab-dir-face">
                  {record && <Portrait officer={record} size={34} className="lab-dir-portrait" />}
                  <span className="lab-dir-face-text">
                    <span className="lab-dir-face-name">{officer.name}</span>
                    <span className="lab-dir-face-certs">{officer.certs.length ? officer.certs.map(cert => (
                      <span key={cert} className={cx('lab-dir-cert', line.grants.includes(cert) && 'lab-dir-cert-grant')} title={line.grants.includes(cert) ? 'Lab grant' : 'Held'}>{certWords(cert)}</span>
                    )) : <span className="lab-muted">no certifications</span>}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {!fromGame && <Row label="Grant a cert (lab)">
          <span className="lab-dir-grants">
            {url.certs.map(cert => (
              <span key={cert} className="lab-dir-grant">{words(cert)}
                <button type="button" className="lab-icon-button" aria-label={`Remove ${words(cert)}`} onClick={() => navigate({ certs: url.certs.filter(entry => entry !== cert) })}><Glyph name="close" size={11} /></button>
              </span>
            ))}
            <select className="lab-input" value="" aria-label="Grant a cert to the first officer" onChange={event => { if (event.target.value) navigate({ certs: [...url.certs, event.target.value] }); }}>
              <option value="">+ Grant cert…</option>
              {CERTS.filter(cert => !url.certs.includes(cert)).map(cert => <option key={cert} value={cert}>{words(cert)}</option>)}
            </select>
          </span>
        </Row>}
      </Section>

      <Section id="kit" focus={focus} title="Kit and dice">
        <Row label="Kit">
          <SegmentedControl label="Kit" size="small" value={draw.kit} options={[{ value: 'none', label: 'No items', disabled: fromGame }, { value: 'day1', label: 'Day one', disabled: fromGame }, { value: 'full', label: 'Every item', disabled: fromGame }] as const} onChange={kit => setDraw({ kit })} />
        </Row>
        <Row label="Confirm resolves" hint={url.dice === 'roll' ? 'the run’s own dice' : 'you pick the band'}>
          <SegmentedControl label="Dice" size="small" value={url.dice} options={[{ value: 'roll', label: 'Roll' }, { value: 'force', label: 'Force' }] as const} onChange={dice => navigate({ dice }, 'replace')} />
        </Row>
      </Section>

      <Section id="frame" focus={focus} title="Frame">
        <Row label="Screen" hint={url.screen ? 'pinned' : 'follows the run'}>
          <SegmentedControl<FrameScreen | 'auto'> label="Screen" size="small" value={url.screen ?? 'auto'}
            options={[{ value: 'auto', label: 'Auto' }, { value: 'card', label: 'Card' }, { value: 'brief', label: 'Brief' }, { value: 'live', label: 'Live' }, { value: 'debrief', label: 'Debrief' }]}
            onChange={screen => navigate({ screen: screen === 'auto' ? null : screen }, 'replace')} />
        </Row>
        <Row label="Width">
          <SegmentedControl label="Frame width" size="small" value={url.width} options={[{ value: 390, label: '390' }, { value: 430, label: '430' }]} onChange={w => navigate({ width: w as 390 | 430 }, 'replace')} />
        </Row>
        <Row label="Zoom">
          <SegmentedControl label="Frame zoom" size="small" value={url.zoom} options={[{ value: 'fit', label: 'Fit' }, { value: '1', label: '1:1' }]} onChange={zoom => navigate({ zoom: zoom as 'fit' | '1' }, 'replace')} />
        </Row>
        <Row label="Narrower phones" hint="320 to 430, in a real iframe">
          <TrueDeviceButton />
        </Row>
      </Section>
    </div>
  );
}
