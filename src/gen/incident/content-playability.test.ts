import { describe, it, expect } from 'vitest';
import { gateFrameworks } from './gates/catalog';
import { frameworkJourneys, hostingReport } from './gates/playability';

/** Playability gate for every typed framework (docs/content-pipeline.md): 50 generated
 * buildings per listed type bind and reach every role, the type is only listed where at
 * least 30% of building seeds host the call, and real dispatch journeys reach an ending
 * in every situation and through the failed-response report, saving after each step. */
const FRAMEWORKS = gateFrameworks();
const BUILDINGS = 50, MIN_HOSTING = 0.3;

describe('content gate: binding and squad reachability on generated buildings', () => {
  it.each(FRAMEWORKS.flatMap(entry => entry.generated.map(familyId => ({ type: entry.framework.type, familyId }))))('$type on $familyId', ({ type, familyId }) => {
    const report = hostingReport(type, familyId, BUILDINGS);
    expect(report.problems).toEqual([]);
    expect(report.hosted / report.total, `${type} hosts ${report.hosted}/${report.total} on ${familyId}`).toBeGreaterThanOrEqual(MIN_HOSTING);
  }, 120000);
});

describe('content gate: real dispatch journeys with save and reload', () => {
  it.each(FRAMEWORKS.map(entry => ({ type: entry.framework.type, entry })))('$type completes every situation and fails honestly', ({ entry }) => {
    // One authored or first-listed building, and one generated building where listed.
    const families = [...new Set([entry.families[0], entry.generated[0]].filter((id): id is string => !!id))];
    for (const familyId of families) for (const result of frameworkJourneys(entry.framework.type, familyId)) {
      expect(result.problems, `${result.id}: ${result.steps.join(' > ')}`).toEqual([]);
      expect(result.saveRoundTrips).toBe(result.steps.length);
    }
  }, 120000);
});
