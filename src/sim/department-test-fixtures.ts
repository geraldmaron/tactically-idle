import { CAREER_SEEDS } from '../content/officers';
import { STARTER_PERSONAS } from '../content/personas';
import { createInitialState } from './department';
import { createPersonnel } from './personnel';
import { fillCandidates } from './roster';

/** Fixed established careers for tests of specific anniversaries and legacy migration. */
export function establishedDepartment(now: number, campaignSeed = 12345) {
  const state = createInitialState(now, campaignSeed);
  for (const person of STARTER_PERSONAS) {
    const officer = state.officers[person.legacyOfficerId!];
    const career = CAREER_SEEDS[officer.id];
    Object.assign(officer, {
      identityId: person.id, firstName: person.firstName, surname: person.surname, portrait: person.portrait,
      bornDay: -Math.round(career.age * 365), serviceStartDay: -Math.round(career.service * 365),
      career: { operations: career.operations, favorable: Math.round(career.operations * 0.55), adverse: Math.round(career.operations * 0.12) },
    });
  }
  state.personnel = createPersonnel(campaignSeed, state.officers);
  state.candidates = [];
  fillCandidates(state, now);
  return state;
}
