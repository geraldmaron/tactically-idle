// Subprocess helpers for src/ui/ui-gates-serve.test.ts: serve.mjs's cleanup is about a process's own exit, so each
// case runs `body` (module code with `serve` and `root` in scope) in a child node process whose TMPDIR is a
// directory of its own. Its cache directories are the only ones there, whatever else runs on the machine.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const program = (body) => `
import { serve } from ${JSON.stringify(path.join(ROOT, 'scripts/ui-gates/serve.mjs'))};
const root = ${JSON.stringify(ROOT)};
${body}`;

/** A TMPDIR of the case's own. `cleanup` removes it; the case checks it first, so a leak is seen before it is swept. */
export function caseTmp() {
  const tmp = mkdtempSync(path.join(tmpdir(), 'ti-serve-case-'));
  return { tmp, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

/** Runs `body` to its end. */
export function runServeCase(body, tmp) {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', program(body)], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, env: { ...process.env, TMPDIR: tmp } });
  return { stdout: run.stdout, status: run.status, signal: run.signal, error: run.error ? String(run.error) : null };
}

/**
 * Starts `body` as the leader of its own process group, waits for it to print `ready`, then sends the group `signal`,
 * as a terminal's Ctrl-C does. Resolves when the leader has exited.
 */
export function runInGroup(body, tmp, signal) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', program(body)], { cwd: ROOT, env: { ...process.env, TMPDIR: tmp }, detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '', sent = false;
    const giveUp = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, 60_000);
    child.stdout.on('data', (chunk) => {
      out += chunk;
      if (!sent && out.includes('ready')) { sent = true; process.kill(-child.pid, signal); }
    });
    child.on('exit', (status, sig) => { clearTimeout(giveUp); resolve({ stdout: out, status, signal: sig, ready: sent }); });
  });
}

export const caches = (tmp) => readdirSync(tmp).filter((name) => name.startsWith('ti-gate-vite-'));

/** True while a process whose command line holds `needle` is alive. */
export const alive = (needle) => spawnSync('pgrep', ['-f', needle]).status === 0;

/** Polls `check` for up to `ms`. */
export async function settles(check, ms = 10_000) {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 200))) if (check()) return true;
  return check();
}
