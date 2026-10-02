import type { Id, LocationDefinition, LocationFamily, Opening, Polygon, Vec, VariationRule } from './types';
import { hashSeed, next } from './rng';

// Seeded, authored variation. The seed picks one choice per rule, in declared
// order, from a PRNG derived from (family, version, seed). Seed 0 is reserved for
// the authored base layout so the approved mockup stays the default.

export type VariationChoice = string | number | boolean;
export interface RuleChoice {
  ruleId: Id;
  choice: VariationChoice;
}

const EPS = 1e-6;

/** The choice that reproduces the authored base layout for one rule. */
function baseChoice(family: LocationFamily, rule: VariationRule): VariationChoice {
  switch (rule.kind) {
    case 'shiftEdge':
      return 0;
    case 'openingState':
      return family.base.openings.find((o) => o.id === rule.openingId)?.state ?? rule.states[0];
    case 'optionalOpening':
      return family.base.openings.some((o) => o.id === rule.opening.id);
  }
}

/** Every rule consumes exactly one draw, so adding a rule never reshuffles earlier ones. */
export function variationChoices(family: LocationFamily, seed: number): RuleChoice[] {
  if (seed === 0) return family.variations.map((rule) => ({ ruleId: rule.id, choice: baseChoice(family, rule) }));
  let state = hashSeed(`${family.id}:${family.version}:${seed}`);
  return family.variations.map((rule) => {
    const r = next(state);
    state = r.state;
    switch (rule.kind) {
      case 'shiftEdge':
        return { ruleId: rule.id, choice: rule.offsets[Math.floor(r.value * rule.offsets.length)] };
      case 'openingState':
        return { ruleId: rule.id, choice: rule.states[Math.floor(r.value * rule.states.length)] };
      case 'optionalOpening':
        return { ruleId: rule.id, choice: r.value < rule.chance };
    }
  });
}

function shiftPoint(p: Vec, rule: Extract<VariationRule, { kind: 'shiftEdge' }>, offset: number): Vec {
  const other = rule.axis === 'x' ? p.y : p.x;
  const onLine = Math.abs(p[rule.axis] - rule.at) <= EPS;
  const inSpan = other >= rule.span[0] - EPS && other <= rule.span[1] + EPS;
  return onLine && inSpan ? { ...p, [rule.axis]: p[rule.axis] + offset } : p;
}

function shiftPolygon(poly: Polygon, rule: Extract<VariationRule, { kind: 'shiftEdge' }>, offset: number): Polygon {
  return poly.map((p) => shiftPoint(p, rule, offset));
}

function applyRule(loc: LocationDefinition, rule: VariationRule, choice: VariationChoice): void {
  switch (rule.kind) {
    case 'shiftEdge': {
      if (typeof choice !== 'number' || !(choice === 0 || rule.offsets.includes(choice)))
        throw new Error(`Rule ${rule.id}: ${String(choice)} is not an allowed offset`);
      if (choice === 0) return;
      loc.footprint = shiftPolygon(loc.footprint, rule, choice);
      if (loc.upperFootprint) loc.upperFootprint = shiftPolygon(loc.upperFootprint, rule, choice);
      for (const r of loc.rooms) r.polygon = shiftPolygon(r.polygon, rule, choice);
      for (const z of loc.zones) z.polygon = shiftPolygon(z.polygon, rule, choice);
      // Objects stay put on purpose: validation must catch any the move invalidates.
      for (const o of loc.openings) {
        o.from = shiftPoint(o.from, rule, choice);
        o.to = shiftPoint(o.to, rule, choice);
      }
      return;
    }
    case 'openingState': {
      if (typeof choice !== 'string' || !rule.states.includes(choice as Opening['state']))
        throw new Error(`Rule ${rule.id}: ${String(choice)} is not an allowed state`);
      const opening = loc.openings.find((o) => o.id === rule.openingId);
      if (!opening) throw new Error(`Rule ${rule.id}: no opening ${rule.openingId}`);
      opening.state = choice as Opening['state'];
      return;
    }
    case 'optionalOpening': {
      if (typeof choice !== 'boolean') throw new Error(`Rule ${rule.id}: choice must be boolean`);
      const present = loc.openings.some((o) => o.id === rule.opening.id);
      if (choice && !present) loc.openings.push(structuredClone(rule.opening));
      if (!choice && present) loc.openings = loc.openings.filter((o) => o.id !== rule.opening.id);
      return;
    }
  }
}

/**
 * Build a layout from explicit choices (rule id -> choice), for tests and devtools.
 * Rules not named fall back to the base layout's choice. Choices outside a rule's
 * authored options throw, so a forced variant is always one the author allowed.
 */
export function applyChoices(family: LocationFamily, choices: Record<Id, VariationChoice>): LocationDefinition {
  const known = new Set(family.variations.map((r) => r.id));
  for (const id of Object.keys(choices)) if (!known.has(id)) throw new Error(`Unknown variation rule ${id}`);
  const loc = structuredClone(family.base);
  for (const rule of family.variations) {
    applyRule(loc, rule, rule.id in choices ? choices[rule.id] : baseChoice(family, rule));
  }
  return loc;
}

export function applyVariations(family: LocationFamily, seed: number): LocationDefinition {
  const choices: Record<Id, VariationChoice> = {};
  for (const c of variationChoices(family, seed)) choices[c.ruleId] = c.choice;
  return { ...applyChoices(family, choices), seed };
}
