// The review drawer (spec 3.8): a note pinned to whatever is selected (a node, choice, band, ending,
// line, state key, tuning field or lint finding), its severity and the skill that owns the fix, the
// call's verdict, every note with its status against the text it was written on, and the export in
// the review skill's row shape. Saved to docs/calls/notes/<type>.json through the dev server, or kept
// in this browser when there is no dev server. Logic lives in model/notes.ts and ./labels.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import { lintTree } from '../../../../gen/incident/trees-v13/dependencies';
import { tuningLayers } from '../../../../sim/tuning';
import { useLab } from '../../context';
import { emptyNotes, notesStorageKey, readLocalNotes } from '../../model/endpoints';
import {
  anchorFor, anchorText, browserOnlyNotes, CALL_ANCHOR, contentHash, findingsMarkdown, mergeNotes, noteId, noteStatus, ROUTES, RULE_SUGGESTIONS, SEVERITY_HELP, SEVERITY_LABEL, STATUS_LABEL,
  VERDICT_HELP, withNote, withoutNote,
} from '../../model/notes';
import type { NoteStatus, Route, Severity } from '../../model/notes';
import { sessionBinder } from '../../model/session';
import type { NotesFile, ReviewNote, Selection, Surface } from '../../types';
import { parseSelection } from '../../url';
import { cx, Glyph, SegmentedControl, Toast } from '../../viz';
import { anchorLabel, anchorSees, callNames } from './labels';
import './review.css';

type Saved = { where: 'file' } | { where: 'browser' } | { where: 'unsaved'; why: string };

/** A tuning field's saved value as text (or its default), for notes on tuning fields. */
function fieldValue(path: string): string | null {
  const [table, ...rest] = path.split('.');
  const layers = tuningLayers();
  if (!layers.defaults[table]) return path;
  const read = (root: unknown) => rest.reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), root);
  const value = read(layers.saved[table]) ?? read(layers.defaults[table]);
  return value === undefined ? null : JSON.stringify(value);
}

/** Where a note's anchor is best looked at: lines on Script, keys and lint on Dependencies, tuning
 * fields on Tuning; anything else stays on the surface in view. */
function surfaceFor(sel: Selection, current: Surface): Surface {
  if (sel.kind === 'string') return 'script';
  if (sel.kind === 'key' || sel.kind === 'finding') return 'deps';
  if (sel.kind === 'field') return 'tuning';
  return current === 'calls' || current === 'tuning' || current === 'outcomes' ? 'play' : current;
}

const SEVERITY_RANK: Record<Severity, number> = { block: 0, fix: 1, note: 2, accepted: 3 };

const AGO = (at: number) => {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : new Date(at).toISOString().slice(0, 10);
};

export default function ReviewDrawer() {
  const { url } = useLab();
  if (!url.call) return <p className="lab-review-empty">Pick a call to see its notes.</p>;
  const template = INCIDENT_TEMPLATES[url.call.type];
  if (!template) return <p className="lab-review-empty">This call type has no call tree, so it has no review notes.</p>;
  return <Review template={template} />;
}

function Review({ template }: { template: IncidentTemplate }) {
  const { url, call, notes, navigate, dev, deps, notify } = useLab();
  const session = call.status === 'ready' ? call.session : null;
  const tree = template.tree;
  const names = useMemo(() => callNames(template, session ? sessionBinder(session) : null), [template, session]);
  const lint = useMemo(() => { try { return lintTree(template); } catch { return []; } }, [template]);

  const [toast, setToast] = useState<string | null>(null);
  // A copy kept here when the file can't take it (no dev server, or the file changed on disk).
  const [local, setLocal] = useState<{ type: string; file: NotesFile; saved: Saved } | null>(null);
  const held = local && local.type === template.type ? local : null;
  const file = held?.file ?? notes.file;
  const saved: Saved = held?.saved ?? (notes.shared ? { where: 'file' } : { where: 'browser' });

  const persist = async (next: NotesFile, done: string): Promise<boolean> => {
    const keepHere = () => {
      try { localStorage.setItem(notesStorageKey(template.type), JSON.stringify(next)); setLocal({ type: template.type, file: next, saved: { where: 'browser' } }); setToast(done); }
      catch { setLocal({ type: template.type, file: next, saved: { where: 'unsaved', why: 'This browser blocks storage, so the note lasts until the page closes.' } }); }
      return true;
    };
    // In dev with the server down, keep the note in this browser instead of failing.
    if (!dev.staticBuild && dev.available === false) return keepHere();
    // A page that read its notes from this browser (the server was down) has no file base: every
    // note it holds counts as its own in the merge, so none is dropped.
    const base = notes.shared ? notes.file : emptyNotes(template.type);
    const result = await notes.save(next);
    if (result === 'ok') { setLocal(null); setToast(done); return true; }
    if (result === 'conflict') {
      // The file changed on disk: read it again, lay this page's edits over it and save once more.
      const disk = await notes.reload();
      if (disk && await notes.save(mergeNotes(base, next, disk)) === 'ok') { setLocal(null); setToast(`${done} Merged with changes made elsewhere.`); return true; }
      setLocal({ type: template.type, file: next, saved: { where: 'unsaved', why: 'The notes file changed on disk while this page was saving. Reload the page to merge; your notes are still here.' } });
      return false;
    }
    setLocal({ type: template.type, file: next, saved: { where: 'unsaved', why: 'The note was not saved. Check the dev server (npm run lab).' } });
    return false;
  };

  // ------------------------------------------------ notes kept in this browser but not in the file
  // Saved here while the dev server was down, or left by the old lab: offered once the file answers.
  const [oldNotes, setOldNotes] = useState<ReviewNote[]>([]);
  useEffect(() => {
    if (!notes.shared) { setOldNotes([]); return; }
    setOldNotes(browserOnlyNotes(notes.file, readLocalNotes(template.type)));
  }, [template.type, notes.shared, notes.file]);
  const importOld = async () => {
    let next = file;
    // The old lab's notes get ids of their own; a note saved here keeps its id.
    for (const note of oldNotes) next = withNote(next, { ...note, id: note.id.startsWith('old-') ? noteId(note.at || Date.now()) : note.id });
    if (await persist(next, `Added ${oldNotes.length} ${oldNotes.length === 1 ? 'note' : 'notes'} kept in this browser to the notes file.`)) {
      try { localStorage.removeItem(notesStorageKey(template.type)); } catch { /* nothing to clear */ }
      setOldNotes([]);
    }
  };

  // ------------------------------------------------ composer
  const anchor = url.sel ? anchorFor(url.sel) : CALL_ANCHOR;
  const label = anchorLabel(anchor, names, tree, deps, lint);
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState<Exclude<Severity, 'accepted'>>('fix');
  const [route, setRoute] = useState<Route>('swat-call-prose');
  const [rule, setRule] = useState('');
  const [sees, setSees] = useState('');
  const [fix, setFix] = useState('');
  const [busy, setBusy] = useState(false);
  const seesFor = useRef('');
  useEffect(() => {
    // Prefill what the player reads at the anchor; keep the reader's own edit if they made one.
    const next = anchorSees(anchor, names, tree);
    const prefilled = seesFor.current;
    setSees(current => (current === prefilled ? next : current));
    seesFor.current = next;
  }, [anchor, names, tree]);

  const save = async () => {
    if (!text.trim() && !fix.trim()) return;
    setBusy(true);
    const at = Date.now();
    const authored = anchorText(anchor, { template, field: fieldValue }) ?? '';
    const note: ReviewNote = {
      id: noteId(at), type: template.type, anchor, severity, rule: rule.trim(), route, sees: sees.trim(), fix: fix.trim(), text: text.trim(), at,
      draw: { situation: session?.situation ?? (url.call?.variant ?? 0) as 0 | 1 | 2, call: session?.resolved.spec?.seed ?? url.call?.call ?? 0 },
      url: window.location.href, contentHash: contentHash(authored),
    };
    const ok = await persist(withNote(file, note), `Note saved on ${label}.`);
    setBusy(false);
    if (ok) { setText(''); setFix(''); setRule(''); }
  };

  // ------------------------------------------------ list
  const statusOf = useMemo(() => {
    const read = (a: string) => anchorText(a, { template, field: fieldValue });
    return (n: ReviewNote): NoteStatus => noteStatus(n, read);
  }, [template]);
  const list = [...file.notes].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.at - a.at);
  const counts = { block: 0, fix: 0, note: 0, accepted: 0 } as Record<Severity, number>;
  for (const n of file.notes) counts[n.severity]++;

  const go = (n: ReviewNote) => {
    const sel = parseSelection(n.anchor);
    if (!sel) return;
    navigate({ tab: surfaceFor(sel, url.tab), sel });
  };
  const remove = (n: ReviewNote) => { void persist(withoutNote(file, n.id), 'Note removed.'); };
  const setVerdict = (value: 'approve' | 'edit' | 'reject') => { void persist({ ...file, verdict: { value, at: Date.now() } }, `Verdict set to ${value}.`); };

  // ------------------------------------------------ export
  const [exported, setExported] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const exportNow = () => {
    setCopied(false);
    setExported(findingsMarkdown(file, tree.title, n => n.url || window.location.href));
  };
  const copy = async () => {
    if (!exported) return;
    try { await navigator.clipboard.writeText(exported); setCopied(true); } catch { setCopied(false); notify('The browser would not copy. Select the text and copy it by hand.'); }
  };

  const verdict = file.verdict?.value ?? null;
  return (
    <div className="lab-review">
      <section className="lab-review-verdict" aria-label="Call verdict">
        <div className="lab-review-row">
          <h3 className="lab-review-h">Call verdict</h3>
          <SegmentedControl label="Call verdict" size="small" value={verdict ?? ''} onChange={value => setVerdict(value as 'approve' | 'edit' | 'reject')}
            options={[{ value: 'approve', label: 'Approve', title: VERDICT_HELP.approve }, { value: 'edit', label: 'Edit', title: VERDICT_HELP.edit }, { value: 'reject', label: 'Reject', title: VERDICT_HELP.reject }]} />
        </div>
        <p className="lab-review-help">{verdict ? VERDICT_HELP[verdict] : 'Not set. The verdict goes in the pull request with the findings.'}</p>
      </section>

      {oldNotes.length > 0 && (
        <p className="lab-review-old">
          <Glyph name="info" size={13} />
          <span title="Saved in this browser while the dev server was down, or left by the old lab">{oldNotes.length} {oldNotes.length === 1 ? 'note' : 'notes'} kept in this browser {oldNotes.length === 1 ? 'is' : 'are'} not in the notes file.</span>
          <button type="button" className="lab-button lab-button-quiet" onClick={() => void importOld()}>Add {oldNotes.length === 1 ? 'it' : 'them'} to the notes file</button>
        </p>
      )}

      <section className="lab-review-compose" aria-label="New note">
        <p className="lab-review-on">
          <span className="lab-muted">Note on</span>
          <span className="lab-review-anchor" title={anchor}><Glyph name="note" size={13} />{label}</span>
        </p>
        <textarea className="lab-input lab-review-text" rows={3} data-autofocus value={text} onChange={event => setText(event.target.value)}
          placeholder={url.sel ? 'What is wrong here, in one or two sentences' : 'Select a choice, line or ending first, or write about the whole call'}
          onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void save(); } }} />
        <div className="lab-review-fields">
          <div className="lab-field">
            <span className="lab-field-label">Severity</span>
            <SegmentedControl label="Severity" size="small" value={severity} onChange={setSeverity}
              options={(['block', 'fix', 'note'] as const).map(value => ({ value, label: SEVERITY_LABEL[value], title: SEVERITY_HELP[value] }))} />
          </div>
          <div className="lab-field">
            <span className="lab-field-label">Fix belongs to</span>
            <SegmentedControl label="Fix belongs to" size="small" value={route} onChange={setRoute}
              options={ROUTES.map(entry => ({ value: entry.value, label: entry.label, title: entry.help }))} />
          </div>
          <label className="lab-field">
            <span className="lab-field-label">Rule (optional)</span>
            <input className="lab-input" list="lab-review-rules" value={rule} onChange={event => setRule(event.target.value)} placeholder="fake-choice 4, cold read, H7" />
            <datalist id="lab-review-rules">{RULE_SUGGESTIONS.map(entry => <option key={entry} value={entry} />)}</datalist>
          </label>
          <label className="lab-field">
            <span className="lab-field-label">The player reads</span>
            <textarea className="lab-input lab-review-sees" rows={2} value={sees} onChange={event => setSees(event.target.value)} />
          </label>
          <label className="lab-field">
            <span className="lab-field-label">Fix as data (the replacement text, optional)</span>
            <textarea className="lab-input lab-review-sees" rows={2} value={fix} onChange={event => setFix(event.target.value)} />
          </label>
        </div>
        <div className="lab-review-actions">
          <button type="button" className="lab-button lab-button-primary" onClick={() => void save()} disabled={busy || (!text.trim() && !fix.trim())}>Save note</button>
          <span className="lab-muted lab-review-hint">⌘ Enter saves</span>
        </div>
      </section>

      <section className="lab-review-list" aria-label="Notes on this call">
        <div className="lab-review-row">
          <h3 className="lab-review-h">Notes</h3>
          <span className="lab-review-counts">
            {(['block', 'fix', 'note', 'accepted'] as const).filter(s => counts[s]).map(s => <span key={s} className={`lab-review-count lab-rsev-${s}`}><i />{counts[s]} {SEVERITY_LABEL[s].toLowerCase()}</span>)}
          </span>
        </div>
        {list.length === 0 && <p className="lab-review-empty">No notes on this call yet. Select a choice, line or ending and press <kbd className="lab-kbd">N</kbd>.</p>}
        {list.map(n => {
          const status = statusOf(n);
          const sel = parseSelection(n.anchor);
          return (
            <article key={n.id} className={cx('lab-rnote', `lab-rsev-${n.severity}`, status !== 'current' && `lab-rnote-${status}`)}>
              <header className="lab-rnote-head">
                <span className="lab-rnote-sev"><i />{SEVERITY_LABEL[n.severity]}</span>
                {sel ? <button type="button" className="lab-rnote-anchor" onClick={() => go(n)} title="Show where this note is">{anchorLabel(n.anchor, names, tree, deps, lint)}</button>
                  : <span className="lab-rnote-anchor">{anchorLabel(n.anchor, names, tree, deps, lint)}</span>}
              </header>
              {status !== 'current' && <p className={`lab-rnote-status lab-rnote-status-${status}`}><Glyph name={status === 'changed' ? 'warn' : 'error'} size={12} />{STATUS_LABEL[status]}</p>}
              {n.text && <p className="lab-rnote-text">{n.text}</p>}
              {n.sees && <p className="lab-rnote-sees">{n.sees}</p>}
              {n.fix && <p className="lab-rnote-fix"><span className="lab-muted">Fix as data</span> {n.fix}</p>}
              <footer className="lab-rnote-foot">
                <span>{ROUTES.find(entry => entry.value === n.route)?.label ?? n.route}</span>
                {n.rule && <span>{n.rule}</span>}
                <span>{AGO(n.at)}</span>
                <button type="button" className="lab-rnote-remove" onClick={() => remove(n)}>Remove</button>
              </footer>
            </article>
          );
        })}
      </section>

      <section className="lab-review-export" aria-label="Export">
        <div className="lab-review-row">
          <button type="button" className="lab-button" onClick={exportNow} disabled={!file.notes.length && !file.verdict}>Export findings</button>
          <span className={cx('lab-review-saved', saved.where === 'unsaved' && 'lab-review-unsaved')}>
            <Glyph name={saved.where === 'unsaved' ? 'warn' : saved.where === 'file' ? 'clean' : 'info'} size={12} />
            {saved.where === 'file' ? `${file.notes.length || file.verdict ? 'Saved to' : 'Notes save to'} docs/calls/notes/${template.type}.json` : saved.where === 'browser' ? 'Saved in this browser only' : 'Not saved'}
          </span>
        </div>
        {saved.where === 'unsaved' && <p className="lab-review-why">{saved.why}</p>}
        {saved.where === 'browser' && !dev.staticBuild && <p className="lab-review-why">The dev server isn’t answering, so notes stay in this browser. Start it with npm run lab to share them.</p>}
        {exported !== null && (
          <div className="lab-review-md">
            <div className="lab-review-row">
              <span className="lab-muted">Rows in the review skill’s shape (swat-writing-review)</span>
              <button type="button" className="lab-button lab-button-quiet" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <textarea className="lab-input lab-review-mdtext" readOnly rows={10} value={exported} aria-label="Exported findings" />
          </div>
        )}
      </section>
      {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
    </div>
  );
}
