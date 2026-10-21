// The city's named things: the apps, the stream site, the news. Calls name them through bare tokens
// ({delivery_app}, {stream_app}, {outlet}, {outlet_short}, {handle}) so no call says "the app" or
// "the news" and every call in a save talks about the same companies.
//
// The canon is fixed: one name per kind, the same in every call, so a later call can mention the
// app an earlier one turned on. The pools behind it are where a per-save city would draw from
// (backlog `city-canon-per-save`). Commenter handles are throwaway people, so each call draws one.
//
// Every name is invented. REAL_BRANDS keeps real companies out (world.test.ts).
import { hashIndex, hashSeed } from '../sim/rng';

export interface Outlet { name: string; short: string }

export const DELIVERY_APPS = ['Hotbag', 'Kerbie', 'Satchel Run'] as const;
export const STREAM_APPS = ['Loopcast', 'Flarecam', 'Streamstall'] as const;
export const OUTLETS: readonly Outlet[] = [
  { name: 'Metro 6 News', short: 'Metro 6' },
  { name: 'the Riverside Ledger', short: 'the Ledger' },
];
/** People in a stream's comments. Lowercase, the way they type them. */
export const HANDLES = ['thirdshift_dre', 'kerbside_kev', 'm0nique_eats', 'nightowl_ollie', 'baglady_bev', 'two_wheel_tomas', 'sidestreet_sal'] as const;

/** The city every call is set in. */
export const CITY = { deliveryApp: DELIVERY_APPS[0], streamApp: STREAM_APPS[0], outlet: OUTLETS[0] };

/** World tokens and what they bind to on a call drawn from `seed`. */
export function worldFor(seed: number): Record<string, string> {
  return {
    delivery_app: CITY.deliveryApp,
    stream_app: CITY.streamApp,
    outlet: CITY.outlet.name,
    outlet_short: CITY.outlet.short,
    handle: HANDLES[hashIndex(hashSeed(`${seed}:handle`), HANDLES.length)],
  };
}

/** The world tokens a call may use. */
export const WORLD_TOKENS: readonly string[] = Object.keys(worldFor(0));

/** Real companies a fictional name must never match or contain (lowercase). */
export const REAL_BRANDS = [
  'doordash', 'uber', 'grubhub', 'deliveroo', 'postmates', 'instacart', 'just eat', 'seamless', 'caviar',
  'twitch', 'tiktok', 'youtube', 'instagram', 'facebook', 'kick', 'periscope', 'snapchat', 'twitter',
  'cnn', 'fox', 'nbc', 'abc', 'cbs', 'msnbc', 'reuters', 'associated press',
];
