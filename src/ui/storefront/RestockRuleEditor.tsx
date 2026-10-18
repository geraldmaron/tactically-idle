import { useEffect, useState } from 'react';
import { ITEMS } from '../../content/items';
import type { Id, RestockRule } from '../../sim/types';
import { useToast } from '../components/toast';
import { Button, Chip, Stepper } from '../components/ui';
import { useGame } from '../store';

/** One item's hourly restock rule, edited inside that item's sheet (one tile, one tap). */
export function RestockRuleEditor({ itemId }: { itemId: Id }) {
  const g = useGame();
  const { act } = useToast();
  const item = ITEMS[itemId];
  const existing = g.department.restockRules.find((rule) => rule.itemId === itemId);
  const [target, setTarget] = useState(existing?.target ?? 1);
  const [ceiling, setCeiling] = useState(existing?.budgetCeiling ?? item.cost * 2);
  useEffect(() => {
    if (existing) {
      setTarget(existing.target);
      setCeiling(existing.budgetCeiling);
    }
  }, [existing]);
  const rule: RestockRule = { itemId, target, budgetCeiling: Math.max(0, Math.round(ceiling)) };
  const same = !!existing && existing.target === rule.target && existing.budgetCeiling === rule.budgetCeiling;
  return (
    <section className="restock-rule" aria-label={`Automatic restock for ${item.name}`}>
      <div className="restock-rule-head">
        <h3>Automatic restock</h3>
        {existing ? <Chip tone="mint" icon="refresh">Rule on</Chip> : <Chip icon="refresh">Off</Chip>}
      </div>
      <div className="rule-controls">
        <div className="rule-field">
          <span>Keep at least</span>
          <Stepper label={`${item.name} target`} value={target} max={20} onChange={setTarget} />
        </div>
        <label className="rule-field">
          <span>Spend up to ($)</span>
          <input className="num" inputMode="numeric" type="number" min={0} step={50} value={ceiling} onChange={(event) => setCeiling(Number(event.target.value) || 0)} />
        </label>
      </div>
      <div className="row-actions">
        {existing && (
          <Button size="sm" variant="ghost" onClick={() => act({ type: 'setRestockRule', rule: { itemId, remove: true } }, 'Rule removed')}>
            Remove
          </Button>
        )}
        <Button size="sm" variant="primary" disabled={same} onClick={() => act({ type: 'setRestockRule', rule }, 'Rule saved')}>
          {existing ? 'Update rule' : 'Add rule'}
        </Button>
      </div>
    </section>
  );
}
