import { describe, expect, it } from 'vitest';

// Saves rebuild `_g1` buildings from (familyId, seed) alone, on whatever engine the player runs.
// ECMA-262 §21.3.2 lets engines approximate these functions (and the `**` operator, which is
// Number::exponentiate, like Math.pow), so none may appear in generator code. Math.sqrt is
// exempt: §21.3.2.33 defines it as the correctly rounded root. Math.random is banned outright.
const BANNED = /\bMath\.(acos|acosh|asin|asinh|atan|atanh|atan2|cbrt|cos|cosh|exp|expm1|hypot|log|log1p|log2|log10|pow|random|sin|sinh|tan|tanh)\b|\*\*/;

/** Source without comments. Strings and regex literals in this code never contain comment markers. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function bannedMath(src: string): string[] {
  return stripComments(src).split('\n').filter((line) => BANNED.test(line)).map((line) => line.trim());
}

const SOURCES = import.meta.glob('./procedural/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('engine-independent arithmetic in the procedural generator', () => {
  it('reads the generator source', () => {
    expect(Object.keys(SOURCES)).toContain('./procedural/generate.ts');
    expect(Object.keys(SOURCES)).toContain('./procedural/fill.ts');
    expect(Object.keys(SOURCES).length).toBeGreaterThan(25);
  });

  it('flags approximated Math calls in code but not in comments', () => {
    expect(bannedMath('const d = Math.hypot(a, b);')).toHaveLength(1);
    expect(bannedMath('if (r < Math.exp(-x)) y = 2 ** k;')).toHaveLength(1);
    expect(bannedMath('const s = Math.sqrt(x * x);\n// Math.log is approximated\n/** Math.pow too */')).toEqual([]);
  });

  it.each(Object.keys(SOURCES))('%s uses only exactly specified arithmetic', (file) => {
    expect(bannedMath(SOURCES[file])).toEqual([]);
  });
});
