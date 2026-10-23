// The dev server the rendered gates walk. Shared by check-ui.mjs (check:ui, ui:baseline) and check-feel.mjs.
//
//   no URL given   start this worktree's own Vite dev server on a free port and stop it afterwards. It never
//                  reuses a server already running, so a bare run cannot score another checkout's code.
//   a baseURL, or UI_GATES_URL
//                  reuse that server only after proving it serves THIS worktree: the code files under src/ui
//                  and src/sim (tracked or untracked, tests excluded) are fetched from it with
//                  Vite's ?raw and compared byte for byte with the files on disk. Any difference refuses the run
//                  and names the files, so a server on another checkout or another commit is turned away.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';

async function reachable(url) { try { return (await fetch(url)).ok; } catch { return false; } }

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
  });
}

const isCode = (file) => /^src\/(ui|sim)\/.*\.(tsx?|css)$/.test(file) && !/\.test\.tsx?$/.test(file);

/** The files a served tree must match: tracked and untracked code under src/ui and src/sim. */
function markerFiles(root) {
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const listed = [...git('ls-files'), ...git('ls-files', '--others', '--exclude-standard')];
  return listed.filter(isCode).filter((f, i, all) => all.indexOf(f) === i);
}

/** The text Vite serves for `?raw`: `export default "<json string>"`. */
async function servedText(base, file) {
  const res = await fetch(new URL(`${file}?raw`, base));
  if (!res.ok) return null;
  const body = await res.text();
  const start = body.indexOf('export default ');
  if (start < 0) return null;
  try { return JSON.parse(body.slice(start + 'export default '.length).replace(/;\s*$/, '')); } catch { return null; }
}

/** Throws when the server at `url` does not serve the files of the worktree at `root`. */
export async function assertServesTree(url, root) {
  if (!(await reachable(url))) throw new Error(`no dev server answers at ${url}`);
  const files = markerFiles(root);
  const differ = [];
  for (let i = 0; i < files.length; i += 16) {
    await Promise.all(files.slice(i, i + 16).map(async (file) => {
      const served = await servedText(url, file);
      if (served !== readFileSync(path.join(root, file), 'utf8')) differ.push(file);
    }));
  }
  if (differ.length) {
    throw new Error(`the server at ${url} does not serve this worktree (${root}); ${differ.length} of ${files.length} marker files differ, for example ${differ.sort().slice(0, 3).join(', ')}.\n`
      + 'Stop it, or run without a URL and the gate starts its own server on a free port.');
  }
}

/** @returns {Promise<{ url: string, stop: () => void }>} */
export async function serve({ root, given }) {
  const explicit = given ?? process.env.UI_GATES_URL;
  if (explicit) {
    await assertServesTree(explicit, root);
    return { url: explicit, stop: () => {} };
  }
  const port = await freePort();
  const url = `http://localhost:${port}/`;
  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore', detached: false });
  for (let i = 0; i < 60 && !(await reachable(url)); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await reachable(url))) { child.kill(); throw new Error(`could not start a dev server on port ${port}`); }
  return { url, stop: () => child.kill() };
}
