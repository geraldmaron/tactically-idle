import { useEffect, useState, type ReactNode } from 'react';
import { aftercareView, type AftercareOptionView } from '../../../sim/people/selectors';
import type { AftercareChoice } from '../../../sim/people/types';
import type { Id } from '../../../sim/types';
import { stressBand } from '../../../sim/officer';
import { useGame, send } from '../../store';
import { Face } from '../../components/Face';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { Icon } from '../../icons';
import { ROLE_META } from '../../components/labels';
import { BAND_TONE, bandCaption } from './team-view';
import './team-room.css';

/** Aftercare for one officer (canvas E4): the behavior the player saw, what the note could settle as, three ways
 * to answer it with the colleague's face and a cost line on each, and a note that nothing here touches a roll.
 * Opening it marks the telegraph seen, which is what lets a waiting decision open. */
export function AftercareSheet({ imprintId, onClose }: { imprintId: Id | null; onClose: () => void }) {
  return imprintId ? <AftercareLoaded imprintId={imprintId} onClose={onClose} /> : null;
}

/** The pack's pairing line names "the partner you name" until a partner is chosen; once one is, the line names them. */
const bindPartner = (line: string, name?: string): string => name ? line.replace("the partner you name's", `${name}'s`).replace('the partner you name', name) : line;

function AftercareLoaded({ imprintId, onClose }: { imprintId: Id; onClose: () => void }) {
  const g = useGame();
  const { act } = useToast();
  const view = aftercareView(g, imprintId);
  const unseen = !!view && !view.seen;
  useEffect(() => { if (unseen) send({ type: 'markTelegraphSeen', imprintIds: [imprintId] }); }, [unseen, imprintId]);
  const [picked, setPicked] = useState<AftercareChoice | null>(null);
  const [partners, setPartners] = useState<Partial<Record<AftercareChoice, Id>>>({});
  const frame = (body: ReactNode, footer?: ReactNode) => <Sheet open onClose={onClose} title="Aftercare" className="aftercare-sheet" footer={footer}>{body}</Sheet>;
  if (!view) return frame(<p className="aftercare-note">That note has ended.</p>);
  const officer = g.officers[view.officerId];
  if (!officer) return frame(<p className="aftercare-note">That officer has left the department.</p>);
  const firstOpen = view.options.find((o) => o.available)?.choice ?? 'rest';
  const choice = picked ?? firstOpen;
  const option = view.options.find((o) => o.choice === choice)!;
  const partnerOf = (o: AftercareOptionView): Id | undefined => o.choice === 'rest' ? undefined : (partners[o.choice] && o.candidates.includes(partners[o.choice]!) ? partners[o.choice] : o.candidates[0]);
  const partner = partnerOf(option);
  const partnerName = partner ? g.officers[partner]?.surname : undefined;
  const squad = officer.squadId ? `SQUAD ${officer.squadId}` : 'NO SQUAD';
  const band = stressBand(officer.stress);
  const tone = BAND_TONE[band];
  const cta = choice === 'rest' ? `Stand ${officer.surname} down` : choice === 'peer' ? (partnerName ? `Ask ${partnerName} to sit with ${officer.surname}` : 'Ask a colleague to sit with them') : (partnerName ? `Pair ${officer.surname} with ${partnerName}` : 'Name a partner');
  const confirm = () => {
    const done = choice === 'rest' ? `${officer.surname} stands down` : choice === 'peer' ? `${partnerName ?? 'A colleague'} sits with ${officer.surname}` : `${officer.surname} pairs with ${partnerName ?? 'a partner'} on the next call`;
    const res = act({ type: 'decideAftercare', imprintId, choice, ...(partner ? { partnerId: partner } : {}) }, done);
    if (res.ok) onClose();
  };
  const faceFor = (o: AftercareOptionView) => {
    const who = o.choice === 'rest' ? officer : g.officers[partnerOf(o) ?? ''];
    return who ? <Face size="sm" kind="officer" officer={who} /> : <span className="face face-sm" aria-hidden="true"><Icon name="user" size={16} /></span>;
  };
  return frame(<div className="aftercare">
    <div className="aftercare-head">
      <Face size="lg" kind="officer" officer={officer} name={`${officer.firstName} ${officer.surname}`} />
      <div className="aftercare-id">
        <span className="aftercare-kicker">{ROLE_META[officer.role].short.toUpperCase()} · {squad}</span>
        <h3 className="aftercare-name">{officer.firstName} {officer.surname}</h3>
        <span className="aftercare-band" data-tone={tone === 'live' ? 'harm' : tone}>{bandCaption(officer.stress).toUpperCase()}</span>
      </div>
    </div>
    <p className="aftercare-telegraph">{view.telegraph}</p>
    <div className="aftercare-tiles">
      <div className="aftercare-tile"><span className="aftercare-tile-kicker">Could settle as</span><b>{view.settles.pair.adverse.chip}</b><span>{view.settles.pair.adverse.condition}</span></div>
      <div className="aftercare-tile" data-tone="good"><span className="aftercare-tile-kicker">Or be earned as</span><b>{view.settles.pair.favorable.chip}</b><span>{view.settles.pair.favorable.condition}</span></div>
    </div>
    {view.decided ? <p className="aftercare-done"><Icon name="check" size={16} />{view.decided === 'rest' ? `${officer.surname} is standing down. ${view.settles.rest}` : view.decided === 'peer' ? `A colleague is sitting with ${officer.surname}. ${view.settles.peer}` : `${officer.surname} goes out paired on the next call they work together.`}</p>
      : !view.open ? <p className="aftercare-note">{view.seen || unseen ? 'A decision opens once the note has been seen. It never expires while you are away.' : ''}</p>
      : <div className="aftercare-options" role="radiogroup" aria-label="What the department does">
        {view.options.map((o) => {
          const checked = choice === o.choice;
          const list = o.candidates.slice(0, 5);
          return <div key={o.choice} className="aftercare-choice"><div className="aftercare-option" role="radio" tabIndex={o.available ? 0 : -1} aria-checked={checked} aria-disabled={!o.available}
            onClick={() => { if (o.available) setPicked(o.choice); }} onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && o.available) { e.preventDefault(); setPicked(o.choice); } }}>
            {faceFor(o)}
            <span className="aftercare-option-text">
              <b>{o.label}</b>
              <span>{bindPartner(o.line, o.choice === 'pair' ? g.officers[partnerOf(o) ?? '']?.surname : undefined)}</span>
              <span className="aftercare-cost">{o.cost}</span>
              {!o.available && o.reason && <span className="aftercare-reason">{o.reason}</span>}
            </span>
          </div>
          {checked && o.choice !== 'rest' && list.length > 1 && <div className="aftercare-partners" role="radiogroup" aria-label={o.choice === 'peer' ? 'Who sits with them' : 'Who goes out with them'}>
            {list.map((id) => <button key={id} type="button" className="aftercare-partner" role="radio" aria-checked={partnerOf(o) === id}
              onClick={() => setPartners((p) => ({ ...p, [o.choice]: id }))}>
              <Face size="sm" kind="officer" officer={g.officers[id]} />{g.officers[id]?.surname}
            </button>)}
          </div>}
          </div>;
        })}
      </div>}
    {view.open && <p className="aftercare-note">Nothing here touches a roll. Stress stays the only number; this decides what settles in their jacket.</p>}
  </div>, view.open ? <button type="button" className="btn btn-block btn-people" disabled={!option.available || (choice !== 'rest' && !partner)} onClick={confirm}>{cta}</button> : undefined);
}
