import { describe, expect, it } from 'vitest';
import { isLabLocation } from './lab-entry';

describe('isLabLocation', () => {
  it('opens the lab at {base}lab with or without a trailing slash', () => {
    expect(isLabLocation('/lab', '', '/')).toBe(true);
    expect(isLabLocation('/lab/', '', '/')).toBe(true);
    expect(isLabLocation('/lab', '?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1', '/')).toBe(true);
    expect(isLabLocation('/tactically-idle/lab', '', '/tactically-idle/')).toBe(true);
    expect(isLabLocation('/tactically-idle/lab/', '?tab=play', '/tactically-idle/')).toBe(true);
  });

  it('opens the lab for a lab query key on any path, with or without a value', () => {
    expect(isLabLocation('/', '?lab', '/')).toBe(true);
    expect(isLabLocation('/tactically-idle/', '?lab', '/tactically-idle/')).toBe(true);
    expect(isLabLocation('/tactically-idle/', '?type=barricaded&lab=1', '/tactically-idle/')).toBe(true);
    expect(isLabLocation('/index.html', '?lab=', '/')).toBe(true);
  });

  it('opens the game everywhere else', () => {
    expect(isLabLocation('/', '', '/')).toBe(false);
    expect(isLabLocation('/', '?ti-responsive-preview=1&ti-qa-campaign=equipped', '/')).toBe(false);
    expect(isLabLocation('/tactically-idle/', '', '/tactically-idle/')).toBe(false);
    expect(isLabLocation('/labs', '', '/')).toBe(false);
    expect(isLabLocation('/lab/play', '', '/')).toBe(false);
    expect(isLabLocation('/other/lab', '', '/')).toBe(false);
    // The lab path sits under the base, not at the server root.
    expect(isLabLocation('/lab', '', '/tactically-idle/')).toBe(false);
    expect(isLabLocation('/', '?label=1&slab', '/')).toBe(false);
  });

  it('accepts a base without its trailing slash', () => {
    expect(isLabLocation('/tactically-idle/lab', '', '/tactically-idle')).toBe(true);
    expect(isLabLocation('/tactically-idle', '', '/tactically-idle')).toBe(false);
  });

  it('matches the last path segment under a relative base', () => {
    expect(isLabLocation('/somewhere/lab', '', './')).toBe(true);
    expect(isLabLocation('/somewhere/lab/', '', './')).toBe(true);
    expect(isLabLocation('/somewhere/', '', './')).toBe(false);
  });
});
