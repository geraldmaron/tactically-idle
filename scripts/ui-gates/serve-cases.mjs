// Subprocess helper for src/ui/ui-gates-serve.test.ts: serve.mjs's cleanup is about a process's own exit, so each
// case runs `body` (module code with `serve` and `root` in scope) in a child node process whose TMPDIR is a
// directory of its own. Its cache directories are the only ones there, whatever else runs on the machine.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Runs `body`; `inspect(tmp)` runs after the subprocess ends, before its TMPDIR is removed. */
export function runServeCase(body, inspect = () => ({})) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'ti-serve-case-'));
  try {
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', `
import { serve } from ${JSON.stringify(path.join(ROOT, 'scripts/ui-gates/serve.mjs'))};
const root = ${JSON.stringify(ROOT)};
${body}`], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, env: { ...process.env, TMPDIR: tmp } });
    return { stdout: run.stdout, status: run.status, signal: run.signal, error: run.error ? String(run.error) : null, ...inspect(tmp) };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

export const caches = (tmp) => readdirSync(tmp).filter((name) => name.startsWith('ti-gate-vite-'));

/** True while a process whose command line holds `needle` is alive. */
export const alive = (needle) => spawnSync('pgrep', ['-f', needle]).status === 0;

/** Polls `check` for up to `ms`. */
export async function settles(check, ms = 10_000) {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 200))) if (check()) return true;
  return check();
}
