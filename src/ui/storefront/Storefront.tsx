import { EquipmentStore } from './EquipmentStore';

/** Legacy import compatibility; player navigation owns each canonical destination. */
export function Storefront({ active }: { active: boolean }) {
  return <EquipmentStore active={active} />;
}
