import { useState } from 'react';
import { getScenario } from '../../../sim/scenario-registry';
import { useGame } from '../../store';
import { Button } from '../../components/ui';
import { Face } from '../../components/Face';
import { Sheet } from '../../components/Sheet';
import { useChromeMode } from '../../components/chrome';
import { ROLE_META } from '../../components/labels';
import { placeTags, scenarioPlaceName } from '../../components/incident';
import { useNav } from '../../components/nav';
import { Icon } from '../../icons';
import { ADVISORY_THEMES, SETTINGS_TEXT } from '../../settings/labels';
import { PlateArt, placeFor, sceneFor } from '../../art/Plates';
import { scenarioTitle } from '../helpers';
import { clockStamp } from './clock';
import { callHook, firstCallOfficers, firstScenarioId, radioLineFrom } from './first-call';
import { openCallBrief } from './callBrief';
import './city-onboarding.css';

/** A1, the cold open: the first call, as the first thing a new player sees. A painted place, a LIVE kicker, two
 * sentences, the four faces with their roles, one radio line, and the one button. No menus, no store, no
 * account (docs/world-redesign.md, "First open"). */
export function ColdOpen() {
  useChromeMode('focus');
  const g = useGame();
  const nav = useNav();
  const [themes, setThemes] = useState(false);
  const at = Math.max(Date.now(), g.department.clockHighWater);
  const scenarioId = firstScenarioId(g, at);
  const def = scenarioId ? getScenario(scenarioId) : undefined;
  const running = !!g.activeRun && g.activeRun.status !== 'closed';
  const officers = firstCallOfficers(g, at);
  const radio = radioLineFrom(g, officers);
  const place = placeTags(def?.locationFamilyId ?? def?.incident?.familyId, scenarioPlaceName(def)).name;
  const plate = placeFor(def?.locationFamilyId ?? def?.incident?.familyId) ?? sceneFor(def?.incident?.type);
  const title = scenarioId ? scenarioTitle(g, scenarioId, at) : 'The first call';
  const hook = callHook(scenarioId);
  const take = () => { if (running) nav.go('ops'); else if (scenarioId) openCallBrief(nav, scenarioId); else nav.go('ops'); };
  return (
    <main className="cold" aria-labelledby="cold-title">
      <div className="cold-plate plate" aria-hidden="true">
        <PlateArt src={plate} />
        <span className="cold-brand">Tactically Idle</span>
      </div>
      <div className="cold-body">
        <p className="cold-live"><i aria-hidden="true" />LIVE · {clockStamp(g, at).time}{place ? ` · ${place.toUpperCase()}` : ''}</p>
        <h1 id="cold-title" className="cold-title">{title}</h1>
        {hook && <p className="cold-hook">{hook}</p>}
        {officers.length > 0 && <ul className="cold-team" aria-label="Your officers">{officers.map((o) => <li key={o.id}>
          <Face size="lg" kind="officer" officer={o} name={`${o.firstName} ${o.surname}`} />
          <b>{o.surname}</b>
          <span>{ROLE_META[o.role].short.toUpperCase()}</span>
        </li>)}</ul>}
        {radio && <p className="cold-radio"><Icon name="radio" size={18} /><span><span className="cold-radio-who">{radio.surname.toUpperCase()} ON RADIO</span><span>{radio.line}</span></span></p>}
      </div>
      <div className="cold-foot">
        <Button variant="primary" block data-primary className="cold-go" onClick={take}>{running ? 'Back to the call' : 'Take the call'}</Button>
        <div className="cold-small">
          <button type="button" className="cold-link" onClick={() => setThemes(true)}>Themes this game covers</button>
          <span>No account. Saved on this phone.</span>
        </div>
      </div>
      <Sheet open={themes} onClose={() => setThemes(false)} title="Themes this game covers" maxHeight="short">
        <p className="cold-themes-lead">{SETTINGS_TEXT.advisoryIntro}</p>
        <ul className="cold-themes">{ADVISORY_THEMES.map((theme) => <li key={theme}>{theme}</li>)}</ul>
        <p className="cold-themes-note">{SETTINGS_TEXT.leaveCalls}</p>
      </Sheet>
    </main>
  );
}
