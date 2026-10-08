// Balance for the current call type and tier: the real engine, real dice and a different day-one
// squad per call, under each player style, in a worker. The same simulator as the balance gate.
import { useEffect, useRef, useState } from 'react';
import { POLICIES } from '../../gen/incident/trees-v13/balance';
import type { Distribution, Policy } from '../../gen/incident/trees-v13/balance';
import type { IncidentType } from '../../sim/scenario-types';
import type { BalanceRequest } from './balance.worker';

const WEIGHT_LABEL: Record<string, string> = { clean: 'Clean', costly: 'Costly', unresolved: 'Unresolved', hurt: 'Someone hurt', death: 'Someone died' };
const POLICY_LABEL: Record<Policy, string> = { random: 'Average player (random)', best_odds: 'Best odds', patient: 'Patient', fast: 'Fast' };
/** measure() returns shares (0 to 1). */
const pct = (share: number) => `${Math.round(share * 100)}%`;

export function BalancePanel({ type, tier }: { type: IncidentType; tier: number }) {
  const [calls, setCalls] = useState(60);
  const [results, setResults] = useState<Partial<Record<Policy, Distribution | string>>>({});
  const [running, setRunning] = useState(false);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => { setResults({}); worker.current?.terminate(); worker.current = null; setRunning(false); }, [type, tier]);

  const run = () => {
    worker.current?.terminate();
    const w = new Worker(new URL('./balance.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    setResults({});
    setRunning(true);
    w.onmessage = (event: MessageEvent<{ policy?: Policy; distribution?: Distribution; error?: string; done?: boolean }>) => {
      const { policy, distribution, error, done } = event.data;
      if (done) { setRunning(false); return; }
      if (policy) setResults(prev => ({ ...prev, [policy]: distribution ?? error ?? 'failed' }));
    };
    w.postMessage({ type, tier, policies: [...POLICIES], calls } satisfies BalanceRequest);
  };

  return (
    <section className="sl-panel">
      <div className="sl-panel-head">
        <h2>Balance</h2>
        <div className="sl-toolbar">
          <label className="sl-check">Calls per style <input type="number" min={10} max={300} value={calls} onChange={event => setCalls(Math.max(10, Math.min(300, Number(event.target.value) || 60)))} style={{ width: 70 }} /></label>
          <button onClick={run} disabled={running}>{running ? 'Running…' : `Run at tier ${tier}`}</button>
        </div>
      </div>
      <p className="sl-dim">Real engine and dice, a different day-one squad per call. The balance gate holds tier 2 to its bands (docs/call-trees-v13.md).</p>
      <div className="sl-scroll">
        <table className="sl-table">
          <thead><tr><th>Style</th>{Object.values(WEIGHT_LABEL).map(label => <th key={label}>{label}</th>)}<th>Officer hurt</th><th>Mean minutes</th><th>Most common endings</th></tr></thead>
          <tbody>
            {POLICIES.map(policy => {
              const result = results[policy];
              if (!result) return <tr key={policy}><td>{POLICY_LABEL[policy]}</td><td colSpan={8} className="sl-dim">{running ? 'waiting' : 'not run'}</td></tr>;
              if (typeof result === 'string') return <tr key={policy}><td>{POLICY_LABEL[policy]}</td><td colSpan={8} className="sl-err">{result}</td></tr>;
              const top = Object.entries(result.endings).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ending, n]) => `${ending} ${pct(n)}`).join(', ');
              return (
                <tr key={policy}>
                  <td>{POLICY_LABEL[policy]}</td>
                  {Object.keys(WEIGHT_LABEL).map(weight => <td key={weight}>{pct(result.weights[weight as keyof Distribution['weights']])}</td>)}
                  <td>{pct(result.officerHurtRate)}</td>
                  <td>{result.meanMinutes}</td>
                  <td className="sl-dim">{top}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
