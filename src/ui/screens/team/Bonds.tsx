import { useGame } from '../../store';
import { Face } from '../../components/Face';
import { Sheet } from '../../components/Sheet';
import { useNav } from '../../components/nav';
import { useSettings } from '../../settings/SettingsControls';
import type { Id } from '../../../sim/types';
import { officerList } from '../helpers';
import { bondCaptionLine, bondCards, webEdges, webLayout, type EdgeStyle } from './team-view';
import './team-room.css';

const W = 358, H = 340;
const EDGE_NAME: Record<EdgeStyle, string> = { close: 'Close', trusted: 'Trusted', mentor: 'Mentor', tense: 'Tense', off_clock: 'Off the clock', acquainted: 'Acquainted' };

/** The bond web (canvas E3): the department's faces with a line for every bond that carries a state, a legend,
 * and a card for each tense pair (with its recorded cause) and each romance (their story to tell, never a stat).
 * With the personal-lives setting off the romance cards and the dotted lines go; the bond itself still draws as
 * the close tie it is, so play reads the same. */
export function BondsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Sheet open={open} onClose={onClose} title="Bonds" className="bonds-sheet"><BondsBody onClose={onClose} /></Sheet>;
}

function BondsBody({ onClose }: { onClose: () => void }) {
  const g = useGame();
  const nav = useNav();
  const personalLives = useSettings().personalLives;
  const officers = officerList(g);
  const ids = officers.map((o) => o.id);
  const edges = webEdges(g, ids, personalLives).filter((e) => e.style !== 'acquainted');
  const place = webLayout(ids, edges, W, H);
  const cards = bondCards(g, personalLives);
  const tense = new Set(edges.filter((e) => e.style === 'tense').flatMap((e) => [e.a, e.b]));
  const summary = edges.length === 0 ? 'Bond web. No bonds yet.' : `Bond web. ${edges.map((e) => `${EDGE_NAME[e.style]}, ${g.officers[e.a]?.surname} and ${g.officers[e.b]?.surname}`).join('. ')}.`;
  const used = new Set(edges.map((e) => e.style));
  const faceOpen = (id: Id) => { onClose(); nav.openOfficer(id); };
  return <div className="bonds">
    <p className="bonds-caption">{bondCaptionLine(g, ids)}</p>
    <div className="bonds-board">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} preserveAspectRatio="none">
        <g fill="none" strokeLinecap="round">
          {edges.map((e) => {
            const p = place[e.a], q = place[e.b];
            if (!p || !q) return null;
            const curve = e.style === 'off_clock' ? `M${p.x} ${p.y} C ${p.x} ${(p.y + q.y) / 2}, ${q.x} ${(p.y + q.y) / 2}, ${q.x} ${q.y}` : `M${p.x} ${p.y} L${q.x} ${q.y}`;
            return <path key={`${e.a}:${e.b}`} d={curve} className={`bonds-edge-${e.style}`} />;
          })}
        </g>
      </svg>
      {officers.map((o) => {
        const at = place[o.id];
        if (!at) return null;
        return <button key={o.id} type="button" className="bonds-face" data-tense={tense.has(o.id)} style={{ left: `${(at.x / W) * 100}%`, top: `${(at.y / H) * 100}%` }} aria-label={`Open ${o.firstName} ${o.surname}'s jacket`} onClick={() => faceOpen(o.id)}>
          <Face size="md" kind="officer" officer={o} />
          <span className="bonds-face-name" aria-hidden="true">{o.surname}</span>
        </button>;
      })}
    </div>
    {edges.length === 0 ? <p className="bonds-empty">No bonds yet. Calls and shifts worked together start them, and a bad night can strain them.</p>
      : <ul className="bonds-legend" aria-label="Legend">
        {(used.has('close') || used.has('trusted')) && <li><span className="bonds-key" />Trusted, close</li>}
        {used.has('mentor') && <li><span className="bonds-key bonds-key-mentor" />Mentor</li>}
        {used.has('tense') && <li><span className="bonds-key bonds-key-tense" />Tense, strained</li>}
        {used.has('off_clock') && <li><span className="bonds-key bonds-key-off_clock" />Close, off the clock</li>}
      </ul>}
    {cards.length > 0 && <div className="bonds-cards">
      {cards.map((c) => <div key={c.key} className="bonds-card" data-kind={c.kind}>
        <span className="bonds-card-faces" aria-hidden="true"><Face size="sm" kind="officer" officer={g.officers[c.a]} /><Face size="sm" kind="officer" officer={g.officers[c.b]} /></span>
        <span className="bonds-card-text"><b>{c.title}</b><span>{c.body}</span></span>
      </div>)}
    </div>}
  </div>;
}
