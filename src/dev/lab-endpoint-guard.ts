// Request checks for the dev server's /__lab endpoints (vite.config.ts). Those endpoints rewrite
// src/sim/tuning.json and docs/calls/notes/*.json and run the swat-call-prose checker, so they serve
// the lab's own page and nothing else. Free of node imports so vitest checks it in the same node
// environment as the rest of src/; nothing in the game or the lab imports this file.

type Headers = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Why a /__lab request is refused (the server answers 403), or null to serve it.
 *
 * - Origin, when sent, must be this server's own. Vite's default CORS lets any localhost page on any
 *   port read and post here, and a simple cross-site POST needs no preflight at all.
 * - Sec-Fetch-Site, when sent, must be same-origin (or none for a read typed into the address bar).
 * - A write must say it is JSON, which no preflight-free request can. */
export function labRequestRefusal(method: string | undefined, headers: Headers): string | null {
  const read = method === 'GET' || method === 'HEAD';
  const origin = first(headers.origin);
  const host = first(headers.host);
  if (origin !== undefined && !(host && (origin === `http://${host}` || origin === `https://${host}`))) {
    return `Refused a request from another origin (${origin}).`;
  }
  const site = first(headers['sec-fetch-site']);
  if (site !== undefined && site !== 'same-origin' && !(read && site === 'none')) return `Refused a ${site} request.`;
  if (!read && !(first(headers['content-type']) ?? '').toLowerCase().startsWith('application/json')) {
    return 'Refused a write that is not application/json.';
  }
  return null;
}

const MAX_CAST = 256;
/** A cast word as castWords (src/dev/lab/model/script.ts) emits it: a first name, surname or place
 * word. No leading dash or space, so python's argparse can never read one as an option. */
const CAST_WORD = /^[^\s-][^\0-\x1f\x7f]{0,63}$/u;

/** The `POST /__lab/string-checks` body, or why it can't be run. Every cast entry goes into the
 * checker's argv after `--cast`, so an entry like `--write-txt` would add an option that writes
 * any file the caller names; those are refused here. */
export function parseStringChecks(body: unknown): { tsv: string; cast: string[] } | { problem: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { problem: 'body must be an object' };
  const { tsv, cast } = body as { tsv?: unknown; cast?: unknown };
  if (typeof tsv !== 'string') return { problem: 'tsv must be a string' };
  const names = cast ?? [];
  if (!Array.isArray(names) || names.length > MAX_CAST) return { problem: `cast must be a list of at most ${MAX_CAST} names` };
  for (const name of names) {
    if (typeof name !== 'string' || !CAST_WORD.test(name)) return { problem: `cast name ${JSON.stringify(name)} is not a name` };
  }
  return { tsv, cast: names as string[] };
}
