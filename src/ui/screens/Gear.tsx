import { MaterialGuide } from '../art/MaterialGuide';
import { GearArtFrame } from '../art/GearArt';
import { useEffect, useState } from 'react';
import { useGame } from '../store';
import { useNav } from '../components/nav';
import { EquipmentStore } from '../storefront/EquipmentStore';
import { BASIC_KIT_LINE } from '../../sim/basic-kit';
import { storeOptions } from '../../sim/department-selectors';
import type { StoreOption } from '../../sim/department-selectors';
import type { GameState, Id, Squad } from '../../sim/types';
import { ITEMS } from '../../content/items';
import { equipmentManagerBenefits, maintenanceBudget } from '../../sim/equipment-manager-policy';
import { managerView } from '../../sim/command-staff';
import { ManagerPortrait } from '../art/ManagerArt';
import { ManagerSheet } from '../components/CommandStaff';
import { Button, Card, Chip, EmptyState, Row, Stepper } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/toast';
import { Icon } from '../icons';
import { Disclosure } from '../components/Disclosure';
import { GEAR_CATEGORY_ICON, GEAR_SOURCE_ICON } from '../icons/kit';
import { money } from '../format';
import { hasNodeEffect } from './helpers';
import './gear-visual.css';

// The Armory (gear-armory): one list of every item, owned or not. Tapping an item opens one sheet
// that buys it, shows its stock and units, and sets its restock rule. Standing tools (restock rules,
// presets, the Quartermaster) open from the header.
export function GearScreen({ compactTools = false }: { compactTools?: boolean }) {
  const g = useGame();
  const opts = storeOptions(g);
  const [tool, setTool] = useState<'rules' | 'presets' | 'reference' | null>(null);
  const nav = useNav();
  return (
    <div className={`page gear-page${compactTools ? ' gear-page-compact' : ''}`}>
      {compactTools ? <Disclosure name="armory-tools" summary="Armory tools" icon="gear"><ArmoryHeader onTool={setTool} /></Disclosure> : <ArmoryHeader onTool={setTool} />}
      <EquipmentStore active compactControls={compactTools} />
      <Sheet open={tool === 'rules'} onClose={() => setTool(null)} title="Restock rules" subtitle="At each clock hour, held stock is refilled up to each target within its spending ceiling. Rules never take funding below zero and stop after 24 hours without orders.">
        <RestockSection onOpen={(itemId) => { setTool(null); nav.openEquipment({ itemId }); }} onGo={() => setTool(null)} />
      </Sheet>
      <Sheet open={tool === 'presets'} onClose={() => setTool(null)} title="Loadout presets" subtitle="Specialist gear each squad takes by default. Basic kit goes with every officer and is never packed.">
        <PresetSection opts={opts} onGo={() => setTool(null)} />
      </Sheet>
      <Sheet open={tool === 'reference'} onClose={() => setTool(null)} title="Construction reference">
        <MaterialGuide />
      </Sheet>
    </div>
  );
}

/** The Armory's standing lines: what every officer carries, the Quartermaster, and the tools
 * (restock rules, loadout presets, the wall guide) as one row of chips, so the items start on the
 * first screen. Loadout presets are edited here and nowhere else. */
function ArmoryHeader({ onTool }: { onTool: (tool: 'rules' | 'presets' | 'reference') => void }) {
  const g = useGame();
  const presets = hasNodeEffect(g, 'loadoutPresets');
  const restock = hasNodeEffect(g, 'restockRules');
  return (
    <section className="armory-head" aria-label="Armory">
      <p className="armory-basic"><Icon name={GEAR_SOURCE_ICON.basic} size={18} />{BASIC_KIT_LINE}</p>
      <div className="armory-list card" data-ui-list>
        <QuartermasterCard />
        <Row className="armory-tool" onClick={() => onTool('rules')} label={`Restock rules, ${restock.unlocked ? `${g.department.restockRules.length} set` : 'locked'}`}
          lead={<Icon name={restock.unlocked ? 'refresh' : 'lock'} size={24} />} title="Restock rules"
          detail={restock.unlocked ? 'Refill held stock each hour' : restock.nodeName ? `Unlocks with ${restock.nodeName}` : 'Locked'}
          trail={<Chip tone={restock.unlocked ? 'neutral' : 'warn'} icon={restock.unlocked ? undefined : 'lock'}>{restock.unlocked ? g.department.restockRules.length : 'Locked'}</Chip>} />
        <Row className="armory-tool" onClick={() => onTool('presets')} label={`Loadout presets, ${presets.unlocked ? `${g.squads.filter((s) => Object.keys(s.loadoutPreset).length).length} set` : 'locked'}`}
          lead={<Icon name={presets.unlocked ? GEAR_CATEGORY_ICON.response : 'lock'} size={24} />} title="Loadout presets"
          detail={presets.unlocked ? 'Specialist gear each squad takes' : presets.nodeName ? `Unlocks with ${presets.nodeName}` : 'Locked'}
          trail={<Chip tone={presets.unlocked ? 'neutral' : 'warn'} icon={presets.unlocked ? undefined : 'lock'}>{presets.unlocked ? g.squads.filter((s) => Object.keys(s.loadoutPreset).length).length : 'Locked'}</Chip>} />
        <Row className="armory-tool" onClick={() => onTool('reference')} lead={<Icon name="brick" size={24} />} title="Wall materials" detail="Construction reference" trail={<Icon name="chevronRight" size={18} />} />
      </div>
    </section>
  );
}

function RestockSection({ onOpen, onGo }: { onOpen: (itemId: Id) => void; onGo: () => void }) {
  const g = useGame();
  const restock = hasNodeEffect(g, 'restockRules');
  if (!restock.unlocked) return <LockedTool tool={restock} onGo={onGo} />;
  return <RuleList g={g} onOpen={onOpen} />;
}

/** A tool still locked says which upgrade opens it and goes there in one tap. */
function LockedTool({ tool, onGo }: { tool: ReturnType<typeof hasNodeEffect>; onGo: () => void }) {
  const nav = useNav();
  return <div className="stack">
    <p className="note note-warn"><Icon name="lock" size={16} />{tool.reason}</p>
    {tool.nodeId && <Button variant="primary" icon="build" onClick={() => { onGo(); nav.openDevelopment(tool.nodeId!); }}>View {tool.nodeName}</Button>}
  </div>;
}

function PresetSection({ opts, onGo }: { opts: StoreOption[]; onGo: () => void }) {
  const g = useGame();
  const presets = hasNodeEffect(g, 'loadoutPresets');
  if (!presets.unlocked) return <LockedTool tool={presets} onGo={onGo} />;
  if (g.squads.length === 0) return <EmptyState spot="openSlot" title="No squads to set presets for" />;
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
  const line = !view.hired ? view.activity : budget ? `Services up to ${money(budget)}/hour` : 'Automatic service off';
  return (
    <>
      <Row className={`qm-row qm-row-${view.status}`} onClick={() => setOpen(true)}
        lead={<ManagerPortrait person={view.holder?.person ?? null} size={40} />}
        title={view.profile.title}
        detail={view.hired ? <>{line}<br />Tier {benefits.tier} · {Math.round((1 - benefits.repairMultiplier) * 100)}% cheaper service, {Math.round((1 - benefits.wearMultiplier) * 100)}% less wear</> : line}
        trail={<Icon name="chevronRight" size={18} />} />
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
  const rows = opts.filter((o) => o.owned > 0 && o.item.kind !== 'infrastructure' && !o.item.supportOnly);
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
