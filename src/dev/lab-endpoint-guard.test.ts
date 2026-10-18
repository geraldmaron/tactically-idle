// The /__lab endpoints answer only the lab's own page, and the string checks never pass a cast entry
// the checker could read as an option (review findings string-checks-argv-injection and
// lab-endpoints-accept-cross-origin-writes).
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config.ts?raw';
import { labRequestRefusal, parseStringChecks } from './lab-endpoint-guard';

const HOST = 'localhost:5173';
const json = { host: HOST, 'content-type': 'application/json' };

describe('labRequestRefusal', () => {
  it('serves the lab page itself', () => {
    expect(labRequestRefusal('POST', { ...json, origin: `http://${HOST}`, 'sec-fetch-site': 'same-origin' })).toBeNull();
    expect(labRequestRefusal('GET', { host: HOST, 'sec-fetch-site': 'same-origin' })).toBeNull();
    expect(labRequestRefusal('GET', { host: HOST, 'sec-fetch-site': 'none' })).toBeNull();
    // curl and other local tools send neither header.
    expect(labRequestRefusal('POST', json)).toBeNull();
    expect(labRequestRefusal('GET', { host: HOST })).toBeNull();
  });

  it('refuses another origin, a localhost page on another port included', () => {
    expect(labRequestRefusal('POST', { ...json, origin: 'https://attacker.example' })).toMatch(/another origin/);
    expect(labRequestRefusal('POST', { ...json, origin: 'http://localhost:5534' })).toMatch(/another origin/);
    expect(labRequestRefusal('GET', { host: HOST, origin: 'http://localhost:5534' })).toMatch(/another origin/);
    expect(labRequestRefusal('POST', { ...json, origin: 'null' })).toMatch(/another origin/);
    expect(labRequestRefusal('POST', { ...json, 'sec-fetch-site': 'cross-site' })).toMatch(/cross-site/);
    expect(labRequestRefusal('POST', { ...json, 'sec-fetch-site': 'same-site' })).toMatch(/same-site/);
    expect(labRequestRefusal('POST', { ...json, 'sec-fetch-site': 'none' })).toMatch(/none/);
  });

  it('refuses a write that is not JSON, the only kind a page can send without a preflight', () => {
    expect(labRequestRefusal('POST', { host: HOST, 'content-type': 'text/plain' })).toMatch(/application\/json/);
    expect(labRequestRefusal('POST', { host: HOST })).toMatch(/application\/json/);
    expect(labRequestRefusal('POST', { host: HOST, 'content-type': 'Application/JSON; charset=utf-8' })).toBeNull();
  });
});

describe('parseStringChecks', () => {
  it('keeps the cast words castWords emits', () => {
    const cast = ['Renata', 'Okafor', "O'Neil", 'Mary-Ann', 'Nguyen', 'B2', 'Ünal'];
    expect(parseStringChecks({ tsv: 'x', cast })).toEqual({ tsv: 'x', cast });
    expect(parseStringChecks({ tsv: 'x', cast: [] })).toEqual({ tsv: 'x', cast: [] });
    expect(parseStringChecks({ tsv: 'x' })).toEqual({ tsv: 'x', cast: [] });
  });

  it('refuses a cast entry the checker would read as an option', () => {
    expect(parseStringChecks({ tsv: 'x', cast: ['--write-txt', '/Users/someone/.zshrc'] })).toHaveProperty('problem');
    expect(parseStringChecks({ tsv: 'x', cast: ['Renata', '-h'] })).toHaveProperty('problem');
    expect(parseStringChecks({ tsv: 'x', cast: [' --keep'] })).toHaveProperty('problem');
    expect(parseStringChecks({ tsv: 'x', cast: [''] })).toHaveProperty('problem');
    expect(parseStringChecks({ tsv: 'x', cast: ['a\nb'] })).toHaveProperty('problem');
    expect(parseStringChecks({ tsv: 'x', cast: ['x'.repeat(65)] })).toHaveProperty('problem');
    expect(parseStringChecks({ tsv: 'x', cast: Array.from({ length: 257 }, () => 'Lee') })).toHaveProperty('problem');
    expect(parseStringChecks({ tsv: 'x', cast: [3] })).toHaveProperty('problem');
    expect(parseStringChecks({ tsv: 'x', cast: 'Lee' })).toHaveProperty('problem');
    expect(parseStringChecks({ tsv: 3, cast: [] })).toHaveProperty('problem');
    expect(parseStringChecks(null)).toHaveProperty('problem');
  });
});

describe('vite.config.ts wiring', () => {
  it('checks every /__lab route before it reads, writes or runs anything', () => {
    const routes = viteConfig.split("server.middlewares.use('/__lab").slice(1);
    expect(routes.length).toBe(4);
    for (const route of routes.filter(route => !route.startsWith("/tuning'") && !route.startsWith("/notes'"))) {
      expect(route.slice(0, 200)).toContain('labRequestRefusal(req.method, req.headers)');
    }
    // tuning and notes go through jsonFileRoute, which refuses first.
    const fileRoute = viteConfig.slice(viteConfig.indexOf('function jsonFileRoute'));
    expect(fileRoute.slice(0, fileRoute.indexOf('const path = file()'))).toContain('labRequestRefusal(req.method, req.headers)');
    expect(viteConfig).toContain("jsonFileRoute(() => path, 'overrides'");
    expect(viteConfig).toMatch(/const route = jsonFileRoute\(/);
  });

  it('passes the string checker only parsed cast names, and reads the body under the size cap', () => {
    const route = viteConfig.slice(viteConfig.indexOf("server.middlewares.use('/__lab/string-checks'"));
    const handler = route.slice(0, route.indexOf('\n      });\n'));
    expect(handler).toContain('readJson(req)');
    expect(handler).toContain('parseStringChecks(body)');
    expect(handler).toContain("['--cast', ...parsed.cast]");
    expect(handler).not.toContain('JSON.parse(');
    expect(handler).toContain('rmSync(dir');
  });
});
