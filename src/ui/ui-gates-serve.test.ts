// The gate's own dev server (scripts/ui-gates/serve.mjs) cleans up after itself and leaves signal handling to
// its caller. Each case runs in a subprocess, because the property is about a process's own exit.
import { describe, expect, it } from 'vitest';
import { gateCaches, runServeCase } from '../../scripts/ui-gates/serve-cases.mjs';

const lastLine = (text: string) => text.trim().split('\n').pop() ?? '';

describe('ui gates: the gate server', () => {
  it('serves the app, and a double stop removes its cache directory once', () => {
    const before = gateCaches().length;
    const out = runServeCase(`
      const server = await serve({ root });
      const ok = (await fetch(server.url)).ok;
      server.stop(); server.stop();
      console.log(JSON.stringify({ ok }));`);
    expect(JSON.parse(lastLine(out.stdout))).toEqual({ ok: true });
    expect(gateCaches().length).toBe(before);
  }, 40_000);

  it("on SIGTERM cleans up and still lets the caller's own handler decide the exit", () => {
    const before = gateCaches().length;
    const out = runServeCase(`
      await serve({ root });
      process.on('SIGTERM', () => { console.log('caller handler ran'); process.exit(7); });
      process.kill(process.pid, 'SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 5000));`);
    expect(out.stdout).toContain('caller handler ran');
    expect(out.status).toBe(7);
    expect(gateCaches().length).toBe(before);
  }, 40_000);

  it('after stop() it no longer owns signals or the exit hook', () => {
    const out = runServeCase(`
      const server = await serve({ root });
      server.stop();
      console.log(JSON.stringify({ int: process.listenerCount('SIGINT'), term: process.listenerCount('SIGTERM'), exit: process.listenerCount('exit') }));`);
    expect(JSON.parse(lastLine(out.stdout))).toEqual({ int: 0, term: 0, exit: 0 });
  }, 40_000);

  it('with no caller handler, SIGTERM still ends the process by the signal after cleaning up', () => {
    const before = gateCaches().length;
    const out = runServeCase(`
      await serve({ root });
      process.kill(process.pid, 'SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      console.log('survived');`);
    expect(out.stdout).not.toContain('survived');
    expect(out.status).toBeNull();
    expect(gateCaches().length).toBe(before);
  }, 40_000);
});
