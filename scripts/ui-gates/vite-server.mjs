// Runs this worktree's Vite dev server for the rendered gates. Started by serve.mjs, never by hand:
//   node scripts/ui-gates/vite-server.mjs <root> <port> <cacheDir>
// It uses Vite's API so the dependency cache can sit in a directory of the gate's own. The CLI has no flag
// for that, and `<root>/node_modules/.vite` is not the gate's to use: it is shared with any dev server in the
// worktree, and when node_modules is a dangling symlink it cannot be written at all (see serve.mjs).
// It exits, removing the cache, when its stdin closes (the parent is gone) or on SIGTERM (the parent stopped it).
import { rmSync } from 'node:fs';
import { createServer } from 'vite';

const [root, port, cacheDir] = process.argv.slice(2);
const server = await createServer({ root, cacheDir, server: { port: Number(port), strictPort: true } });
await server.listen();

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  await server.close().catch(() => {});
  rmSync(cacheDir, { recursive: true, force: true });
  process.exit(0);
};
process.stdin.on('end', shutdown).on('close', shutdown).on('error', shutdown).resume();
process.on('SIGTERM', shutdown);
