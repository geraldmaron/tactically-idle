// Review notes per field path, in the swat-writing-review shape (field, verdict, owning skill,
// note), kept as a draft in this browser and exported as markdown for the review record.
import { useEffect, useState } from 'react';

export interface ReviewNote { where: string; verdict: 'approve' | 'edit' | 'reject'; owner: 'design' | 'prose' | 'engine'; note: string; at: string }

const keyFor = (type: string) => `ti-lab-notes:${type}`;
function load(type: string): ReviewNote[] {
  try { return JSON.parse(localStorage.getItem(keyFor(type)) ?? '[]') as ReviewNote[]; } catch { return []; }
}
function save(type: string, notes: ReviewNote[]) {
  try { localStorage.setItem(keyFor(type), JSON.stringify(notes)); } catch { /* private window: notes last for this page only */ }
}

export function NotesPanel({ type, title, draftWhere, wheres }: { type: string; title: string; draftWhere: string; wheres: string[] }) {
  const [notes, setNotes] = useState<ReviewNote[]>(() => load(type));
  const [where, setWhere] = useState(draftWhere || 'call');
  const [verdict, setVerdict] = useState<ReviewNote['verdict']>('edit');
  const [owner, setOwner] = useState<ReviewNote['owner']>('prose');
  const [text, setText] = useState('');
  useEffect(() => setNotes(load(type)), [type]);
  useEffect(() => { if (draftWhere) setWhere(draftWhere); }, [draftWhere]);
  const update = (next: ReviewNote[]) => { setNotes(next); save(type, next); };
  const add = () => { if (!text.trim()) return; update([...notes, { where, verdict, owner, note: text.trim(), at: new Date().toISOString().slice(0, 10) }]); setText(''); };
  const exportMarkdown = () => {
    const lines = [`# Review notes: ${title} (${type})`, '', '| Field | Verdict | Owner | Note | Date |', '| --- | --- | --- | --- | --- |',
      ...notes.map(note => `| ${note.where} | ${note.verdict} | ${note.owner} | ${note.note.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${note.at} |`)];
    const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url; link.download = `review-${type}.md`; link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="sl-panel">
      <div className="sl-panel-head"><h2>Review notes</h2><div className="sl-toolbar"><button onClick={exportMarkdown} disabled={!notes.length}>Export markdown</button></div></div>
      <p className="sl-dim">A draft in this browser only. Export it into the review record; findings route to the skill that owns the field.</p>
      <div className="sl-controls">
        <label>Field <select value={where} onChange={event => setWhere(event.target.value)}><option value="call">the whole call</option>{wheres.map(entry => <option key={entry} value={entry}>{entry}</option>)}</select></label>
        <label>Verdict <select value={verdict} onChange={event => setVerdict(event.target.value as ReviewNote['verdict'])}><option value="approve">approve</option><option value="edit">edit</option><option value="reject">reject</option></select></label>
        <label>Owner <select value={owner} onChange={event => setOwner(event.target.value as ReviewNote['owner'])}><option value="design">swat-call-design</option><option value="prose">swat-call-prose</option><option value="engine">engine</option></select></label>
        <label className="sl-wide">Note <input value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') add(); }} /></label>
        <button onClick={add}>Add</button>
      </div>
      {notes.length > 0 && (
        <div className="sl-scroll">
          <table className="sl-table">
            <thead><tr><th>Field</th><th>Verdict</th><th>Owner</th><th>Note</th><th>Date</th><th /></tr></thead>
            <tbody>{notes.map((note, i) => <tr key={i}><td className="sl-mono">{note.where}</td><td>{note.verdict}</td><td>{note.owner}</td><td>{note.note}</td><td>{note.at}</td><td><button className="sl-link" onClick={() => update(notes.filter((_, j) => j !== i))}>remove</button></td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
