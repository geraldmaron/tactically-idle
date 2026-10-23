// Subprocess helpers for src/ui/ui-gates-serve.test.ts: serve.mjs's cleanup is about a process's own exit, so each
// case runs `body` (module code with `serve` in scope) in a child node process.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const root = ROOT;
export const gateCaches = () => readdirSync(tmpdir()).filter((name) => name.startsWith('ti-gate-vite-'));

/** @returns {{ stdout: string, status: number | null }} */
export function runServeCase(body) {
  const { stdout, status } = spawnSync(process.execPath, ['--input-type=module', '-e', `
import { serve } from ${JSON.stringify(path.join(ROOT, 'scripts/ui-gates/serve.mjs'))};
const root = ${JSON.stringify(ROOT)};
${body}`], { cwd: ROOT, encoding: 'utf8', timeout: 30_000 });
  return { stdout, status };
}
