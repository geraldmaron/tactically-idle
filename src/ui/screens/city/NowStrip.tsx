import { useState } from 'react';
import { getState } from '../../store';
import { getScenario } from '../../../sim/scenario-registry';
import type { GameState } from '../../../sim/types';
import { DISTRICTS } from '../../../content/city/districts';
import { Button } from '../../components/ui';
import { useNav } from '../../components/nav';
import { useToast } from '../../components/toast';
import { Icon } from '../../icons';
import { CallTypeBadge } from '../../icons/CallTypeBadge';
import { placeFor, plateUrl, sceneFor } from '../../art/Plates';
import { Funds } from '../../components/Funds';
import { placeTags, scenarioPlaceName } from '../../components/incident';
import { duration } from '../../format';
import { scenarioTitle } from '../helpers';
import { cardType, nowItem, type NowItem } from './now';
import { openCallBrief } from './callBrief';
import './city-panels.css';

/** A painted thumbnail, or a quiet tinted block with an icon when no plate is ready. */
function Thumb({ src, icon }: { src: string | null; icon: 'calls' | 'search' | 'radio' }) {
  const [failed, setFailed] = useState(false);
  return <span className="city-thumb" aria-hidden="true">
    {src && !failed ? <img src={src} alt="" decoding="async" draggable={false} onError={() => setFailed(true)} /> : <Icon name={icon} size={24} />}
  </span>;
}

function liveThumb(scenarioId: string): string | null {
  const scenario = getScenario(scenarioId);
  return placeFor(scenario?.locationFamilyId ?? scenario?.incident?.familyId) ?? sceneFor(scenario?.incident?.type);
}

/** The Now strip (B1): the one thing waiting on the player. A live call or an armed contact wears the signal
 * red; a warrant is cyan; the next call is plain; nothing waiting is one quiet line. */
export function NowStrip({ g, at }: { g: GameState; at: number }) {
  const nav = useNav();
  const { act } = useToast();
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const item: NowItem = nowItem(g, at, kept);

  if (item.kind === 'live') {
    return <button type="button" className="city-now city-now-live" onClick={() => nav.go('ops')} aria-label={`${item.title}. ${item.debrief ? 'Debrief ready' : 'Live call'}. Return`}>
      <Thumb src={liveThumb(item.scenarioId)} icon="radio" />
      <span className="city-now-main">
        <span className="city-now-kicker">{item.debrief ? 'DEBRIEF READY' : `LIVE · MINUTE ${item.minute}`}</span>
        <b>{item.title}</b>
        <span className="city-now-line">{item.debrief ? 'The call is over. The debrief settles it.' : 'Your squad is on scene. A decision is waiting on you.'}</span>
      </span>
      <Icon name="chevronRight" size={20} />
    </button>;
  }

  if (item.kind === 'armed') {
    const respond = () => {
      const result = act({ type: 'respondToContact', leadId: item.lead.id });
      if (!result.ok) return;
      const cardId = getState().world.leads.find((l) => l.id === item.lead.id)?.cardId;
      if (cardId) openCallBrief(nav, cardId);
    };
    return <div className="city-now city-now-live city-now-armed">
      <Thumb src={plateUrl('scene_active_armed_incident')} icon="radio" />
      <span className="city-now-main">
        <span className="city-now-kicker">LIVE · {DISTRICTS[item.lead.districtId].name.toUpperCase()} · {duration(item.left).toUpperCase()} TO ANSWER</span>
        <b>{item.title}</b>
        <span className="city-now-line">{item.line}</span>
        <span className="city-now-actions">
          <Button variant="primary" size="sm" onClick={respond}>Respond now</Button>
          <Button variant="quiet" size="sm" onClick={() => setKept(new Set([...kept, item.lead.id]))}>Keep as a lead</Button>
        </span>
      </span>
    </div>;
  }

  if (item.kind === 'warrant') {
    const open = () => {
      if (item.onBoard && item.cardId) openCallBrief(nav, item.cardId);
      else nav.go('ops');
    };
    return <button type="button" className="city-now city-now-warrant" onClick={open} aria-label={`${item.title}. ${item.line}`}>
      <Thumb src={plateUrl('scene_barricaded')} icon="search" />
      <span className="city-now-main">
        <span className="city-now-kicker">{item.onBoard ? 'WARRANT ON THE BOARD' : 'WARRANT READY'} · {DISTRICTS[item.lead.districtId].name.toUpperCase()}</span>
        <b>{item.title}</b>
        <span className="city-now-line">{item.line}</span>
      </span>
      <Icon name="chevronRight" size={20} />
    </button>;
  }

  if (item.kind === 'call') {
    const def = getScenario(item.card.id);
    const place = placeTags(def?.locationFamilyId ?? item.card.familyId, scenarioPlaceName(def)).name ?? 'Call on the board';
    const pay = def?.rewards?.funding ?? 0;
    const world = !!item.card.world;
    const soon = !world && item.left < 3_600_000;
    return <button type="button" className="city-now city-now-call" onClick={() => openCallBrief(nav, item.card.id)} aria-label={`${item.title}. ${world ? '' : `${duration(item.left)} left. `}Open`}>
      <Thumb src={placeFor(getScenario(item.card.id)?.locationFamilyId ?? item.card.familyId) ?? sceneFor(cardType(item.card))} icon="calls" />
      <span className="city-now-main">
        <span className="city-now-kicker">NEXT CALL{world ? '' : ` · ${duration(item.left).toUpperCase()}`}</span>
        <b>{scenarioTitle(g, item.card.id, at)}</b>
        <span className="city-now-line" data-tone={soon ? 'warn' : undefined}>
          <CallTypeBadge type={cardType(item.card)} size={16} />
          <span className="city-now-place">{place}</span>
          {pay > 0 && <Funds value={pay} />}
        </span>
        {item.waiting > 1 && <span className="city-now-more">{item.waiting - 1} more waiting</span>}
      </span>
      <Icon name="chevronRight" size={20} />
    </button>;
  }

  return <div className="city-now city-now-quiet"><Icon name="check" size={20} /><span className="city-now-line">{item.line}</span></div>;
}
