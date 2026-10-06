// Versioned distance math for locations. ECMA-262 §21.3.2 lets engines approximate Math.hypot
// (and exp, log, pow, the trig functions and `**`); measured on V8, Math.hypot differs from
// Math.sqrt(x*x + y*y) in about a third of quarter-foot grid pairs, and other engines may round
// differently again. A comparison that lands on a threshold can then flip between browsers.
// Locations issued before `_g2` keep Math.hypot (their derived costs and furnishing are frozen
// content); a location with `geometry: 'exact'` is measured with multiply, add and the correctly
// rounded Math.sqrt (§21.3.2.33), which every engine computes bit for bit.
import type { GeometryVersion, Vec } from './types';

export type Hypot = (dx: number, dy: number) => number;
export type Distance = (a: Vec, b: Vec) => number;

/** Length of (dx, dy) from IEEE-754 multiply, add and square root only. */
export const exactHypot: Hypot = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
const exactDistance: Distance = (a, b) => exactHypot(a.x - b.x, a.y - b.y);
// Looked up on each call, exactly as the legacy call sites wrote it.
const legacyHypot: Hypot = (dx, dy) => Math.hypot(dx, dy);
const legacyDistance: Distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** The vector length a location's geometry version uses. */
export const hypotFor = (geometry: GeometryVersion | undefined): Hypot => geometry === 'exact' ? exactHypot : legacyHypot;
/** The point distance a location's geometry version uses. */
export const distanceFor = (geometry: GeometryVersion | undefined): Distance => geometry === 'exact' ? exactDistance : legacyDistance;
