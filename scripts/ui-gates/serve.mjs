// The dev server the rendered gates walk: the URL given, the server already on port 5174, or one started
// here and stopped by the caller. Shared by check-ui.mjs and check-feel.mjs.
import { spawn } from 'node:child_process';

const PORT = 5174;

async function reachable(url) { try { return (await fetch(url)).ok; } catch { return false; } }

/** @returns {Promise<{ url: string, stop: () => void }>} */
export async function serve({ root, given }) {
  const explicit = given ?? process.env.UI_GATES_URL;
  if (explicit) return { url: explicit, stop: () => {} };
  const url = `http://localhost:${PORT}/`;
  if (await reachable(url)) return { url, stop: () => {} };
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', detached: false });
  for (let i = 0; i < 60 && !(await reachable(url)); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await reachable(url))) { child.kill(); throw new Error(`could not start a dev server on port ${PORT}`); }
  return { url, stop: () => child.kill() };
}
