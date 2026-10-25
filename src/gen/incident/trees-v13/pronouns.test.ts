import { describe, expect, it } from 'vitest';
import { bindRoleTokens, type CastIdentity } from './compile';

// Control Q1 (docs/content-policy.md): a pronoun is used when it cannot be mistaken for another person
// in the string, and the person's name when it could.
const who = (firstName: string, pronouns: CastIdentity['pronouns']): CastIdentity => ({ firstName, surname: 'Lee', pronouns });
const bind = (text: string, cast: Record<string, CastIdentity>) => bindRoleTokens(text, cast);

describe('pronoun binding', () => {
  const text = '{clerk.first} was coming out with water when the handgun came out of {rider.first}’s jacket. {clerk.He} backed away with the water in {clerk.his} arms.';

  it('keeps the pronoun when the last person mentioned has another pronoun', () => {
    expect(bind(text, { clerk: who('Destiny', 'she'), rider: who('Ryan', 'he') })).toContain('jacket. She backed away with the water in her arms.');
  });
  it('uses the name when the last person mentioned shares the pronoun', () => {
    expect(bind(text, { clerk: who('Destiny', 'she'), rider: who('Veronica', 'she') })).toContain('jacket. Destiny backed away with the water in her arms.');
    expect(bind(text, { clerk: who('Remy', 'they'), rider: who('Cameron', 'they') })).toContain('jacket. Remy backed away with the water in their arms.');
  });
  it('turns a possessive into the name possessive, and leaves reflexives alone', () => {
    const cast = { a: who('Ana', 'she'), b: who('Bea', 'she') };
    expect(bind('{a.first} nodded. {b.His} phone rang. {b.He} held {b.himself} still.', cast)).toBe('Ana nodded. Bea’s phone rang. She held herself still.');
  });
  it('keeps a verb singular after a name that replaced a singular they', () => {
    const cast = { a: who('Ana', 'they'), b: who('Bea', 'they') };
    expect(bind('{a.first} left. {b.He} {b~is|are} still here and {b.he} {b~keeps|keep} waiting.', cast)).toBe('Ana left. Bea is still here and they keep waiting.');
  });
  it('leaves a string that starts on a pronoun alone', () => {
    expect(bind('{a.He} waits.', { a: who('Ana', 'she') })).toBe('She waits.');
  });
});
