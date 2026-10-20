// What each officer arrives with (starter-kit, owner decision 2026-10-19): a radio headset and a
// light protective kit for everyone, a sidearm only for entry-trained officers, and the tool of
// their role. Nothing is issued
// that the officer could not use: every certification an item asks for must already be held, and
// nothing behind a development node is issued. Kit joins the department pool, like any other unit.
import type { Id, Officer, Role } from '../sim/types';
import { ITEMS } from './items';

export const ISSUE_RADIO = 'radio_kit';

export const ROLE_TOOL: Record<Role, Id | null> = {
  comms: 'loud_hailer',
  breach: 'door_ram',
  medic: 'trauma_kit',
  recon: 'observation_binoculars',
  lead: null,
};

export function issueKit(o: Pick<Officer, 'role' | 'certs'>): Id[] {
  const tool = ROLE_TOOL[o.role];
  return [ISSUE_RADIO, 'light_protection', 'service_sidearm', ...(tool ? [tool] : [])].filter((id) => {
    const def = ITEMS[id];
    return !!def && !def.requiresNode && (def.requiresCerts ?? []).every((cert) => (o.certs as string[]).includes(cert));
  });
}

/** What the kit adds to a signing: everything but the radio, which every officer needs to deploy
 * and the department provides. */
export function issueKitCost(o: Pick<Officer, 'role' | 'certs'>): number {
  return issueKit(o).filter((id) => id !== ISSUE_RADIO).reduce((sum, id) => sum + ITEMS[id].cost, 0);
}
