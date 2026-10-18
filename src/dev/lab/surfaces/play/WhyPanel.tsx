// Why a choice is locked or not offered here (spec 6.4, J5): its full requirement, each clause checked
// at this frame (and per situation where the hidden truth decides it), who sets the state a clause
// reads, the engine's own reason last and verbatim, and the fixes: grant the cert to squad A (lab),
// find a squad seed that holds it, find a draw, or find a path to where it holds.
import { useState } from 'react';
import type { ReqTarget } from '../../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, ReqNode } from '../../../../gen/incident/trees-v13/dependencies';
import { DRAW_NOTICE, useLab } from '../../context';
import { SQUAD_SEEK_LIMIT, seekCallSeed } from '../../model/seek';
import type { Frame, Session } from '../../model/session';
import { certWords } from '../../model/squads';
import { evaluateReq } from '../../model/why';
import type { EvaluatedReq, Fix, Verdict } from '../../model/why';
import { cx, Glyph } from '../../viz';

const VERDICT: Record<Verdict, { glyph: 'clean' | 'close' | 'info'; label: string }> = {
  pass: { glyph: 'clean', label: 'holds here' }, fail: { glyph: 'close', label: 'fails here' }, unknown: { glyph: 'info', label: 'decided by the dice or later' },
};

function Clause({ e, depth, onKey }: { e: EvaluatedReq; depth: number; onKey(key: string): void }) {
  const group = !('leaf' in e.node);
  const kids = group ? e.children : [];
  // A one-child group says nothing its child doesn't; the outermost "all of these" is the list itself.
  if (group && kids.length === 1) return <Clause e={kids[0]} depth={depth} onKey={onKey} />;
  if (group && depth === 0 && 'all' in e.node) return <>{kids.map((child, i) => <Clause key={i} e={child} depth={1} onKey={onKey} />)}</>;
  return (
    <li className={cx('lab-why-clause', `lab-why-${e.now}`, group && 'lab-why-group')}>
      <span className="lab-why-line">
        <span className={`lab-why-verdict lab-why-verdict-${e.now}`}><Glyph name={VERDICT[e.now].glyph} size={12} title={VERDICT[e.now].label} /></span>
        <span className="lab-why-label">{group ? ('all' in e.node ? 'All of these' : 'Any one of these') : 'leaf' in e.node && e.node.leaf.kind === 'at' ? `Reached ${e.label.replace(/^At /, '')}` : e.label}</span>
        {e.bySituation && (
          <span className="lab-why-sits" title="In each of the call's three situations (hidden truth)">
            {e.bySituation.map((v, i) => <span key={i} className={`lab-why-sit lab-why-sit-${v}`}>S{i + 1}{v === 'pass' ? ' ✓' : v === 'fail' ? ' ✕' : ''}</span>)}
          </span>
        )}
        {e.draw && <span className="lab-why-draw">{e.draw}</span>}
        {e.writers.length > 0 && e.now === 'fail' && (
          <button type="button" className="lab-chip lab-chip-effect" onClick={() => onKey(keyOfLeaf(e.node))} title="Who sets this, in Dependencies">
            <Glyph name="writes" size={12} />set by {e.writers.length} {e.writers.length === 1 ? 'line' : 'lines'}
          </button>
        )}
      </span>
      {group && kids.length > 0 && <ul className="lab-why-list lab-why-nested">{kids.map((child, i) => <Clause key={i} e={child} depth={depth + 1} onKey={onKey} />)}</ul>}
    </li>
  );
}

function keyOfLeaf(node: ReqNode): string {
  if (!('leaf' in node)) return '';
  const leaf = node.leaf;
  switch (leaf.kind) {
    case 'mark': return `mark:${leaf.mark}`;
    case 'safe': return `safe:${leaf.role}`;
    case 'count': return `count:${leaf.group}`;
    case 'fact': return 'situation';
    case 'clock': return `clock:${leaf.clock}`;
    case 'meter': return `meter:${leaf.role}`;
    case 'turn': return `turn:${leaf.group}`;
    default: return '';
  }
}

export function WhyPanel({ session, frame, deps, req, target, reason }: {
  session: Session; frame: Frame; deps: DependencyIndex | null; req: ReqNode; target: ReqTarget; reason: string | null;
}) {
  const { url, navigate, jobs, notify, playHere, tuning } = useLab();
  const [squadSeek, setSquadSeek] = useState<{ cert: string; text: string; seed: number | null } | 'running' | null>(null);
  let evaluated: ReturnType<typeof evaluateReq> | null = null;
  try { evaluated = evaluateReq(req, session, frame, deps, target); } catch (error) {
    return <p className="lab-muted">The requirement can't be read: {error instanceof Error ? error.message : String(error)}</p>;
  }
  const { root, fixes } = evaluated;
  const onKey = (key: string) => { if (key) navigate({ tab: 'deps', sel: { kind: 'key', key } }); };
  const fromGame = session.squad.kind === 'game';

  const run = (fix: Fix) => {
    if (fix.kind === 'grant-cert') { navigate({ certs: [...new Set([...url.certs, fix.cert])] }); return; }
    if (fix.kind === 'find-path') { playHere(fix.goal); return; }
    if (fix.kind === 'seek-squad') {
      setSquadSeek('running');
      jobs.run({ kind: 'seek-squad', cert: fix.cert, from: 1, limit: SQUAD_SEEK_LIMIT }, { patch: tuning.patch, contentKey: session.contentKey }).promise.then(result => {
        if (result.kind !== 'seek-squad') return;
        setSquadSeek(result.seed === null
          ? { cert: fix.cert, seed: null, text: `None in seeds 1 to ${result.tried}: no day-one squad A there holds ${certWords(fix.cert)}.` }
          : { cert: fix.cert, seed: result.seed, text: `Squad seed ${result.seed} holds ${certWords(fix.cert)}.` });
      }, error => { setSquadSeek(null); notify(`Finding a squad seed failed: ${error instanceof Error ? error.message : String(error)}`); });
      return;
    }
    const draw = url.call;
    if (!draw) return;
    const base = { family: draw.family, seed: draw.seed, tier: draw.tier, ...(session.resolved.spec ? { call: session.resolved.spec.seed } : {}) };
    const found = seekCallSeed(draw.type, base, fix.want);
    if (!found) { notify('No call seed on this building draws that with the rest kept.'); return; }
    navigate({ call: { ...draw, call: found.call, id: null } });
    if (found.changed.length) notify(`Also changed: ${found.changed.join('; ')}.`, undefined, DRAW_NOTICE);
  };

  const label = (fix: Fix) => fix.kind === 'grant-cert' ? `Grant to squad A (lab): ${certWords(fix.cert)}` : fix.kind === 'seek-squad' ? 'Find a squad seed'
    : fix.kind === 'find-path' ? 'Find a path here' : 'Find a draw';
  const help = (fix: Fix) => fix.kind === 'grant-cert' ? 'Adds the cert to squad A’s first officer for this lab session; it is labeled everywhere.'
    : fix.kind === 'seek-squad' ? `Looks through campaign seeds 1 to ${SQUAD_SEEK_LIMIT} for a day-one squad A that holds it.`
      : fix.kind === 'find-path' ? 'Plays the shortest path to a state where it holds.' : 'Moves to the nearest call seed whose draw has it, keeping the rest.';

  return (
    <div className="lab-why">
      <p className="lab-why-title"><Glyph name="lock" size={13} />Why it isn't open here</p>
      <ul className="lab-why-list">{<Clause e={root} depth={0} onKey={onKey} />}</ul>
      {reason && <p className="lab-why-engine"><span className="lab-why-engine-label">Engine</span>{reason}</p>}
      {fixes.length > 0 && (
        <div className="lab-why-fixes">
          {fixes.map((fix, i) => (
            <button key={i} type="button" className={cx('lab-button', fix.kind === 'grant-cert' && 'lab-why-grant')} title={help(fix)}
              disabled={(fromGame && (fix.kind === 'grant-cert' || fix.kind === 'seek-squad' || fix.kind === 'seek-draw')) || (fix.kind === 'seek-squad' && squadSeek === 'running')}
              onClick={() => run(fix)}>{label(fix)}</button>
          ))}
        </div>
      )}
      {squadSeek === 'running' && <p className="lab-muted lab-why-result">Looking through campaign seeds 1 to {SQUAD_SEEK_LIMIT}…</p>}
      {squadSeek && squadSeek !== 'running' && (
        <p className="lab-why-result" role="status">{squadSeek.text}
          {squadSeek.seed !== null && <button type="button" className="lab-button lab-button-quiet" onClick={() => navigate({ squad: squadSeek.seed! })}>Use squad {squadSeek.seed}</button>}
        </p>
      )}
    </div>
  );
}
