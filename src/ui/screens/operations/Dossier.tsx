import { useState } from 'react';
import { TIE_LINE } from '../../../content/people/facts';
import type { TieKind } from '../../../sim/people/types';
import { subjectDossier } from '../../../sim/world/selectors';
import { Face } from '../../components/Face';
import { Funds } from '../../components/Funds';
import { Button } from '../../components/ui';
import { Icon } from '../../icons';
import { Silhouette } from '../../portraits/Silhouette';
import { send, useGame } from '../../store';
import { clockIn, dossierSubline, fileLines, leadReady, livingCase, objectPronoun } from './model';
import { opsView } from './view';

export function BackLink({ label }: { label: string }) {
  return <button type="button" className="ow-back" onClick={() => opsView.back()}><Icon name="chevronLeft" size={20} />{label}</button>;
}

/** The dossier (C2): an ivory card with the subject's file, the case funding when it closes, and the officer on the
 * team who knows them. Plan the warrant opens the lead's call card on the board and moves to warrant prep. A refusal
 * from the engine is shown as it is given. */
export function Dossier({ subjectId }: { subjectId: string }) {
  const g = useGame();
  const [refusal, setRefusal] = useState<string | null>(null);
  const d = subjectDossier(g, subjectId);
  if (!d) return <div className="page ow-page"><BackLink label="Investigations" /><p className="dim">That file is not open yet.</p></div>;
  const lead = d.leads.find((l) => l.status !== 'served');
  const ready = !!lead && (lead.status === 'warrant' || leadReady(g, lead));
  const c = livingCase(d);
  const lines = fileLines(g, d);
  const now = g.department.clockHighWater;
  const him = objectPronoun(d.pronouns);
  const plan = () => {
    if (!lead) return;
    const r = send({ type: 'openWarrant', leadId: lead.id });
    if (r.ok) { setRefusal(null); opsView.openPrep(lead.id, d.id); } else setRefusal(r.reason);
  };
  return <div className="page ow-page ow-dossier-page">
    <BackLink label={d.crewName ?? 'Investigations'} />
    <article className={`ow-paper${ready ? ' ow-paper-stamped' : ''}`} aria-label={`Dossier: ${d.name}`}>
      {ready && <span className="ow-stamp" role="img" aria-label="Warrant ready">WARRANT READY</span>}
      <div className="ow-paper-head">
        <span className="ow-photo" aria-hidden="true"><Silhouette kind="person" seed={d.id} /></span>
        <div className="ow-paper-id">
          <span className="ow-mono ow-paper-kicker">SUBJECT · TIER {d.tier}</span>
          <h2 className="ow-paper-name">{d.name}</h2>
          <span className="ow-paper-sub">{dossierSubline(d)}</span>
        </div>
      </div>
      <div className="ow-file">
        <span className="ow-mono ow-paper-kicker">ON FILE</span>
        {lines.length === 0 ? <p className="ow-file-line">Nothing is on file yet.</p> : <ul className="ow-file-list">
          {lines.map((l, i) => <li key={`${l.at}-${i}`} className="ow-file-line"><span className="ow-mono ow-file-when">{l.when}</span><span>{l.text}</span></li>)}
        </ul>}
      </div>
      {c && <>
        <span className="ow-paper-rule" />
        <div className="ow-paper-funds">
          <span className="ow-paper-funds-text">
            <span className="ow-mono ow-paper-kicker">CASE FUNDING WHEN IT CLOSES</span>
            <span className="ow-paper-note">{`Tier ${c.tier} case. Any lawful close pays it.`}{c.closesAt ? ` Closes in ${clockIn(c.closesAt, now)}.` : ''}</span>
          </span>
          <span className="ow-paper-amount"><Funds value={c.award} format="full" /></span>
        </div>
      </>}
    </article>
    {d.ties.length > 0 && <section className="ow-knows" aria-label={`Who knows ${d.name}`}>
      <h3 className="ow-kicker ow-kicker-people">SOMEONE ON YOUR TEAM KNOWS {him.toUpperCase()}</h3>
      {d.ties.map((t) => {
        const officer = g.officers[t.officerId];
        return <div key={t.id} className="ow-tie">
          <Face size="lg" kind="officer" officer={officer} name={t.officerName} />
          <span className="ow-tie-text"><b>{officer?.surname ?? t.officerName}</b> {lowerFirst(TIE_LINE[t.kind as TieKind])}.</span>
        </div>;
      })}
      <p className="ow-note">It is on the record. Their knowledge stays useful, and someone else makes the arrest.</p>
    </section>}
    {refusal && <p className="ow-refusal" role="status"><Icon name="info" size={16} />{refusal}</p>}
    {lead && ready && <div className="ow-cta"><Button variant="primary" block onClick={plan}>{lead.status === 'warrant' ? 'Open the warrant' : 'Plan the warrant'}</Button></div>}
    {lead && !ready && lead.status === 'open' && <p className="ow-note">The crew needs more intel before a warrant can be written on {d.name}.</p>}
  </div>;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
