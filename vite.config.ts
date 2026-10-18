import { defineConfig } from 'vite';
import type { Connect, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_APP_ID, gameAppLoaderCode } from './src/dev/game-app-loader.ts';
import { labRequestRefusal, parseStringChecks } from './src/dev/lab-endpoint-guard.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/** Dev only: the Scenario Lab (/lab) posts a call's strings here and gets the swat-call-prose
 * checker's own output back, so the lab never carries a second copy of the house rules. Every
 * /__lab route answers only the lab's own page (labRequestRefusal), and cast names that could read
 * as checker options are refused (parseStringChecks). */
function labStringChecks(): Plugin {
  const checker = resolve(ROOT, '.agents/skills/swat-call-prose/scripts/game_string_checks.py');
  const lint = resolve(ROOT, 'src/gen/incident/gates/prose-lint.ts');
  return {
    name: 'lab-string-checks',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__lab/string-checks', (req, res) => {
        const refusal = labRequestRefusal(req.method, req.headers);
        if (refusal) { sendJson(res, 403, { code: -1, stdout: '', stderr: refusal }); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        readJson(req).then(body => {
          const parsed = parseStringChecks(body);
          if ('problem' in parsed) { sendJson(res, 400, { code: -1, stdout: '', stderr: parsed.problem }); return; }
          const dir = mkdtempSync(join(tmpdir(), 'ti-lab-'));
          const path = join(dir, 'call.tsv');
          writeFileSync(path, parsed.tsv);
          execFile('python3', [checker, path, '--lint-source', lint, ...(parsed.cast.length ? ['--cast', ...parsed.cast] : [])], { encoding: 'utf8', maxBuffer: 1 << 24 }, (error, stdout, stderr) => {
            rmSync(dir, { recursive: true, force: true });
            sendJson(res, 200, { code: error && typeof error.code === 'number' ? error.code : 0, stdout, stderr });
          });
        }, error => sendJson(res, 400, { code: -1, stdout: '', stderr: String(error) }));
      });
    },
  };
}

/** Dev only: the retired story sheet's links (`/story.html?…`) land on the lab with the same query.
 * Registered straight on the middleware stack, so it answers before Vite's HTML handling. */
function labRedirects(): Plugin {
  return {
    name: 'lab-redirects',
    apply: 'serve',
    configureServer(server) {
      const base = server.config.base.endsWith('/') ? server.config.base : `${server.config.base}/`;
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const query = url.indexOf('?');
        const path = query < 0 ? url : url.slice(0, query);
        if (req.method !== 'GET' && req.method !== 'HEAD') { next(); return; }
        if (path !== `${base}story.html` && path !== '/story.html') { next(); return; }
        res.statusCode = 302;
        res.setHeader('location', `${base}lab${query < 0 ? '' : url.slice(query)}`);
        res.end();
      });
    },
  };
}

const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');
const readText = (path: string): string | null => existsSync(path) ? readFileSync(path, 'utf8') : null;

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(value));
}

/** A JSON request body, refused past 1 MB so a stray post can't fill memory. */
function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((done, fail) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1 << 20) { fail(new Error('Body over 1 MB')); req.destroy(); }
    });
    req.on('end', () => {
      try { done(JSON.parse(body)); } catch (error) { fail(error); }
    });
    req.on('error', fail);
  });
}

const isPlain = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Why a tuning overrides object can't be written, or null: an object of tables, each an object
 * whose leaves are numbers, booleans, strings or number arrays. The lab and tuning-tables.test.ts
 * check it against the registry; the server never loads the sim. */
function overridesProblem(value: unknown): string | null {
  if (!isPlain(value)) return 'overrides must be an object of tables';
  const leaf = (node: unknown, path: string): string | null => {
    if (typeof node === 'number') return Number.isFinite(node) ? null : `${path} is not a finite number`;
    if (typeof node === 'boolean' || typeof node === 'string') return null;
    if (Array.isArray(node)) return node.every(item => typeof item === 'number' && Number.isFinite(item)) ? null : `${path} must be a number array`;
    if (!isPlain(node)) return `${path} has an unsupported value`;
    for (const [key, child] of Object.entries(node)) {
      if (FORBIDDEN_KEYS.has(key)) return `${path}.${key} is not allowed`;
      const problem = leaf(child, `${path}.${key}`);
      if (problem) return problem;
    }
    return null;
  };
  for (const [table, fields] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(table)) return `${table} is not allowed`;
    if (!isPlain(fields)) return `${table} must be an object`;
    const problem = leaf(fields, table);
    if (problem) return problem;
  }
  return null;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (!isPlain(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeysDeep(value[key])]));
}

/** A JSON file the lab reads and rewrites: GET answers `{ json, hash }` (both null when the file
 * doesn't exist yet); POST `{ <field>, baseHash }` writes only when the file still hashes to
 * `baseHash`, else 409 `{ error: 'changed', hash }`. The hash is SHA-1 of the file text. */
function jsonFileRoute(file: () => string | null, field: string, encode: (value: unknown) => string | { problem: string }): Connect.NextHandleFunction {
  return (req, res) => {
    const refusal = labRequestRefusal(req.method, req.headers);
    if (refusal) { sendJson(res, 403, { error: refusal }); return; }
    const path = file();
    if (!path) { sendJson(res, 400, { error: 'unknown file' }); return; }
    if (req.method === 'GET') {
      const text = readText(path);
      try {
        sendJson(res, 200, text === null ? { json: null, hash: null } : { json: JSON.parse(text), hash: sha1(text) });
      } catch (error) {
        sendJson(res, 500, { error: `The file isn't valid JSON: ${String(error)}`, hash: text === null ? null : sha1(text) });
      }
      return;
    }
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    readJson(req).then(body => {
      if (!isPlain(body)) { sendJson(res, 400, { error: 'body must be an object' }); return; }
      const text = readText(path);
      const hash = text === null ? null : sha1(text);
      if ((body.baseHash ?? null) !== hash) { sendJson(res, 409, { error: 'changed', hash }); return; }
      const encoded = encode(body[field]);
      if (typeof encoded !== 'string') { sendJson(res, 400, { error: encoded.problem }); return; }
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, encoded);
      sendJson(res, 200, { ok: true, hash: sha1(encoded), bytes: Buffer.byteLength(encoded) });
    }, error => sendJson(res, 400, { error: String(error) }));
  };
}

/** Dev only: `GET /__lab/ping` tells the lab the dev endpoints exist, and whether python3 (needed by
 * the string checks) is on the PATH. Answers `{ ok: true, python }`. */
function labPing(): Plugin {
  let python: Promise<boolean> | null = null;
  return {
    name: 'lab-ping',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__lab/ping', (req, res) => {
        const refusal = labRequestRefusal(req.method, req.headers);
        if (refusal) { sendJson(res, 403, { error: refusal }); return; }
        if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
        python ??= new Promise(done => execFile('python3', ['--version'], error => done(!error)));
        python.then(found => sendJson(res, 200, { ok: true, python: found }));
      });
    },
  };
}

/** Dev only: the lab's Tuning surface reads and saves `src/sim/tuning.json` (section 7.2 of the lab
 * spec). POST `{ overrides, baseHash }` writes the overrides with sorted keys; Vite then reloads the
 * page because the file is in the module graph. */
function labTuning(): Plugin {
  const path = resolve(ROOT, 'src/sim/tuning.json');
  return {
    name: 'lab-tuning',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__lab/tuning', jsonFileRoute(() => path, 'overrides', overrides => {
        const problem = overridesProblem(overrides);
        return problem ? { problem } : `${JSON.stringify(sortKeysDeep(overrides), null, 2)}\n`;
      }));
    },
  };
}

/** Dev only: review notes per call type in `docs/calls/notes/<type>.json`, shared with the review
 * skills. `GET` or `POST /__lab/notes/<type>` (or `/__lab/notes?type=<type>`); POST sends
 * `{ file, baseHash }` with `baseHash` null for a file that doesn't exist yet. */
function labNotes(): Plugin {
  const dir = resolve(ROOT, 'docs/calls/notes');
  return {
    name: 'lab-notes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__lab/notes', (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://lab.local');
        const type = url.pathname.replace(/^\/+|\/+$/g, '') || url.searchParams.get('type') || '';
        const route = jsonFileRoute(() => /^[a-z][a-z0-9_]*$/.test(type) ? join(dir, `${type}.json`) : null, 'file', file => {
          if (!isPlain(file) || !Array.isArray(file.notes)) return { problem: 'file must be a notes object with a notes list' };
          return `${JSON.stringify(file, null, 2)}\n`;
        });
        route(req, res, next);
      });
    },
  };
}

/** `virtual:game-app` (src/dev/game-app-loader.ts): src/main.tsx loads the game's App through it,
 * statically in a plain build (so index.html preloads the game) and lazily in dev and `build:lab`. */
function gameAppLoader(): Plugin {
  let lazy = true;
  return {
    name: 'game-app-loader',
    configResolved(config) { lazy = config.command === 'serve' || process.env.VITE_LAB === '1'; },
    resolveId: source => (source === GAME_APP_ID ? `\0${GAME_APP_ID}` : null),
    load: id => (id === `\0${GAME_APP_ID}` ? gameAppLoaderCode(lazy) : null),
  };
}

export default defineConfig({
  plugins: [react(), gameAppLoader(), labRedirects(), labPing(), labTuning(), labNotes(), labStringChecks()],
  // A normal build folds the lab branch in src/main.tsx away; `npm run build:lab` keeps it (`?lab`).
  define: { __LAB_BUILD__: JSON.stringify(process.env.VITE_LAB === '1') },
  // Preview tooling assigns a free port through PORT; plain `npm run dev` keeps 5173.
  server: { port: Number(process.env.PORT) || 5173, strictPort: !!process.env.PORT },
  build: {
    rollupOptions: { input: { app: 'index.html', harness: 'harness.html', locations: 'locations.html' } },
  },
  // Geometry/route sweeps are CPU-heavy. Bound concurrency so ordinary 5s tests
  // don't time out merely because another file is exploring hundreds of layouts.
  test: { setupFiles: ['src/sim/fixtures/setup.ts'], environment: 'node', include: ['src/**/*.test.ts'], maxWorkers: 2 },
});
