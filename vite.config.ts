import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/** Dev only: the Scenario Lab (/story.html) posts a call's strings here and gets the swat-call-prose
 * checker's own output back, so the lab never carries a second copy of the house rules. */
function labStringChecks(): Plugin {
  const checker = resolve(ROOT, '.agents/skills/swat-call-prose/scripts/game_string_checks.py');
  const lint = resolve(ROOT, 'src/gen/incident/gates/prose-lint.ts');
  return {
    name: 'lab-string-checks',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__lab/string-checks', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { tsv, cast } = JSON.parse(body) as { tsv: string; cast: string[] };
            const path = join(mkdtempSync(join(tmpdir(), 'ti-lab-')), 'call.tsv');
            writeFileSync(path, tsv);
            execFile('python3', [checker, path, '--lint-source', lint, ...(cast.length ? ['--cast', ...cast] : [])], { encoding: 'utf8', maxBuffer: 1 << 24 }, (error, stdout, stderr) => {
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ code: error && typeof error.code === 'number' ? error.code : 0, stdout, stderr }));
            });
          } catch (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ code: -1, stdout: '', stderr: String(error) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), labStringChecks()],
  // Preview tooling assigns a free port through PORT; plain `npm run dev` keeps 5173.
  server: { port: Number(process.env.PORT) || 5173, strictPort: !!process.env.PORT },
  build: {
    rollupOptions: { input: { app: 'index.html', harness: 'harness.html', locations: 'locations.html', story: 'story.html' } },
  },
  // Geometry/route sweeps are CPU-heavy. Bound concurrency so ordinary 5s tests
  // don't time out merely because another file is exploring hundreds of layouts.
  test: { environment: 'node', include: ['src/**/*.test.ts'], maxWorkers: 2 },
});
