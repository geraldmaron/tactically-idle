import { useRef, useState } from 'react';
import { availableTestMilli, campaignTestMilli } from '../../commerce/ledger';
import { TEST_PRODUCTS, type MockOutcome, type MockProvider } from '../../commerce/types';
import type { HandlerResult } from '../../sim/types';
import { canUseTestStore, isResponsivePreview, manageTestStore, simulateTestPurchase, useCampaigns } from '../store';
import './test-store.css';

const dp = (milli: number) => (milli / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 });

export function TestStore() {
  const snapshot = useCampaigns();
  const wallet = snapshot.commerce;
  const [provider, setProvider] = useState<MockProvider>('apple');
  const [outcome, setOutcome] = useState<MockOutcome>('success');
  const [selectedCampaign, setSelectedCampaign] = useState(snapshot.campaignId ?? '');
  const [amount, setAmount] = useState('3');
  const [busy, setBusy] = useState(false);
  const latch = useRef(false);
  const [message, setMessage] = useState('');
  const [refundKey, setRefundKey] = useState<string | null>(null);
  const available = availableTestMilli(wallet);
  const allocations = [...new Set(wallet.transactions.flatMap((t) => Object.keys(t.allocations)))].filter((id) => campaignTestMilli(wallet, id) > 0);
  const selected = snapshot.slots.find((slot) => slot?.campaignId === selectedCampaign);
  const disabled = busy || !canUseTestStore;
  async function run(action: () => Promise<HandlerResult>, success: string) {
    if (latch.current) return;
    latch.current = true; setBusy(true); setMessage('');
    try { const result = await action(); setMessage(result.ok ? success : result.reason ?? 'The test action could not be saved.'); }
    catch { setMessage('The test action could not finish. Check transaction history before trying again.'); }
    finally { latch.current = false; setBusy(false); }
  }
  return <div className="test-store">
    <section className="test-store-notice" aria-label="Test store disclaimer">
      <h3>Test store · no real payment</h3>
      <p>Apple and Google connections are simulated. These buttons create local test credits and never charge you.</p>
      <p>{isResponsivePreview ? 'This temporary preview loses its test history when reloaded.' : 'History stays in this browser only. Clearing site data loses it; there is no account or cross-device recovery.'}</p>
    </section>
    {!canUseTestStore && <p role="alert">Safe local purchases require browser save locks. Use a current browser to try this simulation.</p>}
    <div className="test-wallet-balance"><strong>{dp(available)} test DP available to allocate</strong>
      <span>Active campaign: {snapshot.developmentBudget.earnedDP.toFixed(2)} earned DP + {snapshot.developmentBudget.testDP.toFixed(3)} allocated test DP</span>
      {wallet.debt > 0 && <p role="status">{dp(wallet.debt)} test DP refund adjustment remains. Future test credits cover this first. Your earned points and existing upgrades stay intact; no money is owed.</p>}
    </div>
    <label className="test-store-field">Simulated provider<select value={provider} disabled={disabled} onChange={(e) => setProvider(e.target.value as MockProvider)}>
      <option value="apple">Apple simulation</option><option value="google">Google simulation</option>
    </select></label>
    <details className="test-store-controls"><summary>Simulation controls</summary>
      <label className="test-store-field">Next purchase outcome<select value={outcome} disabled={disabled} onChange={(e) => setOutcome(e.target.value as MockOutcome)}>
        <option value="success">Success</option><option value="pending">Pending approval</option><option value="cancel">Cancelled</option><option value="fail">Failed</option><option value="completion_failure">Credit succeeds; completion fails</option>
      </select></label>
      <p>Pending purchases grant nothing until you resolve them in history. A completion retry cannot grant the same credit twice.</p>
    </details>
    <div className="test-product-grid">{TEST_PRODUCTS.map((product) => <section key={product.id} className="test-product">
      <h3>{product.name}</h3><p>For development upgrades. Gear still costs department funding, and qualifications still require training.</p>
      <button className="btn primary" disabled={disabled} onClick={() => void run(() => simulateTestPurchase(provider, product.id, outcome), outcome === 'pending'
        ? 'Test purchase is pending. No credit was granted.' : outcome === 'cancel' || outcome === 'fail'
          ? 'Test purchase ended without a credit.' : outcome === 'completion_failure'
            ? 'Test credit is saved. Retry completion in history; it will not grant again.' : 'Test credit saved. Choose a campaign below to allocate it.')}>Simulate purchase · {product.name}</button>
    </section>)}</div>
    <section className="test-allocation"><h3>Allocate test DP to a campaign</h3><p>Credits stay separate from earned progress. Copying, exporting or importing a campaign never copies its test balance.</p>
      <form onSubmit={(event) => { event.preventDefault(); const value = Number(amount); const milliDP = Math.round(value * 1000);
        if (!Number.isFinite(value) || value <= 0 || Math.abs(value * 1000 - milliDP) > 1e-7) { setMessage('Use a positive amount with at most three decimal places.'); return; }
        if (selected) void run(() => manageTestStore({ type: 'allocate', campaignId: selected.campaignId, milliDP }), `Allocated ${dp(milliDP)} test DP to ${selected.name}.`);
      }}>
        <label className="test-store-field">Campaign<select value={selectedCampaign} disabled={disabled} onChange={(e) => setSelectedCampaign(e.target.value)}>
          <option value="">Choose a saved campaign</option>{snapshot.slots.filter((s) => s?.valid).map((slot) => <option key={slot!.campaignId} value={slot!.campaignId}>Slot {slot!.id}: {slot!.name}</option>)}
        </select></label>
        <label className="test-store-field">Test DP amount<input type="number" inputMode="decimal" min="0.001" step="0.001" max={available / 1000} value={amount} disabled={disabled} onChange={(e) => setAmount(e.target.value)} /></label>
        {selected && Number.isFinite(Number(amount)) && Number(amount) > 0 && Number(amount) * 1000 <= available && <p>Slot {selected.id}: {selected.name} receives {amount} test DP. Wallet remaining after allocation: {dp(available - Math.round(Number(amount) * 1000))} test DP.</p>}
        <button className="btn primary" type="submit" disabled={disabled || !selected || available === 0}>Allocate {amount || '0'} test DP{selected ? ` to ${selected.name}` : ''}</button>
      </form>
      {allocations.map((id) => { const slot = snapshot.slots.find((s) => s?.campaignId === id); return <div className="test-allocation-row" key={id}>
        <span>{slot ? `Slot ${slot.id}: ${slot.name}` : 'Removed or replaced campaign'} · {dp(campaignTestMilli(wallet, id))} test DP</span>
        <button className="btn" disabled={disabled} onClick={() => void run(() => manageTestStore({ type: 'unassign', campaignId: id }), 'Unused test DP returned to the wallet.')}>Unassign unused credits</button>
      </div>; })}
    </section>
    <p role="status" aria-live="polite" className="test-store-feedback">{busy ? 'Saving local test transaction…' : message}</p>
    <section><h3>Test transaction history</h3>
      <button className="btn" disabled={disabled || wallet.transactions.length === 0} onClick={() => void run(() => manageTestStore({ type: 'reconcile' }), 'Checked known test transactions. Pending purchases still need an outcome; spent credits were not restored.')}>Reconcile test transactions</button>
      <p>Reconciliation completes known deliveries. It does not restore spent consumable credits.</p>
      {wallet.transactions.length === 0 && <p>No test purchases yet.</p>}
      {[...wallet.transactions].reverse().map((t) => <details className="test-receipt" key={t.key}>
        <summary>{dp(t.milliDP)} test DP · {t.provider === 'apple' ? 'Apple' : 'Google'} simulation · {t.refundedAt !== undefined ? 'refunded' : t.status}</summary>
        <p>{new Date(t.createdAt).toLocaleString()} · Spent: {dp(t.spent)} test DP · Refund adjustment covered: {dp(t.debtPaid)} test DP</p>
        <small>Receipt {t.key}</small>
        <div className="test-receipt-actions">
          {t.status === 'pending' && <>{(['success', 'cancel', 'fail'] as const).map((next) => <button className="btn" key={next} disabled={disabled} onClick={() => void run(() => manageTestStore({ type: 'resolve', key: t.key, outcome: next }), next === 'success' ? 'Test credit saved. Complete the receipt or reconcile history.' : 'Test purchase ended with no credit.')}>{next === 'success' ? 'Approve test purchase' : next === 'cancel' ? 'Cancel test purchase' : 'Fail test purchase'}</button>)}</>}
          {t.status === 'credited' && <button className="btn" disabled={disabled} onClick={() => void run(() => manageTestStore({ type: 'complete', key: t.key }), 'Completion saved; no additional credits granted.')}>{t.completionFailed ? 'Retry completion' : 'Complete receipt'}</button>}
          {(t.status === 'credited' || t.status === 'completed') && <>
            <button className="btn" disabled={disabled} onClick={() => void run(() => manageTestStore({ type: 'resolve', key: t.key, outcome: 'success' }), 'Receipt replayed safely; no duplicate credits granted.')}>Replay test receipt</button>
            {t.refundedAt === undefined && <button className="btn" disabled={disabled} onClick={() => setRefundKey(t.key)}>Simulate refund…</button>}
          </>}
        </div>
        {refundKey === t.key && <div className="test-refund-confirm"><p>Remove this receipt’s unused credits? Spent test DP becomes an adjustment against future test credits. Earned progress stays intact.</p>
          <button className="btn" disabled={disabled} onClick={() => setRefundKey(null)}>Keep receipt</button>
          <button className="btn" disabled={disabled} onClick={() => void run(async () => { const result = await manageTestStore({ type: 'refund', key: t.key }); if (result.ok) setRefundKey(null); return result; }, 'Local test refund recorded.')}>Confirm simulated refund</button>
        </div>}
      </details>)}
    </section>
  </div>;
}
