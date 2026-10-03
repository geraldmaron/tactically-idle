import { COURSES } from '../content/courses';
import { ITEMS } from '../content/items';
import { createInitialState } from '../sim/department';
import { createUnit } from '../sim/equipment';
import { serialize } from '../sim/save';
import type { CampaignSlots } from '../sim/campaign-slots';
import type { CertId, HandlerResult } from '../sim/types';

export const QA_CAMPAIGN_PARAM = 'ti-qa-campaign';
export type QaCampaignPreset = 'fresh' | 'equipped';
export interface QaCampaignContext { temporary: boolean; framed: boolean; search: string }
export function qaCampaignPreset(context: QaCampaignContext): QaCampaignPreset | null {
  if (!context.temporary || !context.framed) return null;
  const preset = new URLSearchParams(context.search).get(QA_CAMPAIGN_PARAM);
  return preset === 'fresh' || preset === 'equipped' ? preset : null;
}

/** A deterministic disposable department. Every unit still uses normal reservation and action rules. */
export function createQaCampaign(now: number, preset: QaCampaignPreset) {
  const state = createInitialState(now, 41041);
  state.department.name = preset === 'equipped' ? 'TEST · Equipped team' : 'TEST · Fresh department';
  if (preset === 'equipped') {
    const certs = new Set<CertId>([
      ...Object.values(COURSES).flatMap((course) => course.grants.cert ? [course.grants.cert] : []),
      ...Object.values(ITEMS).flatMap((item) => item.requiresCerts ?? []),
    ]);
    for (const officer of Object.values(state.officers)) officer.certs = [...new Set([...officer.certs, ...certs])];
    for (const item of Object.values(ITEMS)) {
      const count = item.supportOnly ? 1 : item.kind === 'consumable' ? 16 : 4;
      for (let index = 0; index < count; index++) createUnit(state, item.id, now, { condition: 100, ageDays: 0 });
    }
  }
  return state;
}

/** Guard before touching the save library; callers cannot equip an ordinary game via a query string. */
export function initializeQaCampaign(campaigns: Pick<CampaignSlots, 'importGame' | 'load'>, context: QaCampaignContext, now: number): HandlerResult | null {
  const preset = qaCampaignPreset(context);
  if (!preset) return null;
  const imported = campaigns.importGame(2, preset === 'equipped' ? 'TEST · Equipped team' : 'TEST · Fresh department', serialize(createQaCampaign(now, preset), now), now);
  if (!imported.ok) return imported;
  return campaigns.load(2, now, true);
}
