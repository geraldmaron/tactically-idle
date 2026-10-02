import { useMemo, useState } from 'react';
import { useGame } from '../store';
import {
  briefing,
  builtForScenario,
  prepCheck,
  scenarioCards,
  spaceViewsForScenario,
} from '../../sim/operation-selectors';
import type { StartOperationCommand } from '../../sim/operation-selectors';
import { squadReadiness, storeOptions } from '../../sim/department-selectors';
import type { StoreOption } from '../../sim/department-selectors';
import { readyUnits, unitEffectiveness } from '../../sim/inventory';
import { stagingPointsIn } from '../../sim/spatial';
import { spaceName } from '../../sim/resolution';
import { ITEMS } from '../../content/items';
import type { Id, ItemUnit, SquadId, StagingPoint } from '../../sim/types';
import { Blueprint } from '../blueprint/Blueprint';
import { Button, Card, Chip, Section, Stepper, SubHead } from '../components/ui';
import { useToast } from '../components/toast';
import { UNIT_STATE_META, unitStateOf } from '../components/labels';
import { Icon, itemIcon } from '../icons';
import type { IconName } from '../icons';
import { pct } from '../format';
import { hasNodeEffect } from './helpers';

type Loadouts = Partial<Record<SquadId, Record<Id, number>>>;

export function OpsPrepare({ scenarioId, onCancel }: { scenarioId: Id; onCancel: () => void }) {
  const g = useGame();
  const now = Date.now();
  const { act } = useToast();
  const card = scenarioCards(g, now).find((c) => c.id === scenarioId);
  const brief = useMemo(() => briefing(scenarioId), [scenarioId]);
  const built = useMemo(() => builtForScenario(scenarioId), [scenarioId]);
  const spaces = useMemo(() => spaceViewsForScenario(scenarioId), [scenarioId]);
  const store = storeOptions(g);
  const presets = hasNodeEffect(g, 'loadoutPresets');

  const [chosen, setChosen] = useState<SquadId[]>([]);
  const [positions, setPositions] = useState<Partial<Record<SquadId, Id>>>({});
  const [loadouts, setLoadouts] = useState<Loadouts>({});
  const [staging, setStaging] = useState<Partial<Record<SquadId, Id>>>({});
  const [practice, setPractice] = useState(false);

  const range = card?.squadRange ?? { min: 1, max: 3 };
  const defaultEntry = brief.entries[0]?.id;

  /** Staging points available from a squad's starting zone. */
  const pointsFor = (sid: SquadId): StagingPoint[] => {
    const p = positions[sid] ?? defaultEntry;
    return p ? stagingPointsIn(built, p) : [];
  };

  /** The exact units each squad will take: best-condition ready units, never the same unit twice. Matches the engine's rule. */
  const picks = useMemo(() => {
    const taken = new Set<Id>();
    const out: Partial<Record<SquadId, Record<Id, ItemUnit[]>>> = {};
    for (const sid of chosen) {
      const per: Record<Id, ItemUnit[]> = {};
      for (const [itemId, qty] of Object.entries(loadouts[sid] ?? {})) {
        if (qty <= 0) continue;
        const take = readyUnits(g, itemId)
          .filter((u) => !taken.has(u.id))
          .slice(0, qty);
        take.forEach((u) => taken.add(u.id));
        per[itemId] = take;
      }
      out[sid] = per;
    }
    return out;
  }, [g, chosen, loadouts]);

  const cmd: StartOperationCommand = useMemo(() => {
    const pos: Partial<Record<SquadId, Id>> = {};
    const lo: Loadouts = {};
    const units: Partial<Record<SquadId, Id[]>> = {};
    const stage: Partial<Record<SquadId, Id>> = {};
    for (const s of chosen) {
      const p = positions[s] ?? defaultEntry;
      if (p) pos[s] = p;
      lo[s] = Object.fromEntries(Object.entries(loadouts[s] ?? {}).filter(([, q]) => q > 0));
      const ids = Object.values(picks[s] ?? {}).flat().map((u) => u.id);
      if (ids.length > 0) units[s] = ids;
      const st = staging[s];
      if (p && st && stagingPointsIn(built, p).some((x) => x.id === st)) stage[s] = st;
    }
    return {
      type: 'startOperation',
      scenarioId,
      squadIds: chosen,
      positions: pos,
      loadouts: lo,
      ...(Object.keys(units).length > 0 ? { units } : {}),
      ...(Object.keys(stage).length > 0 ? { staging: stage } : {}),
      practice,
    };
  }, [chosen, positions, loadouts, picks, staging, practice, scenarioId, defaultEntry, built]);
  const check = prepCheck(g, now, cmd);

  const toggleSquad = (id: SquadId) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].sort()));

  /** Quantity of an item already allocated to every chosen squad except `except`. */
  const allocated = (itemId: Id, except: SquadId) => chosen.filter((s) => s !== except).reduce((n, s) => n + (loadouts[s]?.[itemId] ?? 0), 0);
  const setQty = (squad: SquadId, itemId: Id, qty: number) => setLoadouts((l) => ({ ...l, [squad]: { ...(l[squad] ?? {}), [itemId]: qty } }));
  const readyOf = (itemId: Id) => readyUnits(g, itemId).length;
  const applyPreset = (squad: SquadId) => {
    const preset = g.squads.find((s) => s.id === squad)?.loadoutPreset ?? {};
    const next: Record<Id, number> = {};
    for (const [itemId, q] of Object.entries(preset)) {
      next[itemId] = Math.max(0, Math.min(q, readyOf(itemId) - allocated(itemId, squad)));
    }
    setLoadouts((l) => ({ ...l, [squad]: next }));
  };

  const deploy = () => act(cmd, practice ? 'Practice started' : 'Squads deployed');

  return (
    <div className="page prepare">
      <div className="prep-head">
        <button type="button" className="back" onClick={onCancel}>
          <Icon name="chevronLeft" size={18} />
          Operations
        </button>
        <div className="prep-title">
          <span className="opboard-code">{card?.code ?? 'OP'}</span>
          <h2 className="live-name">{(card?.title ?? scenarioId.replace(/_/g, ' ')).toUpperCase()}</h2>
        </div>
      </div>

      <div className="prep-map" aria-label="Location preview">
        <Blueprint built={built} spaces={spaces} squadTasks={[]} selectedSpaceId={null} focusSquadId={null} />
      </div>

      <Section title="Briefing" icon="intel">
        <Card>
          <BriefList icon="check" tone="mint" title="Known" items={brief.known} empty="Nothing confirmed yet." />
          <BriefList icon="question" tone="amber" title="Unknown" items={brief.unknown} empty="No open questions." />
          <BriefList icon="flag" tone="neutral" title="Objectives" items={brief.objectives} empty="No objectives listed." />
        </Card>
      </Section>

      <Section title="Squads" icon="people" hint={`This operation takes ${range.min === range.max ? range.min : `${range.min} to ${range.max}`} squad${range.max > 1 ? 's' : ''}.`}>
        {g.squads.length === 0 ? (
          <Card>
            <p className="dim">Create a squad on the Squad tab first.</p>
          </Card>
        ) : (
          <div className="squadpick">
            {g.squads.map((s) => {
              const r = squadReadiness(g, s.id, now);
              const on = chosen.includes(s.id);
              return (
                <button key={s.id} type="button" className={`pickcard${on ? ' pickcard-on' : ''}`} aria-pressed={on} onClick={() => toggleSquad(s.id)}>
                  <span className="squad-badge">{s.id}</span>
                  <span className="pickcard-main">
                    <strong>{s.name}</strong>
                    <span className={r.deployable ? 'tone-mint' : 'tone-warn'}>
                      {r.ready}/{r.total} ready{r.deployable ? '' : ' · not deployable'}
                    </span>
                    {r.issues.slice(0, 1).map((i, k) => (
                      <span key={k} className="dim">
                        {i}
                      </span>
                    ))}
                  </span>
                  <span className="pickcard-check">{on && <Icon name="check" size={18} />}</span>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {chosen.map((sid) => {
        const squad = g.squads.find((s) => s.id === sid)!;
        const hasPreset = Object.values(squad.loadoutPreset).some((q) => q > 0);
        const visible = store.filter((o: StoreOption) => o.owned > 0 || brief.usefulItemIds.includes(o.item.id));
        const points = pointsFor(sid);
        const chosenPoint = cmd.staging?.[sid] ?? null;
        const unreliable = Object.values(picks[sid] ?? {})
          .flat()
          .filter((u) => unitStateOf(u.condition, ITEMS[u.itemId].wear) !== 'Good' && unitStateOf(u.condition, ITEMS[u.itemId].wear) !== 'Worn');
        return (
          <section key={sid} className="card prepsquad" aria-label={`Squad ${sid} setup`}>
            <div className="prepsquad-head">
              <span className="squad-badge">{sid}</span>
              <strong>{squad.name}</strong>
            </div>
            <label className="field">
              <span className="field-label">
                <Icon name="pin" size={14} />
                Starting position
              </span>
              <select
                value={positions[sid] ?? defaultEntry ?? ''}
                onChange={(e) => {
                  setPositions((p) => ({ ...p, [sid]: e.target.value }));
                  setStaging((st) => {
                    const { [sid]: _drop, ...rest } = st;
                    return rest;
                  });
                }}
                disabled={brief.entries.length === 0}
              >
                {brief.entries.length === 0 && <option value="">No entries listed</option>}
                {brief.entries.map((en) => (
                  <option key={en.id} value={en.id}>
                    {en.label}
                  </option>
                ))}
              </select>
            </label>
            {points.length > 0 && (
              <div className="field">
                <span className="field-label" id={`stage-${sid}`}>
                  <Icon name="door" size={14} />
                  Staging point
                </span>
                <div className="stagelist" role="radiogroup" aria-labelledby={`stage-${sid}`}>
                  <StageOption on={chosenPoint === null} icon="pin" title="No preference" sub="Squad holds the zone as a whole" onPick={() => setStaging((st) => omit(st, sid))} />
                  {stageLabels(built, points).map(({ point, title, sub, icon }) => (
                    <StageOption key={point.id} on={chosenPoint === point.id} icon={icon} title={title} sub={sub} onPick={() => setStaging((st) => ({ ...st, [sid]: point.id }))} />
                  ))}
                </div>
              </div>
            )}
            <div className="prepsquad-lo">
              <SubHead icon="box">Loadout</SubHead>
              {hasPreset && presets.unlocked && (
                <Button size="sm" onClick={() => applyPreset(sid)}>
                  Apply preset
                </Button>
              )}
            </div>
            {visible.length === 0 ? (
              <p className="dim">No equipment in stock. Buy gear on the Gear tab.</p>
            ) : (
              <ul className="loadout">
                {visible.map((o) => {
                  const free = Math.max(0, readyOf(o.item.id) - allocated(o.item.id, sid));
                  const qty = loadouts[sid]?.[o.item.id] ?? 0;
                  const useful = brief.usefulItemIds.includes(o.item.id);
                  const units = picks[sid]?.[o.item.id] ?? [];
                  return (
                    <li key={o.item.id} className={`lo lo-wrap${useful ? ' lo-useful' : ''}`}>
                      <div className="lo-line">
                        <Icon name={itemIcon(o.item.id)} size={22} />
                        <span className="lo-main">
                          <strong>{o.item.name}</strong>
                          <span className="lo-sub">
                            <span className="dim">{free} ready</span>
                            {useful && (
                              <Chip tone="amber" icon="check">
                                Useful
                              </Chip>
                            )}
                          </span>
                        </span>
                        <Stepper label={o.item.name} value={qty} max={Math.max(qty, free)} onChange={(n) => setQty(sid, o.item.id, Math.min(n, Math.max(qty, free)))} />
                      </div>
                      {units.length > 0 && (
                        <ul className="lo-units" aria-label={`Units taking ${o.item.name}`}>
                          {units.map((u) => {
                            const state = unitStateOf(u.condition, o.item.wear);
                            const meta = UNIT_STATE_META[state];
                            return (
                              <li key={u.id} className={`lo-unit lo-unit-${meta.tone}`}>
                                <Icon name={meta.icon} size={13} />
                                <b>{u.serial}</b>
                                <span>
                                  {Math.round(u.condition)}% · {state}
                                  {meta.tone === 'bad' ? ` · ${pct(unitEffectiveness(u, o.item))} effect` : ''}
                                </span>
                              </li>
                            );
                          })}
                          {units.length < qty && (
                            <li className="lo-unit lo-unit-bad">
                              <Icon name="warning" size={13} />
                              <span>Only {units.length} of {qty} ready</span>
                            </li>
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {unreliable.length > 0 && (
              <p className="note note-amber">
                <Icon name="warning" size={16} />
                {unreliable.map((u) => u.serial).join(', ')} {unreliable.length === 1 ? 'is' : 'are'} unreliable: reduced effect and a chance of malfunction. Service {unreliable.length === 1 ? 'it' : 'them'} on the Gear tab or take a better unit.
              </p>
            )}
          </section>
        );
      })}

      <Section title="Mode" icon="flag">
        <label className="toggle">
          <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} />
          <span className="toggle-ui" aria-hidden="true" />
          <span className="toggle-text">
            <strong>Practice run</strong>
            <span className="dim">No rewards and no consequences: stress, supplies and trust are untouched. Good for trying a different squad.</span>
          </span>
        </label>
      </Section>

      <div className="prepcheck" aria-live="polite">
        {check.issues.map((i, k) => (
          <p key={`i${k}`} className="note note-warn">
            <Icon name="lock" size={16} />
            {i}
          </p>
        ))}
        {check.warnings.map((w, k) => (
          <p key={`w${k}`} className="note note-amber">
            <Icon name="warning" size={16} />
            {w}
          </p>
        ))}
        {check.ok && check.warnings.length === 0 && (
          <p className="note note-mint">
            <Icon name="check" size={16} />
            Ready to deploy.
          </p>
        )}
      </div>

      <div className="stickyfoot prepfoot">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!check.ok} onClick={deploy}>
          {practice ? 'Start practice' : 'Deploy'}
        </Button>
      </div>
    </div>
  );
}

function BriefList({ icon, tone, title, items, empty }: { icon: 'check' | 'question' | 'flag'; tone: 'mint' | 'amber' | 'neutral'; title: string; items: string[]; empty: string }) {
  return (
    <div className="brief">
      <h3 className={`brief-h tone-${tone}`}>
        <Icon name={icon} size={16} />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="dim">{empty}</p>
      ) : (
        <ul>
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function omit<T extends Record<string, unknown>>(o: T, key: string): T {
  const { [key]: _drop, ...rest } = o;
  return rest as T;
}

function StageOption({ on, icon, title, sub, onPick }: { on: boolean; icon: IconName; title: string; sub: string; onPick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`stageopt${on ? ' stageopt-on' : ''}`} onClick={onPick}>
      <Icon name={icon} size={20} />
      <span className="stageopt-main">
        <strong>{title}</strong>
        <span className="dim">{sub}</span>
      </span>
      <span className="stageopt-check">{on && <Icon name="check" size={18} />}</span>
    </button>
  );
}

/** 'Hall door', 'East bedroom window': what the point faces plus how the squad gets there. Duplicates get a number. */
function stageLabels(built: ReturnType<typeof builtForScenario>, points: StagingPoint[]): { point: StagingPoint; title: string; sub: string; icon: IconName }[] {
  const base = points.map((p) => {
    const faces = spaceName(built, p.facesId);
    const kind = p.kind === 'window' ? 'window' : p.kind === 'doorway' ? 'doorway' : 'door';
    return { point: p, title: `${faces} ${kind}`, sub: `From ${spaceName(built, p.spaceId)}`, icon: (p.kind === 'window' ? 'window' : 'door') as IconName };
  });
  const seen = new Map<string, number>();
  const total = new Map<string, number>();
  for (const b of base) total.set(b.title, (total.get(b.title) ?? 0) + 1);
  return base.map((b) => {
    if ((total.get(b.title) ?? 0) < 2) return b;
    const n = (seen.get(b.title) ?? 0) + 1;
    seen.set(b.title, n);
    return { ...b, title: `${b.title} ${n}` };
  });
}
