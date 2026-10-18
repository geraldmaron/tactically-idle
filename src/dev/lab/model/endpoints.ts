// The lab's client for the dev-only endpoints in vite.config.ts (`apply: 'serve'`): ping, tuning,
// notes and string checks. Every call degrades: a static lab build (import.meta.env.DEV false) never
// sends a request at all, and a dev server that doesn't answer reads as "unavailable", not an error.
import { useEffect, useSyncExternalStore } from 'react';
import type { IncidentType } from '../../../sim/scenario-types';
import type { TuningPatch } from '../../../sim/tuning';
import type { NotesFile, ReviewNote } from '../types';

export interface DevServer { available: boolean | null; staticBuild: boolean; python: boolean | null }

const DEV = import.meta.env.DEV;
const ENDPOINT = '/__lab';

// ---------------------------------------------------------------- dev server status

let status: DevServer = { available: DEV ? null : false, staticBuild: !DEV, python: null };
let pinging: Promise<void> | null = null;
const listeners = new Set<() => void>();
const setStatus = (next: DevServer) => { status = next; for (const listener of listeners) listener(); };

/** Asks `GET /__lab/ping` again (the first useDevServer asks once on its own). */
export function recheckDevServer(): Promise<void> {
  if (!DEV) return Promise.resolve();
  pinging = fetch(`${ENDPOINT}/ping`, { cache: 'no-store' })
    .then(response => response.ok ? response.json() as Promise<{ ok?: boolean; python?: unknown }> : Promise.reject(new Error(String(response.status))))
    .then(body => setStatus({ available: body.ok === true, staticBuild: false, python: typeof body.python === 'boolean' ? body.python : null }),
      () => setStatus({ available: false, staticBuild: false, python: null }));
  return pinging;
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Whether the dev endpoints answer: null while the first ping is out; always false (and never asked)
 * in a static build. */
export function useDevServer(): DevServer {
  const value = useSyncExternalStore(subscribe, () => status, () => status);
  useEffect(() => { if (DEV && !pinging) void recheckDevServer(); }, []);
  return value;
}

// ---------------------------------------------------------------- requests

type Answer = { status: number; body: Record<string, unknown> } | null;

/** A JSON request, or null when the dev server can't be reached. */
async function request(path: string, init?: { method: 'POST'; body: unknown }): Promise<Answer> {
  try {
    const response = await fetch(`${ENDPOINT}${path}`, init
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body), cache: 'no-store' }
      : { cache: 'no-store' });
    // Vite's SPA fallback answers an unknown path with index.html: no endpoint there.
    if ((response.headers.get('content-type') ?? '').includes('text/html')) return null;
    const body: unknown = await response.json();
    return body && typeof body === 'object' ? { status: response.status, body: body as Record<string, unknown> } : null;
  } catch {
    return null;
  }
}

const problem = (answer: { body: Record<string, unknown> }, fallback: string) => typeof answer.body.error === 'string' ? answer.body.error : fallback;

// ---------------------------------------------------------------- tuning

/** The committed `src/sim/tuning.json` and its SHA-1 (the base hash a save must match). Throws when
 * the file on disk isn't valid JSON. */
export async function getTuningFile(): Promise<{ json: TuningPatch; hash: string } | { unavailable: true }> {
  if (!DEV) return { unavailable: true };
  const answer = await request('/tuning');
  if (!answer) return { unavailable: true };
  if (answer.status !== 200) throw new Error(problem(answer, `Reading tuning.json failed (${answer.status})`));
  return { json: (answer.body.json ?? {}) as TuningPatch, hash: typeof answer.body.hash === 'string' ? answer.body.hash : '' };
}

export async function saveTuningFile(overrides: TuningPatch, baseHash: string):
  Promise<{ ok: true; hash: string } | { conflict: true; hash: string } | { error: string } | { unavailable: true }> {
  if (!DEV) return { unavailable: true };
  const answer = await request('/tuning', { method: 'POST', body: { overrides, baseHash: baseHash || null } });
  if (!answer) return { unavailable: true };
  if (answer.status === 409) return { conflict: true, hash: String(answer.body.hash ?? '') };
  if (answer.status !== 200 || answer.body.ok !== true) return { error: problem(answer, `Saving tuning.json failed (${answer.status})`) };
  return { ok: true, hash: String(answer.body.hash) };
}

// ---------------------------------------------------------------- notes

export const notesStorageKey = (type: IncidentType) => `ti-lab-notes:${type}`;
export const emptyNotes = (type: IncidentType): NotesFile => ({ v: 1, type, verdict: null, notes: [] });

/** What the old lab kept under the same key: a list of field notes. */
interface OldNote { where: string; verdict: 'approve' | 'edit' | 'reject'; owner: 'design' | 'prose' | 'engine'; note: string; at: string }
const OLD_SEVERITY: Record<OldNote['verdict'], ReviewNote['severity']> = { reject: 'block', edit: 'fix', approve: 'note' };
const OLD_ROUTE: Record<OldNote['owner'], ReviewNote['route']> = { design: 'swat-call-design', prose: 'swat-call-prose', engine: 'engineering' };

/** The notes kept in this browser for a call type. A list left by the old lab is read as notes on
 * the strings it named (`string:<where>`), so nothing written there is lost. */
export function readLocalNotes(type: IncidentType): NotesFile {
  let stored: unknown = null;
  try { stored = JSON.parse(localStorage.getItem(notesStorageKey(type)) ?? 'null'); } catch { return emptyNotes(type); }
  if (Array.isArray(stored)) {
    const notes = (stored as OldNote[]).filter(note => note && typeof note.note === 'string').map((note, i): ReviewNote => ({
      id: `old-${i}`, type, anchor: note.where === 'call' ? 'call' : `string:${note.where}`,
      severity: OLD_SEVERITY[note.verdict] ?? 'note', rule: '', route: OLD_ROUTE[note.owner] ?? 'owner',
      sees: '', fix: '', text: note.note, at: Date.parse(note.at) || 0, draw: { situation: 0, call: 0 }, url: '', contentHash: '',
    }));
    return { ...emptyNotes(type), notes };
  }
  if (stored && typeof stored === 'object' && (stored as NotesFile).v === 1 && Array.isArray((stored as NotesFile).notes)) return { ...(stored as NotesFile), type };
  return emptyNotes(type);
}

function writeLocalNotes(type: IncidentType, file: NotesFile): boolean {
  try { localStorage.setItem(notesStorageKey(type), JSON.stringify(file)); return true; } catch { return false; }
}

/** Notes for a call type: `docs/calls/notes/<type>.json` through the dev server (shared), or this
 * browser's copy in a static build or when the dev server is down (not shared). Throws when the
 * file on disk isn't valid JSON, so a broken file is never silently replaced. */
export async function loadNotesFile(type: IncidentType): Promise<{ file: NotesFile; hash: string | null; shared: boolean }> {
  if (DEV) {
    const answer = await request(`/notes/${type}`);
    if (answer?.status === 200) {
      const json = answer.body.json as NotesFile | null;
      return { file: json && Array.isArray(json.notes) ? { ...json, type } : emptyNotes(type), hash: typeof answer.body.hash === 'string' ? answer.body.hash : null, shared: true };
    }
    if (answer) throw new Error(problem(answer, `Reading notes for ${type} failed (${answer.status})`));
  }
  return { file: readLocalNotes(type), hash: null, shared: false };
}

export async function saveNotesFile(type: IncidentType, file: NotesFile, baseHash: string | null):
  Promise<{ ok: true; hash: string | null; shared: boolean } | { conflict: true } | { error: string }> {
  if (!DEV) return writeLocalNotes(type, file) ? { ok: true, hash: null, shared: false } : { error: 'This browser blocks storage, so notes last only until the page closes.' };
  const answer = await request(`/notes/${type}`, { method: 'POST', body: { file, baseHash } });
  // No dev server to write the file: keep the notes in this browser rather than lose them.
  if (!answer) return writeLocalNotes(type, file) ? { ok: true, hash: null, shared: false } : { error: 'The dev server is not answering and this browser blocks storage, so the note was not saved. Start the server with npm run lab.' };
  if (answer.status === 409) return { conflict: true };
  if (answer.status !== 200 || answer.body.ok !== true) return { error: problem(answer, `Saving notes failed (${answer.status})`) };
  return { ok: true, hash: typeof answer.body.hash === 'string' ? answer.body.hash : null, shared: true };
}

// ---------------------------------------------------------------- string checks

/** The swat-call-prose checker's own output for these rows (`POST /__lab/string-checks`). */
export async function runStringChecks(tsv: string, cast: string[]): Promise<{ code: number; stdout: string; stderr: string } | { unavailable: true }> {
  if (!DEV) return { unavailable: true };
  const answer = await request('/string-checks', { method: 'POST', body: { tsv, cast } });
  if (!answer) return { unavailable: true };
  return { code: Number(answer.body.code ?? -1), stdout: String(answer.body.stdout ?? ''), stderr: String(answer.body.stderr ?? '') };
}
