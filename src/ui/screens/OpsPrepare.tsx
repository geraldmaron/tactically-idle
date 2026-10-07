import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store';
import {
  briefing,
  builtForScenario,
  prepCheck,
  spaceViewsForScenario,
} from '../../sim/operation-selectors';
import type { StartOperationCommand } from '../../sim/operation-selectors';
import { squadReadiness, storeOptions } from '../../sim/department-selectors';
import type { StoreOption } from '../../sim/department-selectors';
import { unitEffectiveness } from '../../sim/inventory';
import { standardRadioPlan, STANDARD_RADIO } from '../../sim/standard-kit';
import { projectedCondition } from '../../sim/equipment';
import { stagingPointsIn } from '../../sim/spatial';
import { spaceName } from '../../sim/resolution';
import { ITEMS } from '../../content/items';
import { autoEquipReadyUnits, autoLoadout } from '../../sim/auto-equip';
import type { AutoLoadout } from '../../sim/auto-equip';
import { getScenario } from '../../sim/scenario-registry';
import type { Id, ItemUnit, KnowledgeStatus, SquadId, StagingPoint } from '../../sim/types';
import { Blueprint } from '../blueprint/Blueprint';
import { floorCount } from '../blueprint/floors';
import { Button, Card, Chip, Section, Stepper, SubHead } from '../components/ui';
import { DifficultyChip, EnvChips, familyBlurb, incidentMeta } from '../components/incident';
import { personInitials } from '../components/IncidentPeople';
import { Portrait } from '../portraits/Portrait';
import { GearArt } from '../art/GearArt';
import { useToast } from '../components/toast';
import { UNIT_STATE_META, unitStateOf } from '../components/labels';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { moneyFull, pct } from '../format';
import { cardFor, hasNodeEffect } from './helpers';
import { planAuto, preparationEquipmentFix } from './autoPlan';
import { scenarioActions } from '../../sim/scenario-types';
import type { AutoNote, Explicit, Loadouts } from './autoPlan';
import { buildIntel } from './intel';
import type { IntelLine } from './intel';
import { handCarriedLoadout, SupportPreparation } from './SupportPreparation';
import { IncidentBriefContext } from './SupportContext';
import { preparationOptions } from './preparation-options';
import { ChoiceRail } from '../components/ChoiceRail';
import { toggleDeploymentSquad } from './operation-squads';
import './preparation-options.css';
import './operation-squads.css';
import './ops-visual.css';

export function OpsPrepare({ scenarioId, onCancel }: { scenarioId: Id; onCancel: () => void }) {
  const pageRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const screen = pageRef.current?.closest('.screen');
    if (screen) screen.scrollTop = 0;
  }, [scenarioId]);
  const g = useGame();
  const now = Date.now();
  const { act, notify } = useToast();
  const card = cardFor(g, scenarioId, now);
  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);
  const built = useMemo(() => builtForScenario(scenarioId), [scenarioId]);
  const spaces = useMemo(() => spaceViewsForScenario(scenarioId), [scenarioId]);
  const intel = useMemo(() => buildIntel(scenario, built), [scenario, built]);
  const store = storeOptions(g);
  const presets = hasNodeEffect(g, 'loadoutPresets');

  const [chosen, setChosen] = useState<SquadId[]>([]);
  const [setupSquad, setSetupSquad] = useState<SquadId | null>(null);
  const visibleSquad = setupSquad && chosen.includes(setupSquad) ? setupSquad : chosen[0] ?? null;
  const brief = useMemo(() => briefing(scenarioId, g, chosen), [scenarioId, g, chosen]);
  const [positions, setPositions] = useState<Partial<Record<SquadId, Id>>>({});
  const [optionalLoadouts, setLoadouts] = useState<Loadouts>({});
  const [explicit, setExplicit] = useState<Explicit>({});
  const [autoNote, setAutoNote] = useState<Partial<Record<SquadId, AutoNote>>>({});
  const [autoWarnings, setAutoWarnings] = useState<string[]>([]);
  const [autoUndo, setAutoUndo] = useState<{
    loadouts: Loadouts;
    explicit: Explicit;
    notes: Partial<Record<SquadId, AutoNote>>;
    warnings: string[];
  } | null>(null);
  const [staging, setStaging] = useState<Partial<Record<SquadId, Id>>>({});
  const [supportUnitId, setSupportUnitId] = useState<Id | null>(null);
  const [floor, setFloor] = useState(0);

  const radioPlan = useMemo(() => standardRadioPlan(g, chosen, now), [g, chosen, now]);
  const loadouts = useMemo<Loadouts>(() => {
    const next = { ...optionalLoadouts };
    for (const sid of chosen) next[sid] = { ...handCarriedLoadout(next[sid] ?? {}), ...radioPlan.loadouts[sid] };
    return next;
  }, [optionalLoadouts, chosen, radioPlan]);

  const range = card?.squadRange ?? scenario?.squadRange ?? { min: 1, max: 3 };
  const defaultEntry = brief.entries[0]?.id;
  const floors = floorCount(built.location);
  // Renderer props that may not be declared yet (floor tabs, environment overlay). Spread so this compiles either way.
  const blueprintExtras = { floor: Math.min(floor, floors - 1), onFloorChange: setFloor, environment: intel.environment ?? undefined };

  /** Staging points available from a squad's starting zone. */
  const pointsFor = (sid: SquadId): StagingPoint[] => {
    const p = positions[sid] ?? defaultEntry;
    return p ? stagingPointsIn(built, p) : [];
  };

  /**
   * The exact units each squad will take. Explicit picks (auto-equip) are honoured first and never taken twice;
   * the rest are filled best-condition first, matching the engine's default rule.
   */
  const picks = useMemo(() => {
    const taken = new Set<Id>();
    const out: Partial<Record<SquadId, Record<Id, ItemUnit[]>>> = {};
    for (const sid of chosen) {
      const per: Record<Id, ItemUnit[]> = {};
      for (const [itemId, qty] of Object.entries(loadouts[sid] ?? {})) {
        if (qty <= 0) continue;
        const want = itemId === STANDARD_RADIO ? radioPlan.units[sid] ?? [] : explicit[sid]?.[itemId] ?? [];
        const usable = autoEquipReadyUnits(g, itemId, now);
        const have = want
          .map((id) => usable.find((u) => u.id === id))
          .filter((u): u is ItemUnit => !!u && !taken.has(u.id))
          .slice(0, qty);
        have.forEach((u) => taken.add(u.id));
        per[itemId] = have;
      }
      out[sid] = per;
    }
    for (const sid of chosen) {
      for (const [itemId, qty] of Object.entries(loadouts[sid] ?? {})) {
        if (qty <= 0) continue;
        const have = out[sid]?.[itemId] ?? [];
        const more = autoEquipReadyUnits(g, itemId, now)
          .filter((u) => !taken.has(u.id))
          .slice(0, Math.max(0, qty - have.length));
        more.forEach((u) => taken.add(u.id));
        out[sid]![itemId] = [...have, ...more];
      }
    }
    return out;
  }, [g, chosen, loadouts, explicit, radioPlan, now]);

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
      ...(supportUnitId ? { supportUnitIds: [supportUnitId] } : {}),
    };
  }, [chosen, positions, loadouts, picks, staging, supportUnitId, scenarioId, defaultEntry, built]);
  const check = prepCheck(g, now, cmd);

  const toggleSquad = (id: SquadId) => {
    setAutoUndo(null);
    const next = toggleDeploymentSquad(chosen, id, Math.min(range.max, 3));
    setChosen(next);
    if (next.includes(id)) setSetupSquad(id);
  };

  /** Quantity of an item already allocated to every chosen squad except `except`. */
  const allocated = (itemId: Id, except: SquadId) => chosen.filter((s) => s !== except).reduce((n, s) => n + (loadouts[s]?.[itemId] ?? 0), 0);
  const readyOf = (itemId: Id) => autoEquipReadyUnits(g, itemId, now).length;
  const touch = (squad: SquadId) => setAutoNote((n) => (n[squad] && !n[squad]!.edited ? { ...n, [squad]: { ...n[squad]!, edited: true } } : n));
  const dropPicks = (squad: SquadId, itemId?: Id) =>
    setExplicit((e) => {
      if (!e[squad]) return e;
      if (!itemId) return omit(e, squad);
      return { ...e, [squad]: omit(e[squad]!, itemId) };
    });
  const setQty = (squad: SquadId, itemId: Id, qty: number) => {
    if (itemId === STANDARD_RADIO || ITEMS[itemId]?.supportOnly) return;
    setAutoUndo(null);
    setLoadouts((l) => ({ ...l, [squad]: { ...(l[squad] ?? {}), [itemId]: qty } }));
    dropPicks(squad, itemId);
    touch(squad);
  };
  const applyPreset = (squad: SquadId) => {
    setAutoUndo(null);
    const preset = g.squads.find((s) => s.id === squad)?.loadoutPreset ?? {};
    const next: Record<Id, number> = {};
    for (const [itemId, q] of Object.entries(handCarriedLoadout(preset))) {
      next[itemId] = Math.max(0, Math.min(q, readyOf(itemId) - allocated(itemId, squad)));
    }
    setLoadouts((l) => ({ ...l, [squad]: next }));
    dropPicks(squad);
    touch(squad);
  };

  /**
   * Fill untouched choices only. Existing quantities (including zero) and exact
   * picks reserve stock first; a single-squad request leaves the others alone.
   */
  const runAuto = (only?: SquadId) => {
    if (chosen.length === 0 || (only && !chosen.includes(only))) return;
    let res: AutoLoadout;
    try {
      res = autoLoadout(g, scenarioId, chosen, Date.now(), {
        loadouts,
        units: Object.fromEntries(chosen.map((s) => [s, Object.values(picks[s] ?? {}).flat().map((u) => u.id)])),
        targets: only ? [only] : chosen,
      });
    } catch {
      notify('Auto-equip is not available right now', { tone: 'error' });
      return;
    }
    const plan = planAuto({
      res,
      targets: only ? [only] : chosen,
      itemOf: (id) => g.units[id]?.itemId,
    });
    if (res.added > 0) setAutoUndo({ loadouts, explicit, notes: autoNote, warnings: autoWarnings });
    setLoadouts((l) => ({ ...l, ...plan.loadouts }));
    setExplicit((e) => ({ ...e, ...plan.explicit }));
    setAutoNote((n) => ({ ...n, ...plan.notes }));
    setAutoWarnings(res.warnings);
    notify(res.added > 0 ? `Added ${res.added} item${res.added === 1 ? '' : 's'} from stock` : 'No extra gear added; current choices kept', { tone: res.added > 0 ? 'ok' : 'amber' });
  };

  const undoAuto = () => {
    if (!autoUndo) return;
    setLoadouts(autoUndo.loadouts);
    setExplicit(autoUndo.explicit);
    setAutoNote(autoUndo.notes);
    setAutoWarnings(autoUndo.warnings);
    setAutoUndo(null);
    notify('Previous loadout choices restored', { tone: 'ok' });
  };

  const preparationFix = (warning: string) => {
    if (!scenario) return null;
    return preparationEquipmentFix({ warning, actions: scenarioActions(scenario), state: g, now, chosen, loadouts, picks });
  };

  const equipPreparationFix = (fix: NonNullable<ReturnType<typeof preparationFix>>) => {
    if (fix.plan.issue || !fix.plan.added) return;
    setAutoUndo(null);
    setLoadouts((current) => ({ ...current, [fix.sid]: fix.plan.loadout }));
    setExplicit((current) => ({ ...current, [fix.sid]: fix.plan.explicit }));
    setSetupSquad(fix.sid);
    touch(fix.sid);
    notify(`Equipped ${fix.plan.label} on squad ${fix.sid} from stock`, { tone: 'ok' });
  };

  const preparation = scenario && scenario.version >= 4 ? preparationOptions({
    actions: scenarioActions(scenario), warnings: check.warnings, state: g, now, chosen, loadouts, picks,
  }) : null;
  const visibleWarnings = preparation?.warnings ?? check.warnings;

  const deploy = () => act(cmd, 'Squads deployed');

  const incidentType = scenario?.incident?.type ?? null;
  const familyId = scenario?.locationFamilyId ?? scenario?.incident?.familyId ?? null;
  const kicker = [incidentType ? incidentMeta(incidentType).label : null, familyBlurb(familyId), floors > 1 ? `${floors}\u00a0floors` : null].filter(Boolean).join(' · ');
  const knownRest = brief.known.filter((k) => !intel.covered.has(k));

  const squadName = (sid: SquadId) => g.squads.find((squad) => squad.id === sid)?.name ?? sid;
  const footStatus: { text: string; tone: 'mint' | 'amber' | 'warn'; icon: IconName } = chosen.length === 0
    ? { text: 'Choose a squad to deploy', tone: 'amber', icon: 'people' }
    : check.issues.length > 0
      ? { text: check.issues.length === 1 && check.issues[0].length <= 48 ? check.issues[0] : `${check.issues.length} ${check.issues.length === 1 ? 'thing' : 'things'} to fix before deploying`, tone: 'warn', icon: 'lock' }
      : visibleWarnings.length > 0
        ? { text: `Ready · ${visibleWarnings.length} ${visibleWarnings.length === 1 ? 'warning' : 'warnings'} to review`, tone: 'amber', icon: 'warning' }
        : { text: `Ready · ${chosen.map((sid) => `Squad ${sid}`).join(' + ')}`, tone: 'mint', icon: 'check' };

  return (
    <div className="page prepare" ref={pageRef}>
      <div className="prep-head">
        <button type="button" className="back" onClick={onCancel}>
          <Icon name="chevronLeft" size={18} />
          Operations
        </button>
        <div className="prep-title">
          <span className="prep-title-badge" aria-hidden="true"><Icon name={incidentType ? incidentMeta(incidentType).icon : 'pin'} size={22} /></span>
          <span className="prep-title-text">
            <span className="opboard-code">{card?.code ?? 'OP'}</span>
            <h2 className="live-name">{(card?.title ?? scenarioId.replace(/_/g, ' ')).toUpperCase()}</h2>
            {kicker && <p className="prep-kicker">{kicker}</p>}
          </span>
        </div>
      </div>

      <div className="prep-map" aria-label="Location preview">
        <Blueprint built={built} spaces={spaces} squadTasks={[]} selectedSpaceId={null} focusSquadId={null} {...blueprintExtras} />
      </div>

      <Section title="Briefing" icon="intel">
        <Card className="prep-brief">
          <ul className="prep-brief-stats" aria-label="Briefing at a glance">
            <li data-tone="mint"><Icon name="check" size={16} /><strong>{knownRest.length}</strong><span>Known</span></li>
            <li data-tone="amber"><Icon name="question" size={16} /><strong>{brief.unknown.length}</strong><span>Open</span></li>
            <li data-tone="neutral"><Icon name="people" size={16} /><strong>{intel.people.length}</strong><span>People</span></li>
            <li data-tone={intel.threats.length ? 'warn' : 'neutral'}><Icon name="warning" size={16} /><strong>{intel.threats.length}</strong><span>Threats</span></li>
          </ul>
          {(intel.difficulty || intel.environment) && <div className="prep-brief-chips">
            {intel.difficulty && <div className="chips"><DifficultyChip band={intel.difficulty.band} /></div>}
            {intel.environment && <EnvChips env={intel.environment} />}
          </div>}
          <BriefList icon="flag" tone="neutral" title="Objectives" items={brief.objectives} empty="No objectives listed." />
          {brief.unknown.length > 0 && <BriefList icon="question" tone="amber" title="Open questions" items={brief.unknown} empty="No open questions." />}
          {intel.people.length > 0 && <div className="brief">
            <h3 className="brief-h tone-neutral"><Icon name="people" size={16} />People</h3>
            <ul className="incident-people-list prep-people">
              {intel.people.map((p) => {
                const c = confidence(p.status);
                return <li key={p.id} className="person-tile" data-tone={p.status === 'confirmed' ? 'ok' : p.status === 'disproved' ? 'danger' : 'pending'}>
                  <span className="person-avatar" aria-hidden="true">{personInitials(p.label)}</span>
                  <div className="person-text">
                    <strong>{p.label}</strong>
                    <span className="person-status"><Icon name={c.icon} size={13} />{c.label}{p.where ? ` · ${p.where}` : ''}</span>
                  </div>
                </li>;
              })}
            </ul>
          </div>}
          {intel.threats.length > 0 && <div className="brief">
            <h3 className="brief-h tone-warn"><Icon name="warning" size={16} />Threat information</h3>
            <ul className="intel">
              {intel.threats.map((t) => (
                <IntelRow key={t.id} line={t} icon="warning" lead="Armament" />
              ))}
            </ul>
          </div>}
          <details className="prep-brief-more">
            <summary><Icon name="intel" size={14} />Full briefing</summary>
            {scenario && <IncidentBriefContext scenario={scenario} />}
            <BriefList icon="check" tone="mint" title="Known" items={knownRest} empty="Nothing confirmed yet." />
            <div className="brief">
              <h3 className="brief-h tone-neutral">
                <Icon name="people" size={16} />
                People reports
              </h3>
              {intel.people.length === 0 ? (
                <p className="dim">{scenario && scenario.version >= 4 ? 'No individual person details are listed here. Check the dispatch account.' : 'Nobody reported. Occupancy is unverified.'}</p>
              ) : (
                <ul className="intel">
                  {intel.people.map((p) => (
                    <IntelRow key={p.id} line={p} icon="user" />
                  ))}
                </ul>
              )}
            </div>
            {intel.threats.length === 0 && <div className="brief">
              <h3 className="brief-h tone-warn">
                <Icon name="warning" size={16} />
                Threat information
              </h3>
              <p className="dim">{scenario && scenario.version >= 4 ? 'No separate weapon details are listed. Check the dispatch account.' : 'No weapon reported. That does not mean none is present.'}</p>
            </div>}
            {intel.difficulty && (
              <div className="brief">
                <h3 className="brief-h tone-neutral">
                  <Icon name="mountain" size={16} />
                  Difficulty
                </h3>
                {intel.difficulty.drivers.length > 0 && (
                  <ul className="drivers">
                    {intel.difficulty.drivers.slice(0, 3).map((d, i) => (
                      <li key={i}>
                        <Icon name="gauge" size={14} />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="dim">Based on what is known. New information can raise or lower it.</p>
              </div>
            )}
          </details>
        </Card>
      </Section>

      <Section title="Squads" icon="people" hint={`Takes ${range.min === range.max ? range.min : `${range.min} to ${range.max}`} squad${range.max > 1 ? 's' : ''}. Tap to choose.`}>
        {g.squads.length === 0 ? (
          <Card>
            <p className="dim">Create a squad on the Squad tab first.</p>
          </Card>
        ) : (
          <>
            <div className="squadpick">
              {g.squads.map((s) => {
                const r = squadReadiness(g, s.id, now);
                const on = chosen.includes(s.id);
                const members = s.officerIds.map((id) => g.officers[id]).filter((officer) => !!officer);
                return (
                  <button key={s.id} type="button" className={`pickcard${on ? ' pickcard-on' : ''}${r.deployable ? '' : ' pickcard-blocked'}`} aria-pressed={on}
                    aria-label={`Squad ${s.id}, ${s.name}, ${r.ready} of ${r.total} ready${r.deployable ? '' : ', not deployable'}${r.issues[0] ? `, ${r.issues[0]}` : ''}`}
                    disabled={!on && range.max > 1 && chosen.length >= Math.min(range.max, 3)} onClick={() => toggleSquad(s.id)}>
                    <span className="pickcard-top">
                      <span className="squad-badge">{s.id}</span>
                      <strong className="pickcard-name">{s.name}</strong>
                      <span className="pickcard-check">{on && <Icon name="check" size={16} />}</span>
                    </span>
                    <span className="pickcard-faces" aria-hidden="true">
                      {members.slice(0, 4).map((officer) => <span key={officer.id} className="pickcard-face"><Portrait officer={officer} size={30} /></span>)}
                      {members.length > 4 && <b>+{members.length - 4}</b>}
                    </span>
                    <span className="pickcard-ready" aria-hidden="true">
                      <span className="pickcard-bar">{Array.from({ length: r.total }, (_, i) => <i key={i} className={i < r.ready ? 'on' : undefined} />)}</span>
                      <span className={r.deployable ? 'tone-mint' : 'tone-warn'}>{r.ready}/{r.total} ready</span>
                    </span>
                    {r.issues.slice(0, 1).map((i, k) => (
                      <span key={k} className="pickcard-issue">
                        {i}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
            <div className="prep-auto">
              <Button block icon="wand" disabled={chosen.length === 0} onClick={() => runAuto()}>
                Auto-equip {chosen.length === 1 ? `squad ${chosen[0]}` : 'selected squads'}
              </Button>
              {autoUndo && <Button size="sm" onClick={undoAuto}>Undo auto-equip</Button>}
            </div>
            <p className="dim autohint">{chosen.length === 0 ? 'Choose squads first. ' : ''}Fills gear from owned stock and keeps quantities you set. One radio per officer is included. Nothing is bought.</p>
            {autoWarnings.length > 0 && (
              <div className="autowarn" aria-live="polite">
                {autoWarnings.map((w, i) => (
                  <p key={i} className="note note-amber">
                    <Icon name="warning" size={16} />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      {chosen.length > 0 && <div className="prep-squad-workspace">
        {chosen.length > 1 && <>
        <ChoiceRail value={visibleSquad!} kind="tabs" label="Squad setup" panelId="squad-setup-panel" onChange={setSetupSquad}
          options={chosen.map(sid => {
            const extra = Object.entries(loadouts[sid] ?? {}).filter(([item]) => item !== STANDARD_RADIO).reduce((total, [, qty]) => total + qty, 0);
            const entry = brief.entries.find(entry => entry.id === (positions[sid] ?? defaultEntry));
            return { value: sid, label: <><b>{sid}</b><span className="squad-tab-detail"><span className="squad-tab-name">{squadName(sid)}</span><small>{entry?.label ?? 'Choose position'} · {extra} extra</small></span></>, accessibleLabel: `Set up squad ${sid}, ${squadName(sid)}, ${entry?.label ?? 'no position'}, ${loadouts[sid]?.[STANDARD_RADIO] ?? 0} radios and ${extra} extra items` };
          })} />
          <p className="operation-squad-hint">Switching tabs keeps each squad's setup. All squads share your stock.</p></>}
      {(visibleSquad ? [visibleSquad] : []).map((sid) => {
        const squad = g.squads.find((s) => s.id === sid)!;
        const hasPreset = Object.values(handCarriedLoadout(squad.loadoutPreset)).some((q) => q > 0);
        const visible = store.filter((o: StoreOption) => !o.item.supportOnly
          && (o.item.id === STANDARD_RADIO || o.owned > 0 || brief.usefulItemIds.includes(o.item.id)));
        const points = pointsFor(sid);
        const chosenPoint = cmd.staging?.[sid] ?? null;
        const note = autoNote[sid];
        const unreliable = Object.values(picks[sid] ?? {})
          .flat()
          .filter((u) => unitStateOf(u.condition, ITEMS[u.itemId].wear) !== 'Good' && unitStateOf(u.condition, ITEMS[u.itemId].wear) !== 'Worn');
        return (
          <section key={sid} id="squad-setup-panel" role={chosen.length > 1 ? 'tabpanel' : undefined} aria-labelledby={chosen.length > 1 ? `squad-setup-panel-tab-${sid}` : undefined} className="card prepsquad" aria-label={`Squad ${sid} setup`}>
            <div className="prepsquad-head">
              <span className="squad-badge">{sid}</span>
              <strong>{squad.name}</strong>
              <Button size="sm" icon="wand" className="prepsquad-auto" onClick={() => runAuto(sid)} aria-label={`Auto-equip squad ${sid}`}>
                Auto-equip
              </Button>
            </div>
            {note && (
              <details className="autonote">
                <summary className="autonote-h">
                  <Icon name="wand" size={14} />
                  Auto-equip notes · {note.lines.length || 'none'}
                  {note.edited && (
                    <Chip tone="amber" icon="edit">
                      You changed this
                    </Chip>
                  )}
                </summary>
                {note.lines.length > 0 ? (
                  <ul>
                    {note.lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="dim">Current choices kept. No extra gear added.</p>
                )}
              </details>
            )}
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
                  <StageOption on={chosenPoint === null} icon="pin" title="Default" sub="This zone's usual point" onPick={() => setStaging((st) => omit(st, sid))} />
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
              <ul className="loadout prep-items">
                {visible.map((o) => {
                  const free = Math.max(0, readyOf(o.item.id) - allocated(o.item.id, sid));
                  const others = allocated(o.item.id, sid);
                  const qty = loadouts[sid]?.[o.item.id] ?? 0;
                  const useful = brief.usefulItemIds.includes(o.item.id);
                  const units = picks[sid]?.[o.item.id] ?? [];
                  const standard = o.item.id === STANDARD_RADIO;
                  return (
                    <li key={o.item.id} className={`lo prep-item${useful ? ' lo-useful' : ''}${standard ? ' prep-item-standard' : ''}${qty > 0 ? ' prep-item-on' : ''}`}>
                      <span className="prep-item-art" aria-hidden="true">
                        <GearArt itemId={o.item.id} size={34} />
                        {qty > 0 && <b className="prep-item-qty">×{qty}</b>}
                      </span>
                      <span className="prep-item-main">
                        <strong>{o.item.name}</strong>
                        <span className="prep-item-sub">
                          {standard ? `${units.length}/${qty} ready · one each` : `${free} free${others ? ` · ${others} with other squads` : ''}`}
                          {useful && !standard && <span className="prep-item-useful"><Icon name="star" size={11} />Useful</span>}
                        </span>
                      </span>
                      <span className="prep-item-ctl">
                        {standard ? <Chip tone={units.length === qty ? 'mint' : 'amber'} icon="radio">Standard kit</Chip>
                          : <Stepper label={o.item.name} value={qty} max={Math.max(qty, free)} onChange={(n) => setQty(sid, o.item.id, Math.min(n, Math.max(qty, free)))} />}
                      </span>
                      {standard && units.length < qty && <div className="prep-item-buy">
                        <Button size="sm" icon="plus" disabled={g.department.funding < radioPlan.shortage * o.item.cost}
                          onClick={() => act({ type: 'buyItem', itemId: STANDARD_RADIO, qty: radioPlan.shortage }, `Bought ${radioPlan.shortage} standard radio${radioPlan.shortage === 1 ? '' : 's'}`)}>
                          Buy {radioPlan.shortage} radio{radioPlan.shortage === 1 ? '' : 's'} · {moneyFull(radioPlan.shortage * o.item.cost)}
                        </Button>
                        {g.department.funding < radioPlan.shortage * o.item.cost && <span className="dim">Needs {moneyFull(radioPlan.shortage * o.item.cost - g.department.funding)} more funding, or deploy fewer officers.</span>}
                      </div>}
                      {(units.length > 0 || (standard && units.length < qty) || units.length < qty) && (
                        <ul className="lo-units" aria-label={`Units taking ${o.item.name}`}>
                          {units.map((u) => {
                            const condition = projectedCondition(g, u, Math.max(now, g.department.clockHighWater));
                            const state = unitStateOf(condition, o.item.wear);
                            const meta = UNIT_STATE_META[state];
                            return (
                              <li key={u.id} className={`lo-unit lo-unit-${meta.tone}`} title={`${u.serial} · ${Math.round(condition)}% · ${state}`}>
                                <Icon name={meta.icon} size={12} />
                                <b>{u.serial}</b>
                                <span>
                                  {Math.round(condition)}%{meta.tone === 'bad' ? ` · ${state} · ${pct(unitEffectiveness({ ...u, condition }, o.item))} effect` : ''}
                                </span>
                              </li>
                            );
                          })}
                          {units.length < qty && (
                            <li className="lo-unit lo-unit-bad lo-unit-missing">
                              <Icon name="warning" size={12} />
                              <span>{qty - units.length} {standard ? 'standard radios missing. Buy or service radios on the Gear tab, or choose fewer officers.' : `units missing; only ${units.length} of ${qty} ready.`}</span>
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
                {unreliable.map((u) => u.serial).join(', ')} {unreliable.length === 1 ? 'is' : 'are'} unreliable, with reduced effect and a chance to fail. Service {unreliable.length === 1 ? 'it' : 'them'} on the Gear tab or take a better unit.
              </p>
            )}
          </section>
        );
      })}
      </div>}

      <SupportPreparation state={g} now={now} cmd={cmd} built={built} onSelect={setSupportUnitId} />

      {!!preparation?.equipment.length && <details className="prep-equipment-options">
        <summary>Optional equipment · {preparation.equipment.length} {preparation.equipment.length === 1 ? 'option' : 'options'} to review</summary>
        <p>These bundles open up more choices. You can deploy without them; each decision shows its needs when it comes up.</p>
        <ul>{preparation.equipment.map(({ key, label, fix }) => <li key={key}>
          <strong>{label}</strong>
          <p className="dim">Optional equipment for squad {fix.sid}. Scene requirements are checked when you choose an action.</p>
          {fix.plan.issue ? <p>{fix.plan.issue}</p> : <Button size="sm" icon="box" onClick={() => equipPreparationFix(fix)}>Equip {fix.plan.label} on squad {fix.sid}</Button>}
        </li>)}</ul>
      </details>}

      {(check.issues.length > 0 || visibleWarnings.length > 0) && <div className="prepcheck" aria-live="polite">
        {check.issues.map((i, k) => (
          <p key={`i${k}`} className="note note-warn">
            <Icon name="lock" size={16} />
            {i}
          </p>
        ))}
        {visibleWarnings.map((w, k) => {
          const fix = preparationFix(w);
          return <div key={`w${k}`} className="prepcheck-warning">
            <p className="note note-amber"><Icon name="warning" size={16} />{w}</p>
            {fix?.plan.issue && <p className="dim">{fix.plan.issue}</p>}
            {!!fix?.plan.prerequisites.length && <p className="dim">Also needed: {fix.plan.prerequisites.join('; ')}.</p>}
            {fix && !fix.plan.issue && fix.plan.added > 0 && <Button size="sm" icon="box" onClick={() => equipPreparationFix(fix)}>Equip {fix.plan.label} on squad {fix.sid}</Button>}
          </div>;
        })}
      </div>}

      <div className="stickyfoot prepfoot">
        <p className={`prepfoot-status tone-${footStatus.tone}`}><Icon name={footStatus.icon} size={15} /><span>{footStatus.text}</span></p>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!check.ok} onClick={deploy}>
          Deploy
        </Button>
      </div>
    </div>
  );
}

/** Confidence word for a briefing line: never stronger than the report. */
function confidence(status: KnowledgeStatus): { label: string; tone: 'mint' | 'amber' | 'danger'; icon: IconName } {
  if (status === 'confirmed') return { label: 'Confirmed', tone: 'mint', icon: 'check' };
  if (status === 'disproved') return { label: 'Ruled out', tone: 'danger', icon: 'x' };
  return { label: 'Unverified', tone: 'amber', icon: 'question' };
}

function IntelRow({ line, icon, lead }: { line: IntelLine; icon: IconName; lead?: string }) {
  const c = confidence(line.status);
  return (
    <li className="intelrow">
      <div className="intelrow-top">
        <Icon name={icon} size={16} />
        <strong>{line.label}</strong>
        {line.where && <span className="dim">{line.where}</span>}
      </div>
      <p className="intelrow-claim">{lead ? `${lead}: ` : ''}{line.claim}</p>
      <div className="chips">
        <Chip tone={c.tone} icon={c.icon}>
          {c.label}
        </Chip>
        {line.source && (
          <Chip icon="chat" title="Who reported it">
            {line.source}
          </Chip>
        )}
      </div>
    </li>
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
