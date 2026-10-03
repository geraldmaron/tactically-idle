import { ITEMS } from '../../content/items';
import { storeOptions } from '../../sim/department-selectors';
import { projectedCondition } from '../../sim/equipment';
import { readyUnits } from '../../sim/inventory';
import type { StartOperationCommand } from '../../sim/operation-selectors';
import { getScenario } from '../../sim/scenario-registry';
import { practiceSupportUnit, supportStartCheck } from '../../sim/support-vehicles';
import type { BuiltLocation, GameState, Id, ItemDefinition, ItemUnit } from '../../sim/types';
import { Button, Card, Chip, Section } from '../components/ui';
import { unitStateOf } from '../components/labels';
import { moneyFull } from '../format';
import { Icon, itemIcon } from '../icons';
import './preparation-support.css';

/** Support assets never enter a squad's backpack, including old saved presets. */
export function handCarriedLoadout(loadout: Record<Id, number>): Record<Id, number> {
  return Object.fromEntries(Object.entries(loadout).filter(([id]) => !ITEMS[id]?.supportOnly));
}

export interface SupportChoice {
  id: Id;
  unit: ItemUnit | null;
  condition: number;
  issues: string[];
}

/** Exact selectable units; the engine supplies every deployment blocker. */
export function supportChoices(state: GameState, now: number, cmd: StartOperationCommand, item: ItemDefinition): SupportChoice[] {
  if (!item.supportOnly) return [];
  if (cmd.practice) {
    const fixture = getScenario(cmd.scenarioId)?.practiceOnly;
    const owned = Object.values(state.units).some((unit) => unit.itemId === item.id && unit.status !== 'scrapped');
    if (!fixture && item.requiresNode && !state.department.unlockedNodes.includes(item.requiresNode) && !owned) return [];
    const id = practiceSupportUnit(item.id)!.id;
    return [{ id, unit: null, condition: 100, issues: supportStartCheck(state, now, { ...cmd, supportUnitIds: [id] }) }];
  }
  const selected = cmd.supportUnitIds?.[0];
  const units = Object.values(state.units).filter((unit) => unit.itemId === item.id && (unit.status !== 'scrapped' || unit.id === selected));
  return units.map((unit) => ({
    id: unit.id,
    unit,
    condition: projectedCondition(state, unit, Math.max(now, state.department.clockHighWater)),
    issues: supportStartCheck(state, now, { ...cmd, supportUnitIds: [unit.id] }),
  })).sort((a, b) => Number(a.issues.length > 0) - Number(b.issues.length > 0) || b.condition - a.condition || a.id.localeCompare(b.id));
}

export function SupportPreparation({ state, now, cmd, built, onSelect }: {
  state: GameState;
  now: number;
  cmd: StartOperationCommand;
  built: BuiltLocation;
  onSelect: (unitId: Id | null) => void;
}) {
  const options = storeOptions(state).filter((option) => option.item.supportOnly);
  const selectedId = cmd.supportUnitIds?.[0] ?? null;
  const leadSquad = cmd.squadIds[0];
  const stageId = leadSquad ? cmd.positions[leadSquad] : undefined;
  const stage = built.location.zones.find((zone) => zone.id === stageId);
  const operators = state.squads.filter((squad) => cmd.squadIds.includes(squad.id))
    .flatMap((squad) => squad.officerIds.map((id) => state.officers[id]))
    .filter((officer) => officer?.certs.includes('vehicle_operations'));
  const selectedIssues = selectedId ? supportStartCheck(state, now, cmd) : [];
  return <Section title="Operation support" icon="pin" hint="Optional: choose one vehicle for the exterior support slot. Vehicle operations certification is required in a selected squad.">
    <Card className="prep-support-summary">
      <div className="prep-support-heading">
        <Chip tone={selectedId ? 'amber' : 'neutral'}>{selectedId ? '1 of 1 support slots selected' : 'No support vehicle selected'}</Chip>
        {selectedId && <Button size="sm" onClick={() => onSelect(null)}>Clear support</Button>}
      </div>
      <p className={operators.length ? 'tone-mint' : 'tone-amber'}>{operators.length
        ? `Vehicle operations: ${operators.map((officer) => `${officer.firstName} ${officer.surname}`).join(', ')}`
        : 'Vehicle operations: choose a squad with a certified operator, or train an officer in Develop.'}</p>
      <p className="dim">{stage
        ? `Exterior staging: ${stage.label}, following squad ${leadSquad}’s starting position.${stage.tags.includes('vehicle_inaccessible') ? ' This staging area cannot take a vehicle.' : ''}`
        : 'Choose a squad and an accessible exterior starting position to stage support.'}</p>
      <p className="dim">{cmd.practice
        ? 'Practice support is virtual: no funding, owned stock or condition is used. Your selected squads still need a certified operator.'
        : `Available funding: ${moneyFull(state.department.funding)}. Select an owned unit below; purchase vehicles on the Gear tab.`}</p>
      {selectedIssues.map((issue) => <p key={issue} className="note note-warn"><Icon name="warning" size={16} />{issue}</p>)}
    </Card>
    <div className="prep-support-list">
      {options.map((option) => {
        const { item } = option;
        const choices = supportChoices(state, now, cmd, item);
        const selection = choices.find((choice) => choice.id === selectedId);
        const ready = readyUnits(state, item.id, now).length;
        const available = choices.filter((choice) => choice.issues.length === 0);
        const conditions = [...new Set(choices.flatMap((choice) => choice.issues))];
        return <Card key={item.id} className={`prep-support-card${selection ? ' prep-support-selected' : ''}`}>
          <div className="prep-support-heading"><Icon name={itemIcon(item.id)} size={22} /><strong>{item.name}</strong>{selection && <Chip tone="amber" icon="check">Selected</Chip>}</div>
          <p>{item.description}</p>
          {item.counters?.map((counter) => <p key={counter} className="dim">{counter}</p>)}
          <p className="dim">{option.owned} owned · {ready} ready · {moneyFull(item.cost)} purchase price</p>
          {!cmd.practice && ready === 0 && <p className="note note-amber"><Icon name="box" size={16} />{option.owned === 0 ? 'No owned stock. Purchase on Gear before selecting live support.' : 'No ready stock. Check reservations, condition and service on Gear.'}</p>}
          {!cmd.practice && option.reason && <p className="dim">Purchase: {option.reason}.</p>}
          {!cmd.practice && state.department.funding < item.cost && <p className="dim">A new purchase needs {moneyFull(item.cost - state.department.funding)} more funding.</p>}
          {cmd.practice && choices.length === 0 && <p className="note note-amber"><Icon name="lock" size={16} />Unlock or own this vehicle to use it in ordinary practice. Equipment exercises provide their own virtual support.</p>}
          {conditions.length > 0 && available.length === 0 && !selection && <ul className="prep-support-issues">{conditions.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
          <label className="field">
            <span className="field-label">{item.name} support unit</span>
            <select aria-label={`${item.name} support unit`} value={selection?.id ?? ''} disabled={available.length === 0 && !selection} onChange={(event) => onSelect(event.target.value || null)}>
              <option value="">{available.length > 0 ? 'Choose this support vehicle' : 'No deployable unit'}</option>
              {choices.map((choice) => <option key={choice.id} value={choice.id} disabled={choice.issues.length > 0}>
                {choice.unit ? `${choice.unit.serial} · ${Math.round(choice.condition)}% · ${unitStateOf(choice.condition, item.wear)}` : 'Virtual vehicle · 100% condition'}{choice.issues.length > 0 ? ' · unavailable' : ''}
              </option>)}
            </select>
          </label>
          {selection && <p className={selection.issues.length ? 'tone-warn' : 'tone-mint'}>
            {selection.unit ? `${selection.unit.serial}: ${Math.round(selection.condition)}% condition · ${unitStateOf(selection.condition, item.wear)}` : 'Virtual support selected at 100% condition'}
          </p>}
        </Card>;
      })}
    </div>
  </Section>;
}
