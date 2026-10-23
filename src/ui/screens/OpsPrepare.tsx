import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useGame } from '../store';
import {
  briefing,
  builtForScenario,
  prepCheck,
  spaceViewsForScenario,
} from '../../sim/operation-selectors';
import { BASIC_KIT_LINE } from '../../sim/basic-kit';
import { officerFaceStatus } from '../components/face-status';
import type { StartOperationCommand } from '../../sim/operation-selectors';
import { squadReadiness, storeOptions } from '../../sim/department-selectors';
import type { StoreOption } from '../../sim/department-selectors';
import { unitEffectiveness } from '../../sim/inventory';
import { projectedCondition } from '../../sim/equipment';
import { stagingPointsIn } from '../../sim/spatial';
import { defaultStagingFor, spaceLabel } from '../../sim/spatial-factors';
import { ITEMS } from '../../content/items';
import { autoEquipReadyUnits, autoLoadout } from '../../sim/auto-equip';
import type { AutoLoadout } from '../../sim/auto-equip';
import { getScenario } from '../../sim/scenario-registry';
import type { Id, ItemUnit, SquadId, StagingPoint } from '../../sim/types';
import { Blueprint } from '../blueprint/Blueprint';
import { floorCount } from '../blueprint/floors';
import { ActionBar, Button, Card, Row, Stepper, SubHead } from '../components/ui';
import { Face } from '../components/Face';
import { GearArt } from '../art/GearArt';
import { useToast } from '../components/toast';
import { Sheet } from '../components/Sheet';
import { UNIT_STATE_META, unitStateOf } from '../components/labels';
import { Icon } from '../icons';
import { CallTypeBadge } from '../icons/CallTypeBadge';
import type { IconName } from '../icons';
import { pct } from '../format';
import { cardFor, hasNodeEffect, incidentsOf, staysHomeLine } from './helpers';
import { planAuto, preparationEquipmentFix } from './autoPlan';
import { scenarioActions } from '../../sim/scenario-types';
import type { Loadouts } from './autoPlan';
import { buildIntel } from './intel';
import { handCarriedLoadout, SupportPreparation } from './SupportPreparation';
import { PrepBriefing } from './PrepBriefing';
import { GamePeopleProvider } from '../people/PeopleText';
import { lexiconFor } from '../people/lexicon';
import { preparationOptions } from './preparation-options';
import { bestFitSquad, joinNames, squadName as nameOf, toggleDeploymentSquad } from './operation-squads';
import { callFlow, draftField, type FlowStep } from './call-flow';
import { FlowScreen } from '../components/chrome';
import './preparation-options.css';
import './operation-squads.css';
import './ops-visual.css';
import { departmentUpkeep } from '../../sim/equipment-manager-policy';
import { Disclosure } from '../components/Disclosure';
import { timerSetting } from '../timer';

/** A call before it goes live, as a pushed flow in two steps (docs/ui-ux-audit.md): the brief, then
 * who goes and what they carry. The step and the draft live in call-flow.ts, outside this screen,
 * so Back, browser Back and a detour to another tab keep them. `onCancel` replaces the flow's Back
 * (tests and the Lab). */
const BASIC_KIT_ICONS: [string, string][] = [['radio_kit', 'Radio headset'], ['service_sidearm', 'Sidearm'], ['compact_carbine', 'Carbine'], ['light_protection', 'Light armor']];

export function OpsPrepare({ scenarioId, step = 'brief', onCancel }: { scenarioId: Id; step?: FlowStep; onCancel?: () => void }) {
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
  const back = onCancel ?? (() => callFlow.back());

  // The draft (call-flow.ts): read fresh on every render, written through the flow's store.
  const draft = callFlow.draft(scenarioId);
  const [chosen, setChosen] = draftField(scenarioId, draft, 'chosen');
  const [squadsTouched, setSquadsTouched] = draftField(scenarioId, draft, 'squadsTouched');
  const [positions, setPositions] = draftField(scenarioId, draft, 'positions');
  const [optionalLoadouts, setLoadouts] = draftField(scenarioId, draft, 'loadouts');
  const [explicit, setExplicit] = draftField(scenarioId, draft, 'explicit');
  const [autoNote, setAutoNote] = draftField(scenarioId, draft, 'autoNote');
  const [autoWarnings, setAutoWarnings] = draftField(scenarioId, draft, 'autoWarnings');
  const [autoUndo, setAutoUndo] = draftField(scenarioId, draft, 'autoUndo');
  const [staging, setStaging] = draftField(scenarioId, draft, 'staging');
  const [supportUnitId, setSupportUnitId] = draftField(scenarioId, draft, 'supportUnitId');
  const [floor, setFloor] = draftField(scenarioId, draft, 'floor');
  // Which sheet is open: the brief's map, a squad's kit (Adjust) or its way in (Change).
  const [sheet, setSheet] = useState<{ kind: 'map' } | { kind: 'kit' | 'going'; squad: SquadId } | null>(null);
  const brief = useMemo(() => briefing(scenarioId, g, chosen), [scenarioId, g, chosen]);

  const loadouts = useMemo<Loadouts>(() => {
    const next = { ...optionalLoadouts };
    for (const sid of chosen) next[sid] = handCarriedLoadout(next[sid] ?? {});
    return next;
  }, [optionalLoadouts, chosen]);

  const range = card?.squadRange ?? scenario?.squadRange ?? { min: 1, max: 3 };
  const maxSquads = Math.min(range.max, 3);
  const defaultEntry = brief.entries[0]?.id;
  const floors = floorCount(built.location);
  // Renderer props that may not be declared yet (floor tabs, environment overlay). Spread so this compiles either way.
  const blueprintExtras = { floor: Math.min(floor, floors - 1), onFloorChange: setFloor, environment: intel.environment ?? undefined };
  const squadName = (sid: SquadId) => nameOf(g.squads, sid);

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
        const want = explicit[sid]?.[itemId] ?? [];
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
  }, [g, chosen, loadouts, explicit, now]);

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
  const check = prepCheck(g, now, cmd, timerSetting());

  // A call that takes exactly one squad opens its deploy step with the best-fit ready squad chosen:
  // the one with the most officers fit to go. The player can still pick another or clear it.
  // Choose team makes the pick before the step changes, so the deploy step opens already filled
  // and nothing pops in after the first frame; the effect covers a direct entry (a reload, Forward).
  const preselect = () => {
    if (squadsTouched || chosen.length > 0 || range.min !== 1 || range.max !== 1) return;
    setSquadsTouched(true);
    const best = bestFitSquad(g.squads.map((s) => ({ id: s.id, ...squadReadiness(g, s.id, Date.now()) })));
    if (best) setChosen([best]);
  };
  useEffect(() => {
    if (step === 'deploy') preselect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, squadsTouched, chosen.length, range.min, range.max]);

  const toggleSquad = (id: SquadId) => {
    setSquadsTouched(true);
    setAutoUndo(null);
    setChosen(toggleDeploymentSquad(chosen, id, maxSquads));
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
    if (ITEMS[itemId]?.supportOnly) return;
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
    touch(fix.sid);
    notify(`Equipped ${fix.plan.label} on ${squadName(fix.sid)} from stock`, { tone: 'ok' });
  };

  const preparation = scenario ? preparationOptions({
    actions: scenarioActions(scenario), warnings: check.warnings, state: g, now, chosen, loadouts, picks,
  }) : null;
  const visibleWarnings = preparation?.warnings ?? check.warnings;

  // The call goes live with no toast: the live call itself says so, and a toast would sit on the strip.
  const deploy = () => { if (act(cmd).ok) callFlow.close(scenarioId); };

  const title = card?.title ?? scenarioId.replace(/_/g, ' ');
  const names = joinNames(chosen.map(squadName));
  const footStatus = chosen.length === 0
    ? { text: 'Choose who goes', tone: 'act' }
    : check.issues.length > 0
      ? { text: `${check.issues.length} ${check.issues.length === 1 ? 'thing' : 'things'} to fix first`, tone: 'warn' }
      : visibleWarnings.length > 0
        ? { text: `Ready, ${visibleWarnings.length} ${visibleWarnings.length === 1 ? 'warning' : 'warnings'}`, tone: 'act' }
        : { text: 'Ready', tone: 'good' };
  const fitId = bestFitSquad(g.squads.map((s) => ({ id: s.id, ...squadReadiness(g, s.id, now) })));
  const takes = `Takes ${range.min === range.max ? range.min : `${range.min} to ${range.max}`} squad${range.max > 1 ? 's' : ''}`;

  /** A squad's kit for the summary: what it takes from the Armory, and what it is short of. */
  const kitOf = (sid: SquadId): { id: Id; text: string; tone: 'on' | 'warn' | 'short' }[] => store.filter((o: StoreOption) => !o.item.supportOnly && (o.owned > 0 || brief.usefulItemIds.includes(o.item.id))).flatMap((o): { id: Id; text: string; tone: 'on' | 'warn' | 'short' }[] => {
    const qty = loadouts[sid]?.[o.item.id] ?? 0;
    const units = picks[sid]?.[o.item.id] ?? [];
    const free = Math.max(0, readyOf(o.item.id) - allocated(o.item.id, sid));
    if (qty > 0) return [{ id: o.item.id, text: units.length < qty ? `${o.item.name} ${units.length} of ${qty} ready` : `${o.item.name} ×${qty}`, tone: units.length < qty ? 'warn' as const : 'on' as const }];
    if (brief.usefulItemIds.includes(o.item.id) && free === 0) return [{ id: o.item.id, text: `${o.item.name}, none free`, tone: 'short' as const }];
    return [];
  });

  /** Where a squad starts and the door it stages at, in words. */
  const goingIn = (sid: SquadId) => {
    const position = positions[sid] ?? defaultEntry;
    const entry = brief.entries.find((en) => en.id === position);
    const points = pointsFor(sid);
    const nearest = position ? defaultStagingFor(built, position) : null;
    const pickedId = cmd.staging?.[sid] ?? nearest?.id ?? null;
    const label = stageLabels(built, points, position).find(({ point }) => point.id === pickedId);
    return { position, entry, points, nearest, pickedId, title: entry?.label ?? 'No way in listed', detail: label ? `${label.title}${pickedId === nearest?.id ? ', the nearest' : ''}` : null };
  };

  const briefStep = <>
    <PrepBriefing scenario={scenario} built={built} brief={brief} intel={intel} aside="Step 1 of 2" openUntil={incidentsOf(g).find((i) => i.id === scenarioId)?.expiresAt} />
  </>;

  const deployStep = <>
    <section className="cl-section" aria-labelledby="cl-who-h">
      <div className="cl-section-head"><h2 id="cl-who-h" className="cl-section-title"><Icon name="people" size={20} />Who goes</h2><span className="cl-section-aside">{takes} · <span className={`cl-tone-${footStatus.tone}`}>{footStatus.text}</span></span></div>
      {g.squads.length === 0 ? <p className="dim">Create a squad on the Squad tab first.</p> : <div className="cl-squads" role="group" aria-label="Squads" data-ui-list>
        {g.squads.map((s) => {
          const r = squadReadiness(g, s.id, now);
          const on = chosen.includes(s.id);
          const members = s.officerIds.map((id) => g.officers[id]).filter((officer) => !!officer);
          const detail = r.deployable && r.staysHome.length > 0 ? staysHomeLine(g, r.staysHome) : r.issues[0];
          return (
            <button key={s.id} type="button" className={`cl-squad${on ? ' cl-squad-on' : ''}${r.deployable ? '' : ' cl-squad-blocked'}`} aria-pressed={on} data-squad={s.id}
              aria-label={`${s.name}, ${r.ready} of ${r.total} ready${r.deployable ? '' : ', not deployable'}${detail ? `, ${detail}` : ''}`}
              disabled={!on && maxSquads > 1 && chosen.length >= maxSquads} onClick={() => toggleSquad(s.id)}>
              <span className="squad-badge">{s.id}</span>
              <span className="cl-squad-main">
                <strong>{s.name}{s.id === fitId && <span className="cl-squad-fit"><Icon name="star" size={16} />Best fit</span>}</strong>
                <span className={r.deployable ? undefined : 'cl-warn'}>{r.ready} of {r.total} ready{detail ? `, ${detail.charAt(0).toLowerCase()}${detail.slice(1)}` : ''}</span>
              </span>
              <span className="cl-faces" aria-hidden="true">
                {members.slice(0, 4).map((officer) => <Face key={officer.id} size="sm" kind="officer" officer={officer} name={officer.surname} status={officerFaceStatus(g, officer.id, now)} />)}
              </span>
              {on && <Icon name="check" size={20} className="cl-squad-check" />}
            </button>
          );
        })}
      </div>}
      {autoWarnings.length > 0 && <div className="autowarn" aria-live="polite">
        {autoWarnings.map((w, i) => <p key={i} className="note note-amber"><Icon name="warning" size={16} />{w}</p>)}
      </div>}
    </section>

    {chosen.map((sid, index) => {
      const kit = kitOf(sid);
      const way = goingIn(sid);
      return <section key={sid} className="cl-section cl-squad-plan" aria-label={`${squadName(sid)} plan`} data-squad={sid}>
        <div className="cl-section-head">
          <h2 className="cl-section-title"><Icon name="box" size={20} />{squadName(sid)} carries</h2>
          <button type="button" className="cl-link" data-squad={sid} onClick={() => setSheet({ kind: 'kit', squad: sid })} aria-label={`Adjust what ${squadName(sid)} carries`}>Adjust</button>
        </div>
        <Card className="cl-plan-card">
          {index === 0 && <>
            <Row className="cl-plan-row" lead={<span className="cl-well"><Icon name="basicKit" size={24} /></span>} title="Basic kit" detail={kit.length === 0 ? 'Nothing from the Armory.' : undefined} />
            <ul className="cl-kit cl-basic-icons" aria-label={BASIC_KIT_LINE}>{BASIC_KIT_ICONS.map(([id, label]) => <li key={id} className="cl-kit-chip"><GearArt itemId={id} size={24} />{label}</li>)}</ul>
          </>}
          {kit.length > 0 && <ul className="cl-kit" aria-label={`${squadName(sid)} kit`}>{kit.map((item) => <li key={item.id} className={`cl-kit-chip cl-kit-${item.tone}`}><GearArt itemId={item.id} size={24} />{item.text}</li>)}</ul>}
          {kit.length === 0 && index > 0 && <p className="cl-muted cl-plan-empty">Nothing from the Armory.</p>}
        </Card>
        <div className="cl-section-head">
          <h3 className="cl-section-title"><Icon name="door" size={20} />{chosen.length > 1 ? `${squadName(sid)} goes in` : 'Going in'}</h3>
          <button type="button" className="cl-link" data-squad={sid} onClick={() => setSheet({ kind: 'going', squad: sid })} aria-label={`Change where ${squadName(sid)} goes in`}>Change</button>
        </div>
        <Card className="cl-plan-card"><Row className="cl-plan-row cl-going" lead={<span className="cl-well"><Icon name="map" size={24} /></span>} title={way.title} detail={way.detail} /></Card>
      </section>;
    })}

    {chosen.length > 0 && brief.entries.length > 0 && <div className="prep-map prep-map-team" aria-label="Where the team goes in">
      <Blueprint built={built} spaces={spaces} squadTasks={[]} squads={g.squads} selectedSpaceId={null} focusSquadId={null}
        highlightSpaceIds={chosen.map((sid) => positions[sid] ?? defaultEntry).filter((id): id is Id => !!id)} {...blueprintExtras} />
    </div>}

    <SupportPreparation state={g} now={now} cmd={cmd} built={built} onSelect={setSupportUnitId} />

    {!!preparation?.equipment.length && <Disclosure name="prep-equipment" className="prep-equipment-options" summary="Optional equipment to review" count={preparation.equipment.length}>
      <p>These bundles open up more choices. You can deploy without them; each decision shows its needs when it comes up.</p>
      <ul>{preparation.equipment.map(({ key, label, fix }) => <li key={key}>
        <strong>{label}</strong>
        <p className="dim">Optional equipment for {squadName(fix.sid)}. Scene requirements are checked when you choose an action.</p>
        {fix.plan.issue ? <p>{fix.plan.issue}</p> : <Button size="sm" icon="box" onClick={() => equipPreparationFix(fix)}>Equip {fix.plan.label} on {squadName(fix.sid)}</Button>}
      </li>)}</ul>
    </Disclosure>}

    {(check.issues.length > 0 || visibleWarnings.length > 0) && <div className="prepcheck" aria-live="polite">
      {check.issues.map((i, k) => <p key={`i${k}`} className="note note-warn"><Icon name="lock" size={16} />{i}</p>)}
      {visibleWarnings.map((w, k) => {
        const fix = preparationFix(w);
        return <div key={`w${k}`} className="prepcheck-warning">
          <p className="note note-amber"><Icon name="warning" size={16} />{w}</p>
          {fix?.plan.issue && <p className="dim">{fix.plan.issue}</p>}
          {!!fix?.plan.prerequisites.length && <p className="dim">Also needed: {fix.plan.prerequisites.join('; ')}.</p>}
          {fix && !fix.plan.issue && fix.plan.added > 0 && <Button size="sm" icon="box" onClick={() => equipPreparationFix(fix)}>Equip {fix.plan.label} on {squadName(fix.sid)}</Button>}
        </div>;
      })}
    </div>}
  </>;

  const kitSquad = sheet?.kind === 'kit' && chosen.includes(sheet.squad) ? sheet.squad : null;
  const goingSquad = sheet?.kind === 'going' && chosen.includes(sheet.squad) ? sheet.squad : null;

  // A pushed flow (components/chrome.tsx): the shell draws the head and the action bar; the tabs go.
  const footer = step === 'brief'
    ? <ActionBar className="cl-actions" primary={{ label: 'Choose team', onClick: () => { preselect(); callFlow.goStep('deploy'); } }} />
    : <ActionBar className="cl-actions"
      summary={chosen.length ? <><span>{names}</span><span className={`cl-tone-${footStatus.tone}`}>{footStatus.text}</span></> : undefined}
      primary={{ label: chosen.length ? `Deploy ${names}` : 'Deploy', disabled: !check.ok, onClick: deploy }} />;
  const screen = (
    <FlowScreen title={step === 'brief' ? title : 'Deploy'} icon={step === 'brief' ? <CallTypeBadge type={scenario?.incident?.type} size={24} /> : <Icon name="people" size={20} />} backLabel={step === 'brief' ? 'Calls' : 'Brief'} onBack={back} footer={footer}
      trailing={step === 'brief' ? <Button size="sm" variant="quiet" icon="map" className="cl-map-chip" onClick={() => setSheet({ kind: 'map' })} aria-haspopup="dialog">Map</Button> : undefined}>
      <div className="page cl-flow-body prepare" data-step={step}>{step === 'brief' ? briefStep : deployStep}</div>

      <Sheet open={sheet?.kind === 'map'} onClose={() => setSheet(null)} title="The building" className="cl-map-sheet">
        <div className="prep-map" aria-label="Location preview">
          <Blueprint built={built} spaces={spaces} squadTasks={[]} squads={g.squads} selectedSpaceId={null} focusSquadId={null} {...blueprintExtras} />
        </div>
      </Sheet>
      <Sheet open={!!kitSquad} onClose={() => setSheet(null)} title={kitSquad ? `${squadName(kitSquad)} carries` : 'Kit'} footer={<Button variant="primary" block onClick={() => setSheet(null)}>Done</Button>}>
        {kitSquad && kitWorkspace(kitSquad)}
      </Sheet>
      <Sheet open={!!goingSquad} onClose={() => setSheet(null)} title={goingSquad ? `Where ${squadName(goingSquad)} goes in` : 'Going in'} footer={<Button variant="primary" block onClick={() => setSheet(null)}>Done</Button>}>
        {goingSquad && goingInWorkspace(goingSquad)}
      </Sheet>
    </FlowScreen>
  );

  /** Today's kit workspace for one squad, in the Adjust sheet: auto-equip and undo, a preset, and a
   * stepper per pooled item with the exact units it takes. */
  function kitWorkspace(sid: SquadId): ReactNode {
    const squad = g.squads.find((s) => s.id === sid)!;
    const hasPreset = Object.values(handCarriedLoadout(squad.loadoutPreset)).some((q) => q > 0);
    const visible = store.filter((o: StoreOption) => !o.item.supportOnly && (o.owned > 0 || brief.usefulItemIds.includes(o.item.id)));
    const note = autoNote[sid];
    const unreliable = Object.values(picks[sid] ?? {}).flat()
      .filter((u) => unitStateOf(u.condition, ITEMS[u.itemId].wear) !== 'Good' && unitStateOf(u.condition, ITEMS[u.itemId].wear) !== 'Worn');
    return <section className="prepsquad cl-kit-workspace" aria-label={`${squad.name} kit`} data-squad={sid}>
      <div className="prepsquad-head">
        {autoUndo && <Button size="sm" onClick={undoAuto}>Undo auto-equip</Button>}
        <Button size="sm" icon="wand" onClick={() => runAuto(sid)} aria-label={`Auto-equip ${squad.name}`} title="Fills gear from stock you own. Nothing is bought.">Auto-equip</Button>
        {hasPreset && presets.unlocked && <Button size="sm" onClick={() => applyPreset(sid)}>Apply preset</Button>}
      </div>
      {note && <Disclosure name="autoequip-notes" className="autonote" icon="wand" summary="Auto-equip notes" count={note.lines.length} hint={note.edited ? 'You changed this' : undefined}>
        {note.lines.length > 0 ? <ul>{note.lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="dim">Current choices kept. No extra gear added.</p>}
      </Disclosure>}
      <p className="cl-basic-kit">{BASIC_KIT_LINE}</p>
      <SubHead icon="box">From the Armory</SubHead>
      {visible.length === 0 ? <p className="dim">No equipment in stock. Buy gear on the Gear tab.</p> : <ul className="loadout prep-items">
        {visible.map((o) => {
          const free = Math.max(0, readyOf(o.item.id) - allocated(o.item.id, sid));
          const others = allocated(o.item.id, sid);
          const qty = loadouts[sid]?.[o.item.id] ?? 0;
          const useful = brief.usefulItemIds.includes(o.item.id);
          const units = picks[sid]?.[o.item.id] ?? [];
          return <li key={o.item.id} className={`lo prep-item${useful ? ' lo-useful' : ''}${qty > 0 ? ' prep-item-on' : ''}`}>
            <span className="prep-item-art" aria-hidden="true"><GearArt itemId={o.item.id} size={34} />{qty > 0 && <b className="prep-item-qty">×{qty}</b>}</span>
            <span className="prep-item-main">
              <strong>{o.item.name}</strong>
              <span className="prep-item-sub">{`${free} free${others ? ` · ${others} with other squads` : ''}`}{useful && <span className="prep-item-useful"><Icon name="star" size={16} />Useful</span>}</span>
            </span>
            <span className="prep-item-ctl"><Stepper label={o.item.name} value={qty} max={Math.max(qty, free)} onChange={(n) => setQty(sid, o.item.id, Math.min(n, Math.max(qty, free)))} /></span>
            {(units.length > 0 || units.length < qty) && <ul className="lo-units" aria-label={`Units taking ${o.item.name}`}>
              {units.map((u) => {
                const condition = projectedCondition(g, u, Math.max(now, g.department.clockHighWater), departmentUpkeep(g));
                const state = unitStateOf(condition, o.item.wear);
                const meta = UNIT_STATE_META[state];
                return <li key={u.id} className={`lo-unit lo-unit-${meta.tone}`} title={`${u.serial} · ${Math.round(condition)}% · ${state}`}>
                  <Icon name={meta.icon} size={16} /><b>{u.serial}</b>
                  <span>{Math.round(condition)}%{meta.tone === 'bad' ? ` · ${state} · ${pct(unitEffectiveness({ ...u, condition }, o.item))} effect` : ''}</span>
                </li>;
              })}
              {units.length < qty && <li className="lo-unit lo-unit-bad lo-unit-missing"><Icon name="warning" size={16} /><span>{qty - units.length} units missing; only {units.length} of {qty} ready.</span></li>}
            </ul>}
          </li>;
        })}
      </ul>}
      {unreliable.length > 0 && <p className="note note-amber"><Icon name="warning" size={16} />
        {unreliable.map((u) => u.serial).join(', ')} {unreliable.length === 1 ? 'is' : 'are'} unreliable, with reduced effect and a chance to fail. Service {unreliable.length === 1 ? 'it' : 'them'} on the Gear tab or take a better unit.
      </p>}
    </section>;
  }

  /** Where one squad starts and the door it stages at, in the Change sheet. */
  function goingInWorkspace(sid: SquadId): ReactNode {
    const way = goingIn(sid);
    // A new starting position drops a staging point chosen for the old one.
    const pickPosition = (id: Id) => { setPositions((p) => ({ ...p, [sid]: id })); setStaging((st) => omit(st, sid)); };
    return <section className="cl-going-workspace" aria-label={`${squadName(sid)} way in`} data-squad={sid}>
      <label className="field">
        <span className="field-label"><Icon name="pin" size={16} />Starting position</span>
        <select value={way.position ?? ''} onChange={(e) => pickPosition(e.target.value)} disabled={brief.entries.length === 0}>
          {brief.entries.length === 0 && <option value="">No entries listed</option>}
          {brief.entries.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
        </select>
      </label>
      {brief.entries.length > 0 && <div className="prep-map prep-map-team" aria-label="Starting positions on the building map">
        <Blueprint built={built} spaces={spaces} squadTasks={[]} squads={g.squads} selectedSpaceId={way.position ?? null} focusSquadId={null}
          highlightSpaceIds={brief.entries.map((entry) => entry.id)} onSelectSpace={(id) => { if (brief.entries.some((entry) => entry.id === id)) pickPosition(id); }} {...blueprintExtras} />
      </div>}
      {way.points.length > 0 && <div className="field">
        <span className="field-label" id={`stage-${sid}`}><Icon name="door" size={16} />Staging point</span>
        <div className="stagelist" role="radiogroup" aria-labelledby={`stage-${sid}`}>
          {stageLabels(built, way.points, way.position).map(({ point, title: pointTitle, sub, icon }) => (
            <StageOption key={point.id} on={way.pickedId === point.id} icon={icon} title={pointTitle} sub={point.id === way.nearest?.id ? 'Nearest door' : sub}
              onPick={() => setStaging((st) => point.id === way.nearest?.id ? omit(st, sid) : ({ ...st, [sid]: point.id }))} />
          ))}
        </div>
      </div>}
    </section>;
  }

  // Names in the briefing, by public kind; nobody is deployed yet.
  return <GamePeopleProvider lexicon={scenario ? lexiconFor(scenario, null, []) : null}>{screen}</GamePeopleProvider>;
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
        {sub && <span className="dim">{sub}</span>}
      </span>
      <span className="stageopt-check">{on && <Icon name="check" size={20} />}</span>
    </button>
  );
}

/** 'Hall door', 'East bedroom window': what the point faces, plus the zone the squad crosses to reach it when that
 * isn't the starting position. Duplicates get a number. */
function stageLabels(built: ReturnType<typeof builtForScenario>, points: StagingPoint[], position?: Id): { point: StagingPoint; title: string; sub: string; icon: IconName }[] {
  const base = points.map((p) => {
    const faces = spaceLabel(built, p.facesId);
    const kind = p.kind === 'window' ? 'window' : p.kind === 'doorway' ? 'doorway' : 'door';
    return { point: p, title: `${faces} ${kind}`, sub: p.spaceId === position ? '' : `From ${spaceLabel(built, p.spaceId)}`, icon: (p.kind === 'window' ? 'window' : 'door') as IconName };
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
