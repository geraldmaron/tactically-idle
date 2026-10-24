import { useState } from 'react';
import type { GameState } from '../../../sim/types';
import { getScenario } from '../../../sim/scenario-registry';
import { Button, EmptyState, Ring, Section } from '../../components/ui';
import { Icon } from '../../icons';
import { CallTypeBadge } from '../../icons/CallTypeBadge';
import { OutcomeMark } from '../../icons/marks';
import { Portrait } from '../../portraits/Portrait';
import { signedMoney } from '../../format';
import { scenarioTitle } from '../helpers';
import { SavedDebriefReview } from '../OpsDebrief';
import './results.css';

/** Recent results: the only way back to a saved debrief (sol challenge), kept when the old HQ screen retired.
 * Operations' Archive reads the same saved debriefs; this list keeps its tile and its review sheet. */
export function Debriefs({ g, now }: { g: GameState; now: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selected = g.debriefs.find((debrief) => debrief.runId === selectedId) ?? null;
  // Nothing played yet: the empty state alone, without a heading that says the same thing.
  if (g.debriefs.length === 0) return <EmptyState compact icon="chart" title="No results yet">Your first finished call shows here with what decided it.</EmptyState>;
  return (
    <Section id="city-results" title="Recent results" icon="chart">
      <div className="stack">
        {(expanded ? g.debriefs : g.debriefs.slice(0, 5)).map((d) => (
          <DebriefTile key={d.runId} g={g} d={d} now={now} open={selectedId === d.runId} onOpen={() => setSelectedId(d.runId)} />
        ))}
        {g.debriefs.length > 5 && <Button onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? 'Show recent five' : `Show all ${g.debriefs.length} saved results`}</Button>}
      </div>
      <SavedDebriefReview debrief={selected} officers={g.officers} onClose={() => setSelectedId(null)} />
    </Section>
  );
}

const present = <T,>(value: T | undefined): value is T => !!value;

/** Result as a glance: two score rings, who went, and rewards as icon chips. The tone is the card's whole
 * border, never a bar down one edge. The ending title stays the headline; the full record opens on tap. */
function DebriefTile({ g, d, now, open, onOpen }: { g: GameState; d: GameState['debriefs'][number]; now: number; open: boolean; onOpen: () => void }) {
  const worst = Math.min(d.objective.score, d.civilianSafety.score);
  const tone = worst >= 80 ? 'good' : worst >= 50 ? 'mixed' : 'poor';
  const band = tone === 'good' ? 'favorable' : tone === 'mixed' ? 'mixed' : 'adverse';
  const type = getScenario(d.scenarioId)?.incident?.type;
  const team = d.officerCondition.map((row) => g.officers[row.officerId]).filter(present).slice(0, 4);
  return (
    <button type="button" className={`debrief-tile debrief-tile-${tone}`} onClick={onOpen} aria-haspopup="dialog" aria-expanded={open} aria-label={`Review result: ${d.endingTitle}`}>
      <span className="debrief-rings" aria-hidden="true">
        <Ring value={d.objective.score}><Icon name="flag" size={16} /></Ring>
        <Ring value={d.civilianSafety.score}><Icon name="civilian" size={16} /></Ring>
      </span>
      <span className="debrief-tile-main">
        <span className="debrief-tile-kicker">{type && <CallTypeBadge type={type} size={18} />}{scenarioTitle(g, d.scenarioId, now)}</span>
        <strong className="debrief-tile-title">{d.endingTitle}</strong>
        <span className="debrief-tile-sub"><OutcomeMark band={band} label={`${d.objective.label}`} showLabel={false} size={14} />Objective {d.objective.label.toLowerCase()} · Civilians {d.civilianSafety.label.toLowerCase()}</span>
        <span className="debrief-tile-foot">
          {team.length > 0 && <span className="debrief-team" aria-hidden="true">{team.map((officer) => <span key={officer.id} className="debrief-team-face"><Portrait officer={officer} size={24} /></span>)}</span>}
          <span className="debrief-reward tone-mint"><Icon name="funds" size={16} />{signedMoney(d.fundingReward)}</span>
          <span className={`debrief-reward ${d.trustDelta >= 0 ? '' : 'tone-danger'}`}><Icon name="shield" size={16} />{d.trustDelta >= 0 ? '+' : ''}{d.trustDelta}</span>
        </span>
      </span>
      <Icon name="chevronRight" size={16} className="debrief-tile-go" />
    </button>
  );
}
