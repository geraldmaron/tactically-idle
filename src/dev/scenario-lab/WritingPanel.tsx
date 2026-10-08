// Every player-visible string of this call, bound with this instance's names, pronouns and rooms,
// checked by the swat-call-prose skill's own checker through the dev server (vite.config.ts,
// /__lab/string-checks). The lab never carries a copy of the rules.
import { useMemo, useState } from 'react';
import type { CallTree } from '../../content/call-trees/types';
import { callStringRows, parseFindings, toTsv } from '../../gen/incident/trees-v13/strings';
import type { StringFinding, StringRow } from '../../gen/incident/trees-v13/strings';

interface CheckResult { code: number; findings: StringFinding[]; summary: string[]; error?: string }

export type ReadAs = 'drawn' | 'he' | 'she' | 'they';

export function WritingPanel({ tree, binderFor, cast, counts, onNote }: { tree: CallTree; binderFor: (as: ReadAs) => (text: string) => string; cast: string[]; counts?: Record<string, number>; onNote: (where: string) => void }) {
  const [readAs, setReadAs] = useState<ReadAs>('drawn');
  const bind = useMemo(() => binderFor(readAs), [binderFor, readAs]);
  // A group call's strings are those a call of this instance's group sizes can reach.
  const rows = useMemo<StringRow[]>(() => callStringRows(tree, text => { try { return bind(text); } catch { return text; } }, counts), [tree, bind, counts]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [running, setRunning] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [surface, setSurface] = useState('');
  const byWhere = useMemo(() => {
    const map = new Map<string, StringFinding[]>();
    for (const finding of result?.findings ?? []) map.set(finding.where, [...map.get(finding.where) ?? [], finding]);
    return map;
  }, [result]);

  const run = async () => {
    setRunning(true);
    try {
      const response = await fetch('/__lab/string-checks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tsv: toTsv(rows), cast }) });
      const body = await response.json() as { code: number; stdout: string; stderr: string };
      const parsed = parseFindings(body.stdout, rows);
      setResult({ code: body.code, ...parsed, ...(body.stderr ? { error: body.stderr } : {}) });
    } catch (error) {
      setResult({ code: -1, findings: [], summary: [], error: `The checker runs through the dev server only (npm run dev): ${String(error)}` });
    } finally { setRunning(false); }
  };

  const surfaces = [...new Set(rows.map(row => row.surface))];
  const shown = rows.filter(row => (!onlyFlagged || byWhere.has(row.where)) && (!surface || row.surface === surface));
  return (
    <section className="sl-panel">
      <div className="sl-panel-head">
        <h2>Writing</h2>
        <div className="sl-toolbar">
          <label className="sl-check" title="Bind every person with the same pronouns to find sentences that turn ambiguous when two people share them">Read everyone as <select value={readAs} onChange={event => { setReadAs(event.target.value as ReadAs); setResult(null); }}><option value="drawn">drawn</option><option value="he">he</option><option value="she">she</option><option value="they">they</option></select></label>
          <label className="sl-check">Surface <select value={surface} onChange={event => setSurface(event.target.value)}><option value="">all ({rows.length})</option>{surfaces.map(entry => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          <label className="sl-check"><input type="checkbox" checked={onlyFlagged} onChange={event => setOnlyFlagged(event.target.checked)} /> flagged only</label>
          <button onClick={run} disabled={running}>{running ? 'Checking…' : 'Run the string checks'}</button>
        </div>
      </div>
      <p className="sl-dim">Bound with this call’s cast. The rules live in .agents/skills/swat-call-prose/scripts/game_string_checks.py; <code>npm run check:strings</code> runs the same checker on every call with the longest names.</p>
      {result?.error && <p className="sl-err">{result.error}</p>}
      {result && <p className={result.code === 0 ? 'sl-ok' : 'sl-err'}>{result.code === 0 ? 'No blocking findings.' : `${result.findings.length} findings; blocking issues present.`} {result.summary.find(line => line.startsWith('summary'))}</p>}
      <div className="sl-scroll">
        <table className="sl-table sl-writing">
          <thead><tr><th>Where</th><th>Surface</th><th>Sit.</th><th>Text</th><th>Findings</th><th /></tr></thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={`${row.where}|${row.situation}|${i}`} className={byWhere.has(row.where) ? 'flagged' : ''}>
                <td className="sl-mono">{row.where}</td>
                <td>{row.surface}</td>
                <td>{row.situation}</td>
                <td>{row.text} <span className="sl-dim">({row.text.length})</span></td>
                <td>{(byWhere.get(row.where) ?? []).filter(f => !f.situation || f.situation === row.situation || row.situation === 'all').map((finding, j) => <div key={j}><span className="sl-chip bad">{finding.kind}</span> {finding.detail}</div>)}</td>
                <td><button className="sl-link" onClick={() => onNote(row.where)}>note</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
