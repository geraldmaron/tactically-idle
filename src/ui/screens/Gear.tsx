import { MaterialGuide } from '../art/MaterialGuide';
import { GearArtFrame } from '../art/GearArt';
import { useEffect, useState } from 'react';
import { useGame } from '../store';
import { useNav } from '../components/nav';
import { EquipmentStore } from '../storefront/EquipmentStore';
import { storeOptions } from '../../sim/department-selectors';
import type { StoreOption } from '../../sim/department-selectors';
import type { GameState, Id, Squad } from '../../sim/types';
import { ITEMS } from '../../content/items';
import { equipmentManagerBenefits, maintenanceBudget } from '../../sim/equipment-manager-policy';
import { managerView } from '../../sim/command-staff';
import { ManagerPortrait } from '../art/ManagerArt';
import { ManagerSheet } from '../components/CommandStaff';
import { Button, Card, Chip, EmptyState, Stepper } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/toast';
import { Icon } from '../icons';
import { money } from '../format';
import { hasNodeEffect } from './helpers';
import './gear-visual.css';

// The Armory (gear-armory): one list of every item, owned or not. Tapping an item opens one sheet
// that buys it, shows its stock and units, and sets its restock rule. Standing tools (restock rules,
// presets, the Quartermaster) open from the header.
export function GearScreen() {
  const g = useGame();
  const opts = storeOptions(g);
  const [tool, setTool] = useState<'rules' | 'presets' | 'reference' | null>(null);
  const nav = useNav();
  const owned = opts.filter((option) => option.owned > 0);
  return (
    <div className="page gear-page">
      <ArmoryHeader owned={owned} onTool={setTool} />
      <EquipmentStore active />
      <Sheet open={tool === 'rules'} onClose={() => setTool(null)} title="Restock rules" subtitle="At each clock hour, held stock is refilled up to each target within its spending ceiling. Rules never take funding below zero and stop after 24 hours without orders.">
        <RestockSection onOpen={(itemId) => { setTool(null); nav.openEquipment({ itemId }); }} />
      </Sheet>
      <Sheet open={tool === 'presets'} onClose={() => setTool(null)} title="Loadout presets" subtitle="Specialist gear each squad takes by default. Radios are standard kit: one per deployed officer is loaded automatically.">
        <PresetSection opts={opts} />
      </Sheet>
      <Sheet open={tool === 'reference'} onClose={() => setTool(null)} title="Construction reference">
        <MaterialGuide />
      </Sheet>
    </div>
  );
}

/** What the department holds, as three numbers, and the Armory's standing tools. */
function ArmoryHeader({ owned, onTool }: { owned: StoreOption[]; onTool: (tool: 'rules' | 'presets' | 'reference') => void }) {
  const g = useGame();
  const presets = hasNodeEffect(g, 'loadoutPresets');
  const restock = hasNodeEffect(g, 'restockRules');
  const ready = owned.reduce((n, o) => n + o.ready, 0);
  const busy = owned.reduce((n, o) => n + o.reserved + o.inService, 0);
  return (
    <section className="armory-head" aria-label="Armory">
      <div className="inv-summary">
        <span className="inv-stat inv-stat-ready"><Icon name="checkcircle" size={14} /><b>{ready}</b> ready</span>
        <span className="inv-stat"><Icon name="wait" size={14} /><b>{busy}</b> busy</span>
        <span className="inv-stat"><Icon name="box" size={14} /><b>{owned.length}</b> kinds held</span>
      </div>
      <QuartermasterCard />
      <div className="armory-tools">
        <button type="button" className="armory-tool" aria-haspopup="dialog" onClick={() => onTool('rules')}>
          <Icon name={restock.unlocked ? 'refresh' : 'lock'} size={16} />
          <span><strong>Restock rules</strong><span className="dim">{restock.unlocked ? `${g.department.restockRules.length} active` : 'Locked'}</span></span>
        </button>
        <button type="button" className="armory-tool" aria-haspopup="dialog" onClick={() => onTool('presets')}>
          <Icon name={presets.unlocked ? 'list' : 'lock'} size={16} />
          <span><strong>Loadout presets</strong><span className="dim">{presets.unlocked ? `${g.squads.filter((s) => Object.keys(s.loadoutPreset).length).length} saved` : 'Locked'}</span></span>
        </button>
        <button type="button" className="armory-tool" aria-haspopup="dialog" onClick={() => onTool('reference')}>
          <Icon name="brick" size={16} />
          <span><strong>Wall materials</strong><span className="dim">Reference</span></span>
        </button>
      </div>
    </section>
  );
}

function RestockSection({ onOpen }: { onOpen: (itemId: Id) => void }) {
  const g = useGame();
  const restock = hasNodeEffect(g, 'restockRules');
  if (!restock.unlocked) return <p className="note note-warn"><Icon name="lock" size={16} />{restock.reason}</p>;
  return <RuleList g={g} onOpen={onOpen} />;
}

function PresetSection({ opts }: { opts: StoreOption[] }) {
  const g = useGame();
  const presets = hasNodeEffect(g, 'loadoutPresets');
  if (!presets.unlocked) return <p className="note note-warn"><Icon name="lock" size={16} />{presets.reason}</p>;
  if (g.squads.length === 0) return <EmptyState icon="people" title="No squads to set presets for" />;
  return <div className="stack">{g.squads.map((s) => <PresetEditor key={s.id} squad={s} opts={opts} />)}</div>;
}

/** The Quartermaster is a Command Staff manager: the same face and sheet as on HQ, so the service
 * budget lives in one place. The card shows tier benefits as chips and the latest action. */
function QuartermasterCard() {
  const g = useGame();
  const [open, setOpen] = useState(false);
  const view = managerView(g, 'quartermaster');
  const benefits = equipmentManagerBenefits(g);
  const budget = maintenanceBudget(g);
  const latest = view.log[0];
  const line = !view.hired ? view.activity : budget ? `Services up to ${money(budget)}/hour` : 'Automatic service off';
  return (
    <>
      <button type="button" className={`qm-card qm-card-${view.status}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <ManagerPortrait person={view.holder?.person ?? null} size={52} />
        <span className="qm-main">
          <span className="qm-title"><strong>{view.profile.title}</strong><span className={`staff-pill staff-pill-${view.status}`}>{view.status === 'on' ? 'On' : view.status === 'off' ? 'Off' : view.open ? 'Vacant' : 'Not hired'}</span></span>
          <span className="qm-line">{line}</span>
          {view.hired && (
            <span className="chips qm-chips">
              <Chip icon="star">Tier {benefits.tier}</Chip>
              <Chip tone="mint" icon="wrench">{Math.round((1 - benefits.repairMultiplier) * 100)}% cheaper service</Chip>
              <Chip tone="mint" icon="gauge">{Math.round((1 - benefits.wearMultiplier) * 100)}% less wear</Chip>
            </span>
          )}
          {latest && <span className="qm-log dim">{latest.text}</span>}
        </span>
        <Icon name="gear" size={18} />
      </button>
      {open && <ManagerSheet id="quartermaster" g={g} now={Date.now()} inGear onClose={() => setOpen(false)} />}
    </>
  );
}

/** Active restock rules as compact rows. Rules are set in each item's sheet. */
function RuleList({ g, onOpen }: { g: GameState; onOpen: (itemId: Id) => void }) {
  const rules = g.department.restockRules.filter((rule) => ITEMS[rule.itemId]);
  if (!rules.length) return <p className="dim rule-empty">No rules yet. Open any item and set <strong>Keep at least</strong> to add one.</p>;
  return (
    <ul className="rule-list">
      {rules.map((rule) => (
        <li key={rule.itemId}>
          <button type="button" onClick={() => onOpen(rule.itemId)} aria-label={`${ITEMS[rule.itemId].name}: keep at least ${rule.target}, spend up to ${money(rule.budgetCeiling)}. Edit`}>
            <GearArtFrame itemId={rule.itemId} size={26} />
            <span className="rule-list-main"><strong>{ITEMS[rule.itemId].name}</strong><span className="dim">Keep {rule.target} · up to {money(rule.budgetCeiling)}</span></span>
            <Icon name="edit" size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function PresetEditor({ squad, opts }: { squad: Squad; opts: StoreOption[] }) {
  const { act } = useToast();
  const [draft, setDraft] = useState<Record<Id, number>>(squad.loadoutPreset);
  useEffect(() => setDraft(squad.loadoutPreset), [squad.loadoutPreset]);
  const rows = opts.filter((o) => o.owned > 0 && o.item.kind !== 'infrastructure' && !o.item.supportOnly && o.item.id !== 'radio_kit');
  const dirty = JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(squad.loadoutPreset));
  return (
    <Card className="preset">
      <div className="prepsquad-head">
        <span className="squad-badge">{squad.id}</span>
        <strong>{squad.name}</strong>
      </div>
      {rows.length === 0 ? (
        <p className="dim">Buy equipment to build a preset.</p>
      ) : (
        <ul className="loadout">
          {rows.map((o) => (
            <li key={o.item.id} className="lo">
              <GearArtFrame itemId={o.item.id} size={26} />
              <span className="lo-main">
                <strong>{o.item.name}</strong>
                <span className="dim">{o.owned} owned</span>
              </span>
              <Stepper label={o.item.name} value={draft[o.item.id] ?? 0} max={o.owned} onChange={(n) => setDraft((d) => ({ ...d, [o.item.id]: n }))} />
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" variant="primary" disabled={!dirty} onClick={() => act({ type: 'setLoadoutPreset', squadId: squad.id, items: normalize(draft) }, `${squad.name} preset saved`)}>
        Save preset
      </Button>
    </Card>
  );
}

function normalize(r: Record<Id, number>): Record<Id, number> {
  return Object.fromEntries(Object.entries(r).filter(([, q]) => q > 0).sort(([a], [b]) => a.localeCompare(b)));
}
