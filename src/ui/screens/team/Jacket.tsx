import { useEffect, useState } from 'react';
import { jacketFor } from '../../../content/people/jackets';
import { personaNote } from '../../../content/personas';
import { RANKS } from '../../../content/ranks';
import type { FactKind } from '../../../sim/people/types';
import { jacketView, type JacketView } from '../../../sim/people/selectors';
import { stressBand } from '../../../sim/officer';
import type { GameState, Id, Officer } from '../../../sim/types';
import { send, useGame } from '../../store';
import { Face } from '../../components/Face';
import { useNav } from '../../components/nav';
import { ROLE_META, TRAIT_INFO } from '../../components/labels';
import { officerGrowth } from '../../components/OfficerProgress';
import { currentPortraitKey, portraitSource } from '../../portraits/Portrait';
import { Button } from '../../components/ui';
import { Icon } from '../../icons';
import { relativeTime } from '../../format';
import { shortDate } from './team-view';
import './team-room.css';

/** What a locked page waits for, in words that fit any officer in any seat (swat-officer-stories: no seat or trait is
 * assumed). The kind comes from the persona's own jacket; what the game recorded decides when it opens. */
const PAGE3_WAIT: Record<FactKind, string> = {
  first_call: 'after their first call here',
  rescue: 'after a rescue they work',
  injured: 'after an injury on the job',
  person_lost: 'after a call that ends badly',
  negotiated: 'after a call they talk through',
  mentored: 'after they show someone the work',
  favorable_under_pressure: 'after a call that goes well under pressure',
  arrest: 'after a case they help close',
  shift: 'after a patrol shift',
};

const BAND_CHIP = { ready: 'Ready', strained: 'Strained', overloaded: 'Overloaded', recovery: 'Needs rest' } as const;

/** The radio sample at the officer's band; Mandatory recovery has no lines because the officer cannot deploy. */
function radioLine(jv: JacketView, stress: number): string | null {
  const band = stressBand(stress);
  if (!jv.page1.radio || band === 'recovery') return null;
  return jv.page1.radio[band];
}

function lockLine(g: GameState, o: Officer, jv: JacketView): string | null {
  if (jv.pagesOpen >= jv.pagesAuthored) return null;
  if (jv.pagesOpen === 1) return 'Page 2 opens after more calls worked here.';
  const record = g.people.records[o.id];
  const kind = record ? jacketFor(record.identityId).page3?.kind : undefined;
  return kind ? `Page 3 opens ${PAGE3_WAIT[kind]}.` : null;
}

function HeroArt({ o }: { o: Officer }) {
  const key = currentPortraitKey(o);
  const [failed, setFailed] = useState(false);
  if (key && !failed) return <img src={portraitSource(key)} alt="" draggable={false} onError={() => setFailed(true)} />;
  return <span className="jacket-hero-face"><Face size="lg" kind="officer" officer={o} /></span>;
}

/** The portrait with the role line and the name (canvas E2), always in view above the sheet's sections. */
export function JacketHero({ o }: { o: Officer }) {
  const squad = o.squadId ? `SQUAD ${o.squadId}` : 'NO SQUAD';
  const rank = RANKS[officerGrowth(o).rank].title.toUpperCase();
  return <section className="jacket-hero" aria-label="Officer">
    <HeroArt o={o} />
    <div className="jacket-hero-id">
      <span className="jacket-kicker">{ROLE_META[o.role].short.toUpperCase()} · {squad} · {rank}</span>
      <h3 className="jacket-name">{o.firstName} {o.surname}</h3>
    </div>
  </section>;
}

/** The service jacket (canvas E2): the pressure line in serif italic, the radio sample in mono cyan, trait chips, the
 * ivory jacket card, the memory ledger and the bonds. A page the player has not earned is a lock line, never a blank. */
export function JacketStory({ o, onAftercare }: { o: Officer; onAftercare: (imprintId: Id) => void }) {
  const g = useGame();
  const nav = useNav();
  const now = Date.now();
  const jv = jacketView(g, o.id);
  const unseen = jv?.imprints.filter((i) => !i.seen).map((i) => i.id) ?? [];
  const unseenKey = unseen.join(',');
  useEffect(() => { if (unseenKey) send({ type: 'markTelegraphSeen', imprintIds: unseenKey.split(',') }); }, [unseenKey]);
  const [allMemory, setAllMemory] = useState(false);
  const band = stressBand(o.stress);
  const bandTone = band === 'ready' ? 'good' : band === 'strained' ? 'warn' : 'harm';
  const pressure = jv?.page1.pressureLine ?? personaNote(o.identityId) ?? '';
  const radio = jv ? radioLine(jv, o.stress) : null;
  const memories = jv?.memories ?? [];
  const shownMemory = allMemory ? memories : memories.slice(0, 3);
  const bonds = (jv?.bonds ?? []).filter((b) => b.active && b.state !== 'acquainted').slice(0, 3);
  const lock = jv ? lockLine(g, o, jv) : null;
  const pages = jv ? `${jv.pagesOpen} OF ${jv.pagesAuthored} ${jv.pagesAuthored === 1 ? 'PAGE' : 'PAGES'} OPEN` : null;
  return <div className="jacket">
    {pressure && <p className="jacket-pressure">{pressure}</p>}
    {radio && <p className="jacket-radio"><Icon name="phone" size={14} /><span>"{radio}"</span></p>}
    <ul className="jacket-chips" aria-label="Traits and condition">
      {o.traits.map((t) => <li key={t} className="jacket-chip" title={TRAIT_INFO[t].condition}>{TRAIT_INFO[t].label}</li>)}
      {(jv?.settled ?? []).map((s) => <li key={s.id} className="jacket-chip" data-tone={s.polarity === 'positive' ? 'good' : 'harm'} title={s.condition}>{s.chip}</li>)}
      {(jv?.imprints ?? []).map((i) => <li key={i.id} className="jacket-chip" data-tone="people">{i.label}</li>)}
      <li className="jacket-chip" data-tone={bandTone}>{BAND_CHIP[band]} {Math.floor(o.stress + 1e-9)}</li>
    </ul>

    {jv?.imprints.map((i) => <section key={i.id} className="jacket-note" aria-label="A note on the file">
      <span className="jacket-note-state">{i.needsDecision ? 'Waiting on you' : i.decided ? (i.decided === 'rest' ? 'Standing down' : i.decided === 'peer' ? 'A colleague is sitting with them' : 'Paired for the next call') : 'A note on the file'}</span>
      <p>{i.telegraph}</p>
      {i.endsAt !== null && <p className="jacket-note-state">Clears {relativeTime(i.endsAt, now)} if nothing else happens</p>}
      {i.needsDecision && <Button variant="primary" size="sm" onClick={() => onAftercare(i.id)}>Decide</Button>}
    </section>)}

    {jv && (jv.page1.contradiction || jv.page2 || jv.page3 || lock) && <section className="jacket-card" aria-label="The jacket">
      <span className="jacket-card-kicker">THE JACKET · {pages}</span>
      {jv.page1.contradiction && <p>{jv.page1.contradiction}</p>}
      {jv.page2 && <p>{jv.page2.line}</p>}
      {jv.page3 && <p>{jv.page3.line}</p>}
      {lock && <p className="jacket-card-lock"><Icon name="lock" size={14} />{lock}</p>}
    </section>}

    <section className="jacket-section" aria-label="Memory">
      <h4 className="jacket-section-title">Memory</h4>
      {memories.length === 0 ? <p className="jacket-empty">Nothing on file yet. Calls and shifts add a line here.</p>
        : <ul className="jacket-memory">{shownMemory.map((f) => <li key={f.id}><time>{shortDate(g, f.at)}</time><span>{f.detail}</span></li>)}</ul>}
      {memories.length > 3 && <button type="button" className="jacket-more" onClick={() => setAllMemory(!allMemory)}>{allMemory ? 'Show fewer' : `Show all ${memories.length}`}</button>}
    </section>

    {(jv?.settled.length ?? 0) > 0 && <section className="jacket-section" aria-label="Settled">
      <h4 className="jacket-section-title" data-tone="intel">On the file</h4>
      <ul className="jacket-settled">{jv!.settled.map((s) => <li key={s.id}><strong>{s.chip}</strong><span>{s.line} {s.condition}</span></li>)}</ul>
    </section>}

    {(jv?.ties.length ?? 0) > 0 && <section className="jacket-section" aria-label="Knows">
      <h4 className="jacket-section-title" data-tone="intel">Knows</h4>
      <ul className="jacket-ties">{jv!.ties.filter((t) => t.subjectName).map((t) => <li key={t.id}><strong>{t.subjectName}</strong> {t.line}.</li>)}</ul>
    </section>}

    <section className="jacket-section" aria-label="Bonds">
      <h4 className="jacket-section-title">Bonds</h4>
      {bonds.length === 0 ? <p className="jacket-empty">No bonds yet. Calls and shifts worked together start them.</p>
        : <ul className="jacket-bonds">{bonds.map((b) => <li key={b.otherId}><button type="button" className="jacket-bond" data-state={b.state} onClick={() => nav.openOfficer(b.otherId)} aria-label={`${b.otherSurname}, ${b.label.toLowerCase()}. Open their jacket`}>
          <Face size="sm" kind="officer" officer={g.officers[b.otherId]} />
          <span className="jacket-bond-text"><b>{b.otherSurname}</b><span>{b.label}</span></span>
        </button></li>)}</ul>}
    </section>
  </div>;
}
