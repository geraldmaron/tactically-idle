// What each officer arrives with (starter-kit, owner decisions 2026-10-19 and 2026-10-21): the tool
// of their role. The basic kit every officer carries (radio, sidearm, carbine, light body armor) is
// part of the officer, not stock (sim/basic-kit.ts), so it is never issued here. Nothing is issued
// that the officer could not use: every certification an item asks for must already be held, and
// nothing behind a development node is issued. Kit joins the department pool, like any other unit.
import type { Id, Officer, Role } from '../sim/types';
import { ITEMS } from './items';

export const ROLE_TOOL: Record<Role, Id | null> = {
  comms: 'loud_hailer',
  breach: 'door_ram',
  medic: 'trauma_kit',
  recon: 'observation_binoculars',
  lead: null,
};

export function issueKit(o: Pick<Officer, 'role' | 'certs'>): Id[] {
  const tool = ROLE_TOOL[o.role];
  return (tool ? [tool] : []).filter((id) => {
    const def = ITEMS[id];
    return !!def && !def.requiresNode && (def.requiresCerts ?? []).every((cert) => (o.certs as string[]).includes(cert));
  });
}

/** What the kit adds to a signing. */
export function issueKitCost(o: Pick<Officer, 'role' | 'certs'>): number {
  return issueKit(o).reduce((sum, id) => sum + ITEMS[id].cost, 0);
}
