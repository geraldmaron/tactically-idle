import { describe, expect, it } from 'vitest';
import { ITEMS } from './items';
import { DEV_NODES } from './dev-tree';
import { hashSeed } from '../sim/rng';

// Capture taken before the copy pass. Only player-facing prose is excluded;
// IDs, aliases, prices, training gates, tags, supplies, wear and effects are kept.
const copyFields = new Set(['name', 'description', 'helpsWith', 'counters']);
function mechanics(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mechanics);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !copyFields.has(key)).map(([key, child]) => [key, mechanics(child)]));
  return value;
}
const itemCopy = (id: string) => {
  const item = ITEMS[id];
  return [item.name, item.description, ...(item.helpsWith ?? []), ...(item.counters ?? [])].join(' ');
};

describe('plain-language equipment and programs', () => {
  it('keeps every equipment and development mechanic unchanged by the copy pass', () => {
    expect(hashSeed(JSON.stringify(mechanics(ITEMS)))).toBe(3681832267);
    expect(hashSeed(JSON.stringify(mechanics(DEV_NODES)))).toBe(2951777412);
  });

  it('explains an everyday purpose before presenting game-score details', () => {
    for (const item of Object.values(ITEMS)) {
      expect(itemCopy(item.id), item.id).not.toMatch(/\b(?:authored|declared|abstract|token|committed)\b|scenario-declared|one exact stock/i);
      expect(item.description, item.id).not.toMatch(/^(?:Adds|Recovers|Cancels)\s+[+\d]|\+\d|observation points/i);
    }
    for (const node of Object.values(DEV_NODES)) expect(node.description, node.id).not.toMatch(/situational equipment|grants no certification|\b(?:authored|declared|abstract|entitlement)\b/i);
  });

  it('keeps observation, radio and protection limits visible in everyday wording', () => {
    const limits: [string, RegExp[]][] = [
      ['thermal_imager', [/Walls and glass block/, /cannot identify a person/]],
      ['camera_drone', [/trained drone operator/, /Blocked openings/, /cannot reveal the whole building/]],
      ['inspection_camera', [/drone operator qualification/, /sealed or blocked openings/, /whole building/]],
      ['observation_binoculars', [/solid barriers/, /no bonus in darkness/]],
      ['portable_light', [/no bonus in daylight/, /cannot shine through solid barriers/]],
      ['radio_relay', [/Both squads still need working headsets/, /cannot improve.*beyond a normal clear signal/]],
      ['ballistic_shield', [/bulk/, /never.*immune to harm/]],
      ['precision_support', [/clear view/, /specialist-qualified officer/, /separate supporting squad/, /Cannot reveal hidden people/, /must be checked before use/]],
      ['armored_rescue_vehicle', [/outside area the vehicle can reach/, /no protection inside buildings or on upper floors/, /Only one support vehicle/]],
      ['command_van', [/two or more squads/, /no bonus to a lone squad/, /cannot reveal hidden information/, /Only one support vehicle/]],
    ];
    for (const [id, checks] of limits) for (const check of checks) expect(itemCopy(id), id).toMatch(check);
  });

  it('preserves material restrictions and single-use costs instead of promising an unrestricted shortcut', () => {
    expect(itemCopy('rescue_spreader')).toMatch(/ordinary or steel doors/);
    expect(itemCopy('rescue_spreader')).toMatch(/Cannot get through walls, glass, floors or blocked routes/);
    expect(itemCopy('door_charge')).toMatch(/single-use/i);
    expect(itemCopy('door_charge')).toMatch(/nearby area must be checked first/);
    expect(itemCopy('door_charge')).toMatch(/Cannot get through reinforced doors, walls, glass, floors or blocked openings/);
    expect(itemCopy('door_charge')).toMatch(/\+8 pressure/);
    expect(itemCopy('door_charge')).toMatch(/risk of harm/);
    expect(itemCopy('energy_cartridge')).toMatch(/Does not work with the impact launcher/);
    expect(itemCopy('impact_supply')).toMatch(/Does not work with the conducted-energy device/);
    for (const id of ['energy_cartridge', 'impact_supply', 'trauma_kit']) expect(itemCopy(id), id).toMatch(/cannot be repaired or reused/);
  });

  it('keeps injury risk, training and checks explicit for both less-lethal options', () => {
    for (const id of ['conducted_energy_device', 'impact_launcher']) {
      const copy = itemCopy(id);
      expect(copy).toMatch(/less-lethal training/);
      expect(copy).toMatch(/clear view/);
      expect(copy).toMatch(/person and safety of the nearby area are checked/);
      expect(copy).toContain('Injury is still possible');
      expect(copy).toMatch(/Uses one (?:device cartridge|launcher supply) each time/);
    }
  });

  it('retains the exact numeric bonuses as secondary details', () => {
    const bonuses: [string, string[]][] = [
      ['observation_binoculars', ['+4']], ['inspection_camera', ['+6']], ['portable_light', ['up to 5']],
      ['radio_relay', ['up to 5']], ['light_protection', ['+4']], ['rescue_shield', ['+5']],
      ['service_sidearm', ['+3']], ['compact_carbine', ['+6']], ['response_shotgun', ['+5', '+2']],
      ['precision_support', ['+7']], ['conducted_energy_device', ['+4']], ['impact_launcher', ['+5']],
      ['support_van', ['from 3 minutes to 2']], ['armored_rescue_vehicle', ['+8']], ['command_van', ['+5']],
      ['rescue_spreader', ['+5', '2 extra minutes']], ['door_charge', ['+5', '1 minute faster', '+8 pressure']],
    ];
    for (const [id, details] of bonuses) for (const detail of details) expect(ITEMS[id].helpsWith!.slice(1).join(' '), id).toContain(detail);
  });

  it('names what programs make available and keeps officer training separate', () => {
    const programs: [string, RegExp][] = [
      ['field_less_lethal', /devices, launchers and their supplies/],
      ['field_response_program', /sidearms, carbines, response shotguns and light protective kits/],
      ['field_specialist_response', /precision support rifles/],
      ['field_controlled_access', /hydraulic rescue tools and single-use door charges/],
      ['logistics_field_support', /support vans, command vans and radio relays/],
      ['logistics_armored_support', /armored rescue vehicles/],
    ];
    for (const [id, equipment] of programs) {
      expect(DEV_NODES[id].description, id).toMatch(equipment);
      expect(DEV_NODES[id].description, id).toMatch(/available to buy/);
      expect(DEV_NODES[id].description, id).toMatch(/must complete|still require|required/);
    }
    expect(DEV_NODES.personnel_academy.description).toContain('2, 3, then 4 officers at once');
    expect(DEV_NODES.intel_records.description).toContain('$60, $120 and $200 per hour in total');
    expect(DEV_NODES.wellbeing_peer_support.description).toContain('50%, 75% and 100% faster');
    expect(DEV_NODES.logistics_equipment_manager.description).toContain('Choose an hourly repair budget in Gear to turn on automatic repairs');
  });
});
