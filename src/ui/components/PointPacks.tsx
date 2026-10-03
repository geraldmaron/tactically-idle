import { useEffect, useRef, useState } from 'react';
import { availableTestMilli } from '../../commerce/ledger';
import { newLocalId, TEST_PRODUCTS, type TestProduct } from '../../commerce/types';
import { canUseTestStore, claimPointPack, claimSavedPoints, resumePointPacks, useCampaigns } from '../store';
import { Button, Chip } from './ui';
import { Sheet } from './Sheet';
import './point-packs.css';

export function PointPacks({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saved = useCampaigns();
  const campaign = saved.slots.find((slot) => slot?.campaignId === saved.campaignId);
  const [selection, setSelection] = useState<{ product: TestProduct; requestId: string; campaignId: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [success, setSuccess] = useState(false);
  const latch = useRef(false);
  const held = availableTestMilli(saved.commerce);
  useEffect(() => {
    if (!open) return;
    setSelection(null); setFeedback(''); setSuccess(false);
    let active = true;
    if (saved.commerce.transactions.some((t) => t.claimCampaignId && !t.claimDelivered && !['failed', 'cancelled'].includes(t.status))) {
      setBusy(true);
      void resumePointPacks().then((result) => { if (active) { setFeedback(result.ok ? 'Your confirmed reward has been saved.' : result.reason); setSuccess(result.ok); } }).finally(() => { if (active) setBusy(false); });
    }
    return () => { active = false; };
  }, [open]);
  async function collect() {
    if (!selection || latch.current) return;
    latch.current = true; setBusy(true); setFeedback('');
    try {
      const result = await claimPointPack(selection.product.id, selection.campaignId, selection.requestId);
      setSuccess(result.ok);
      setFeedback(result.ok ? `${selection.product.milliDP / 1000} DP added to ${selection.name}.` : result.reason);
      if (result.ok) setSelection(null);
    } finally { latch.current = false; setBusy(false); }
  }
  return <Sheet open={open} onClose={onClose} title="Development points" subtitle="Free during testing" className="point-packs-sheet" footer={
    busy ? <p role="status" aria-live="polite">Saving your reward…</p> : selection ? <div className="point-pack-actions">
      <Button onClick={() => setSelection(null)}>Cancel</Button>
      <Button variant="primary" disabled={!canUseTestStore || saved.campaignId !== selection.campaignId} onClick={() => void collect()}>Confirm · {selection.product.milliDP / 1000} DP free</Button>
    </div> : <Button block variant={success ? 'primary' : 'secondary'} onClick={onClose}>Back to Develop</Button>
  }>
    <p className="dim">Choose points for department upgrades. Every pack is free while we test purchases; there are no charges.</p>
    <div className="chips"><Chip icon="chart">{Math.floor(saved.developmentBudget.totalDP * 1000) / 1000} DP available</Chip></div>
    {!canUseTestStore && <p role="alert" className="reason">This browser cannot safely save rewards. Use a current browser with local saving enabled.</p>}
    {!campaign && <p className="reason">Save this campaign in a slot before collecting points.</p>}
    {selection ? <section className="point-pack-confirm"><h3>{selection.product.milliDP / 1000} development points</h3><p>Add to <strong>{selection.name}</strong>?</p><p className="dim">These points stay with this campaign. Copying or exporting a save does not duplicate them.</p>
      {saved.campaignId !== selection.campaignId && <p role="alert">The active campaign changed. Cancel and choose a pack again.</p>}
    </section> : !success && <div className="point-pack-grid">{TEST_PRODUCTS.map((product) => <article className="point-pack" key={product.id}><strong>{product.milliDP / 1000}<small> DP</small></strong><span>Department upgrades</span><Button variant="primary" disabled={!campaign || !canUseTestStore || busy} onClick={() => { if (campaign) { setFeedback(''); setSelection({ product, requestId: newLocalId(), campaignId: campaign.campaignId, name: campaign.name }); } }}>Choose {product.milliDP / 1000} DP</Button></article>)}</div>}
    {!!held && !selection && <section className="point-pack-held"><p>{held / 1000} points from earlier testing are waiting to be collected.</p><Button disabled={!campaign || !canUseTestStore || busy} onClick={() => {
      if (!campaign || latch.current) return;
      latch.current = true; setBusy(true);
      void claimSavedPoints(campaign.campaignId).then((result) => { setFeedback(result.ok ? `Saved points added to ${campaign.name}.` : result.reason); setSuccess(result.ok); }).finally(() => { latch.current = false; setBusy(false); });
    }}>Add saved points to {campaign?.name ?? 'this campaign'}</Button></section>}
    {feedback && <p className={success ? 'note note-good' : 'reason'} role={success ? 'status' : 'alert'} aria-live="polite">{feedback}</p>}
    <p className="dim point-pack-local">Progress and rewards are saved on this device. Equipment uses department funding; courses also take training time.</p>
  </Sheet>;
}
