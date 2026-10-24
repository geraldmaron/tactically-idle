import { useEffect, useState } from 'react';
import { ARCHETYPES } from '../../../content/city/archetypes';
import { DISTRICTS } from '../../../content/city/districts';
import { subjectName } from '../../../sim/world/population';
import { useGame } from '../../store';
import { Button, SwitchRow } from '../../components/ui';
import { Face } from '../../components/Face';
import { Funds } from '../../components/Funds';
import { Sheet } from '../../components/Sheet';
import { duration } from '../../format';
import { clockStamp } from './clock';
import { readNotify, writeNotify, type NotifyPrefs } from './notify-prefs';
import './city-onboarding.css';

const SEEN_KEY = 'ti-first-custody';
const seenKey = (seed: number, caseId: string) => `${seed}:${caseId}`;
const readSeen = (): string | null => { try { return globalThis.localStorage?.getItem(SEEN_KEY) ?? null; } catch { return null; } };
let seenMemory: string | null = null;
const markSeen = (key: string) => { seenMemory = key; try { globalThis.localStorage?.setItem(SEEN_KEY, key); } catch { /* the choice still holds for this page */ } };

/** A3, first custody: over the dimmed city, who the unit's first stop was and what it is worth, then the one
 * notification ask, tied to the shift that just started. Declining changes nothing. Shown once per campaign. */
export function FirstCustody() {
  const g = useGame();
  const onboarding = g.world.onboarding;
  const key = onboarding.firstCaseId ? seenKey(g.world.seed, onboarding.firstCaseId) : null;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (onboarding.stage === 'first_shift' && key && readSeen() !== key && seenMemory !== key) setOpen(true);
  }, [onboarding.stage, key]);
  const [draft, setDraft] = useState<Pick<NotifyPrefs, 'finished' | 'calls' | 'digest'>>(() => { const p = readNotify(); return { finished: p.finished, calls: p.calls, digest: p.digest }; });
  const c = onboarding.firstCaseId ? g.world.cases.find((k) => k.id === onboarding.firstCaseId) : undefined;
  const subject = c ? g.world.subjects[c.subjectId] : undefined;
  if (!c || !subject || !key) return null;
  const crew = c.crewId ? g.world.crews.find((k) => k.id === c.crewId) : undefined;
  const tierName = crew ? ARCHETYPES[crew.archetype].tierNames[c.tier - 1] : null;
  const unit = g.world.events.find((e) => e.kind === 'contact' && e.subjectId === subject.id)?.unit;
  const him = subject.pronouns === 'she' ? 'her' : subject.pronouns === 'he' ? 'him' : 'them';
  const at = Math.max(Date.now(), g.department.clockHighWater);
  const close = (turnOn: boolean) => {
    writeNotify(turnOn ? { ...draft, asked: true } : { asked: true });
    markSeen(key);
    setOpen(false);
  };
  const intel = crew ? ARCHETYPES[crew.archetype].intelPerCase[c.tier as 1 | 2 | 3] : 0;
  return <Sheet open={open} onClose={() => close(false)} title="First custody" subtitle={<span className="custody-kicker">{DISTRICTS[c.districtId].name.toUpperCase()} · {clockStamp(g, c.openedAt).time}</span>} className="custody-sheet"
    footer={<div className="custody-actions">
      <Button variant="quiet" block onClick={() => close(false)}>Not now</Button>
      <Button variant="primary" block data-primary onClick={() => close(true)}>Turn these on</Button>
    </div>}>
    <section className="custody" aria-label="First custody">
      <div className="custody-subject">
        <Face size="lg" kind="subject" seed={subject.id} />
        <span className="custody-subject-main">
          <b>{subjectName(subject)}</b>
          <span className="custody-muted">{[tierName, crew?.name, `tier ${c.tier}`].filter(Boolean).join(' · ')}</span>
          <span>{unit ? `Unit ${unit} held ${him}.` : `Patrol held ${him}.`} Nobody was hurt.</span>
        </span>
      </div>
      <div className="custody-tiles">
        <div className="custody-tile"><span>CASE FUNDING</span><b><Funds value={c.award} format="full" /></b></div>
        <div className="custody-tile"><span>CLOSES IN</span><b>{c.closesAt ? duration(Math.max(0, c.closesAt - at)) : 'Waiting on a warrant'}</b></div>
        <div className="custody-tile"><span>INTEL</span><b className="custody-intel">{intel > 0 ? `+${intel}` : 'None yet'}</b></div>
      </div>
      <hr className="custody-rule" />
      <div className="custody-ask">
        <b>Your first shift runs two hours. Want a buzz when it ends?</b>
        <span className="custody-muted">Pick what is worth one. Saying no changes nothing in the game.</span>
      </div>
      <div className="custody-toggles" data-ui-list>
        <SwitchRow icon="bell" title="Shifts and training finish" checked={draft.finished} onChange={(finished) => setDraft({ ...draft, finished })} />
        <SwitchRow icon="calls" title="A call drops in your city" checked={draft.calls} onChange={(calls) => setDraft({ ...draft, calls })} />
        <SwitchRow icon="calendar" title="One daily digest instead" checked={draft.digest} onChange={(digest) => setDraft({ ...draft, digest })} />
      </div>
    </section>
  </Sheet>;
}

