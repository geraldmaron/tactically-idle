// The gate's own dev server (scripts/ui-gates/serve.mjs) serves from a private dependency cache, removes it, and its Vite
// does not outlive the process that started it. Each case runs in a subprocess with a TMPDIR of its own, checked before
// it is swept, because the property is about a process's own exit and other gate runs share the machine's temp directory.
import { afterEach, describe, expect, it } from 'vitest';
import { alive, caches, caseTmp, runInGroup, runServeCase, settles } from '../../scripts/ui-gates/serve-cases.mjs';

const lastLine = (text: string) => text.trim().split('\n').pop() ?? '';
const SERVE_AND_WAIT = `
  const { spawnSync } = await import('node:child_process');
  await serve({ root });
  console.log('detectable ' + (spawnSync('pgrep', ['-f', process.env.TMPDIR]).status === 0));
  console.log('ready');`;

let cleanups: (() => void)[] = [];
const fresh = () => { const made = caseTmp(); cleanups.push(made.cleanup); return made.tmp; };
afterEach(() => { cleanups.forEach((fn) => fn()); cleanups = []; });

/** The server is gone and so is its cache, checked before the case's TMPDIR is swept. */
const gone = async (tmp: string) => ({ stopped: await settles(() => !alive(tmp)), cache: await settles(() => caches(tmp).length === 0) });

describe('ui gates: the gate server', () => {
  it('serves the app from a cache of its own, and a double stop removes that cache', () => {
    const tmp = fresh();
    const run = runServeCase(`
      const server = await serve({ root });
      const ok = (await fetch(server.url)).ok;
      server.stop(); server.stop();
      console.log(JSON.stringify({ ok }));`, tmp);
    expect(run.error).toBeNull();
    expect(JSON.parse(lastLine(run.stdout))).toEqual({ ok: true });
    expect(caches(tmp)).toEqual([]);
  }, 70_000);

  it('installs no signal handler, so the caller keeps its own', () => {
    const run = runServeCase(`
      const before = { int: process.listenerCount('SIGINT'), term: process.listenerCount('SIGTERM') };
      const server = await serve({ root });
      const during = { int: process.listenerCount('SIGINT'), term: process.listenerCount('SIGTERM') };
      server.stop();
      console.log(JSON.stringify({ before, during, exit: process.listenerCount('exit') }));`, fresh());
    const seen = JSON.parse(lastLine(run.stdout));
    expect(seen.during).toEqual(seen.before);
    expect(seen.exit).toBe(0);
  }, 70_000);

  it('a parent killed outright (SIGKILL) leaves neither Vite nor its cache', async () => {
    const tmp = fresh();
    const run = runServeCase(`${SERVE_AND_WAIT}
      process.kill(process.pid, 'SIGKILL');
      await new Promise((resolve) => setTimeout(resolve, 20000));`, tmp);
    expect(run.error).toBeNull();
    // While it runs, the check below can see the server: the check is not blind.
    expect(run.stdout).toContain('detectable true');
    expect(run.signal).toBe('SIGKILL');
    expect(await gone(tmp)).toEqual({ stopped: true, cache: true });
  }, 90_000);

  it('Ctrl-C (SIGINT to the whole process group) leaves neither Vite nor its cache', async () => {
    const tmp = fresh();
    const run = await runInGroup(`${SERVE_AND_WAIT}
      await new Promise((resolve) => setTimeout(resolve, 30000));`, tmp, 'SIGINT');
    expect(run.ready).toBe(true);
    expect(run.stdout).toContain('detectable true');
    expect(run.signal).toBe('SIGINT');
    expect(await gone(tmp)).toEqual({ stopped: true, cache: true });
  }, 90_000);

  it('a stopped server leaves neither Vite nor its cache', async () => {
    const tmp = fresh();
    runServeCase(`
      const server = await serve({ root });
      server.stop();`, tmp);
    expect(await gone(tmp)).toEqual({ stopped: true, cache: true });
  }, 70_000);
});
