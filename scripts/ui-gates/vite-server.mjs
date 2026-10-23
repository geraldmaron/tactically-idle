// Runs this worktree's Vite dev server for the rendered gates. Started by serve.mjs, never by hand:
//   node scripts/ui-gates/vite-server.mjs <root> <port> <cacheDir>
// It uses Vite's API so the dependency cache can sit in a directory of the gate's own. The CLI has no flag
// for that, and `<root>/node_modules/.vite` is not the gate's to use: it is shared with any dev server in the
// worktree, and when node_modules is a dangling symlink it cannot be written at all (see serve.mjs).
// It ends, with its cache removed, when its stdin closes (the parent is gone), on SIGTERM (the parent stopped it)
// and on SIGINT (Ctrl-C reaches the whole process group). Vite registers its own stdin and SIGTERM listeners that
// call process.exit, so the removal sits on the synchronous `exit` event, registered before Vite starts.
import { rmSync } from 'node:fs';
import { createServer } from 'vite';

const [root, port, cacheDir] = process.argv.slice(2);
process.on('exit', () => rmSync(cacheDir, { recursive: true, force: true }));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));
process.stdin.on('end', () => process.exit(0)).on('close', () => process.exit(0)).on('error', () => process.exit(0)).resume();

const server = await createServer({ root, cacheDir, server: { port: Number(port), strictPort: true } });
await server.listen();
