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
/** People in a stream's comments: first names and nicknames, the words they tack on, and the shapes
 * a handle takes. Lowercase, the way they type them. commenterHandle draws one; the pools are wide
 * enough that a call's chat rarely shows the same person twice. */
export const HANDLE_NAMES = ['dre', 'kev', 'monique', 'ollie', 'bev', 'tomas', 'sal', 'jaz', 'nia', 'marco', 'deshawn', 'lupe',
  'kenji', 'rosa', 'tay', 'bri', 'eli', 'ana', 'quinn', 'dev', 'hank', 'mo', 'lena', 'rico', 'tasha', 'yusuf', 'gabe', 'ivy',
  'omar', 'jo', 'priya', 'luis', 'shay', 'ben', 'kat', 'theo', 'mags', 'reggie', 'dani', 'pete', 'nadia', 'cass', 'vinnie', 'fern'] as const;
export const HANDLE_WORDS = ['nightowl', 'thirdshift', 'kerbside', 'sidestreet', 'twowheel', 'latebus', 'cornerstore', 'curbside',
  'overtime', 'lowbattery', 'rainjacket', 'scooter', 'hotplate', 'doubleshift', 'lunchrush', 'eastside', 'westend', 'ninthst',
  'busstop', 'laundromat', 'graveyard', 'tacotruck', 'dashcam', 'pothole', 'backseat', 'paydayloan', 'noodles', 'flatwhite'] as const;
const HANDLE_SHAPES: ((name: string, word: string, n: number) => string)[] = [
  (name, word) => `${word}_${name}`,
  (name, word) => `${name}.${word}`,
  (name, _, n) => `${name}${n % 1000}`,
  (name, word, n) => `${name}_${word}${n % 7 ? '' : n % 10}`,
  (name, _, n) => `${name}${name.length > 3 ? '' : name}${1980 + n % 30}`,
  (_, word, n) => `${word}${n % 1000}`,
  (name, word) => `its${name}${word.slice(0, 3)}`,
  (name, _, n) => `${name.replace('o', '0')}_${'abcdefghjkmnprstw'[n % 17]}`,
];

/** A commenter's handle, drawn from `key` (a call seed, a run and a line count): the same key always
 * gives the same person. */
export function commenterHandle(key: string): string {
  // Keys that differ in their last character (a line count) hash close together, so each draw is
  // mixed (murmur3's finalizer) before it picks.
  const draw = (part: string) => {
    let h = hashSeed(`${key}:${part}`);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  };
  const name = HANDLE_NAMES[hashIndex(draw('name'), HANDLE_NAMES.length)];
  const word = HANDLE_WORDS[hashIndex(draw('word'), HANDLE_WORDS.length)];
  return HANDLE_SHAPES[hashIndex(draw('shape'), HANDLE_SHAPES.length)](name, word, draw('n'));
}

/** The city every call is set in. */
export const CITY = { deliveryApp: DELIVERY_APPS[0], streamApp: STREAM_APPS[0], outlet: OUTLETS[0] };

/** World tokens and what they bind to on a call drawn from `seed`. */
export function worldFor(seed: number): Record<string, string> {
  return {
    delivery_app: CITY.deliveryApp,
    stream_app: CITY.streamApp,
    outlet: CITY.outlet.name,
    outlet_short: CITY.outlet.short,
    handle: commenterHandle(`${seed}:handle`),
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
