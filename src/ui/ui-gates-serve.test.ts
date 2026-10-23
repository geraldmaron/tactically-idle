// The gate's own dev server (scripts/ui-gates/serve.mjs) serves from a private dependency cache and removes it, and
// its Vite does not outlive the process that started it. Each case runs in a subprocess with a TMPDIR of its own,
// because the property is about a process's own exit and other gate runs may be using the machine's temp directory.
import { describe, expect, it } from 'vitest';
import { alive, caches, runServeCase, settles } from '../../scripts/ui-gates/serve-cases.mjs';

const lastLine = (text: string) => text.trim().split('\n').pop() ?? '';

describe('ui gates: the gate server', () => {
  it('serves the app from a cache of its own, and a double stop removes that cache', () => {
    const run = runServeCase(`
      const server = await serve({ root });
      const ok = (await fetch(server.url)).ok;
      server.stop(); server.stop();
      console.log(JSON.stringify({ ok }));`, (tmp) => ({ left: caches(tmp) }));
    expect(run.error).toBeNull();
    expect(JSON.parse(lastLine(run.stdout))).toEqual({ ok: true });
    expect(run.left).toEqual([]);
  }, 70_000);

  it('installs no signal handler, so the caller keeps its own', () => {
    const run = runServeCase(`
      const before = { int: process.listenerCount('SIGINT'), term: process.listenerCount('SIGTERM') };
      const server = await serve({ root });
      const during = { int: process.listenerCount('SIGINT'), term: process.listenerCount('SIGTERM') };
      server.stop();
      console.log(JSON.stringify({ before, during, exit: process.listenerCount('exit') }));`);
    const seen = JSON.parse(lastLine(run.stdout));
    expect(seen.during).toEqual(seen.before);
    expect(seen.exit).toBe(0);
  }, 70_000);

  it('a parent killed outright (SIGKILL) does not leave Vite running or its cache behind', async () => {
    let marker = '';
    const run = runServeCase(`
      const { spawnSync } = await import('node:child_process');
      await serve({ root });
      console.log('detectable ' + (spawnSync('pgrep', ['-f', process.env.TMPDIR]).status === 0));
      process.kill(process.pid, 'SIGKILL');
      await new Promise((resolve) => setTimeout(resolve, 20000));`, (tmp) => { marker = tmp; return {}; });
    expect(run.error).toBeNull();
    // While it runs, the check below can see the server: the check is not blind.
    expect(run.stdout).toContain('detectable true');
    expect(run.signal).toBe('SIGKILL');
    // The subprocess's TMPDIR path is on its Vite's command line, so it identifies that server and no other.
    expect(await settles(() => !alive(marker))).toBe(true);
  }, 90_000);
});
