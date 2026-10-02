import entries from './personas.json';

/** Authored identity and visual direction only. Never use culture, appearance or pronouns in gameplay formulas. */
export interface Persona {
  id: string;
  firstName: string;
  surname: string;
  pronouns: 'she' | 'he' | 'they';
  ageAtStart: number;
  culture: string;
  appearance: string;
  personalNote: string;
  portrait: string;
  legacyOfficerId?: string;
}
export const PERSONAS = entries as Persona[];
export const PERSONA_BY_ID: Readonly<Record<string, Persona>> = Object.fromEntries(PERSONAS.map((p) => [p.id, p]));
export const STARTER_PERSONAS = PERSONAS.filter((p) => p.legacyOfficerId);

/** Written as ordinary biographical prose rather than identity labels. */
export function personaNote(identityId?: string): string | null {
  const person = identityId ? PERSONA_BY_ID[identityId] : undefined;
  if (!person) return null;
  return person.personalNote;
}
