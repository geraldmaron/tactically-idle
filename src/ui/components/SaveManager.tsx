import { useRef, useState } from 'react';
import { manageSave, useCampaigns, exportCurrentSave, exportSlotSave, exportSaveRecovery, isResponsivePreview, type SaveAction } from '../store';
import { Sheet } from './Sheet';
import { Button, Chip } from './ui';
import { money } from '../format';

type Edit = { type: 'new' | 'copy' | 'rename' | 'delete' | 'import' | 'load'; id: number; name: string; data?: string; permanent?: boolean };
const timestamp = (at: number) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CampaignBar({ onOpen }: { onOpen: () => void }) {
  const saved = useCampaigns();
  const slot = saved.activeSlotId ? saved.slots[saved.activeSlotId - 1] : null;
  return <div className={`campaign-bar${saved.issue ? ' campaign-warning' : ''}`}>
    <span><strong>{isResponsivePreview ? 'TEST · ' : ''}{slot ? `Slot ${saved.activeSlotId} · ${slot.name}` : 'Unsaved campaign'}</strong><small>{isResponsivePreview ? 'Temporary test saves · lost on reload' : saved.issue ? 'Saving needs attention' : saved.dirty ? slot ? 'Saving locally…' : 'Not saved yet' : 'Autosaved on this device'}</small></span>
    <button type="button" onClick={onOpen} aria-label="Open local saves and new game">Saves / New</button>
  </div>;
}

export function SaveManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saved = useCampaigns();
  const [edit, setEdit] = useState<Edit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const importRequest = useRef(0);
  const firstEmpty = saved.slots.findIndex((slot) => !slot) + 1;
  const close = () => { if (busy) return; importRequest.current++; setEdit(null); setError(null); setMessage(null); onClose(); };
  const begin = (type: Edit['type'], id: number) => { importRequest.current++; setEdit({ type, id, name: type === 'new' ? `Campaign ${id}` : saved.slots[id - 1]?.name ?? `Campaign ${id}` }); setError(null); setMessage(null); };
  const run = async (action: SaveAction, success: string, leave = false) => {
    if (busy) return;
    importRequest.current++;
    setBusy(true);
    const result = await manageSave(action);
    setBusy(false);
    if (!result.ok) { setError(result.reason); return; }
    setEdit(null); setError(null); setMessage(success);
    if (leave) { importRequest.current++; onClose(); }
  };
  const selected = edit ? saved.slots[edit.id - 1] : null;
  return <Sheet open={open} onClose={close} title={edit ? edit.type === 'delete' ? 'Delete save?' : edit.type === 'rename' ? 'Rename save' : edit.type === 'new' ? 'Start a new game' : edit.type === 'load' ? 'Load saved campaign?' : edit.type === 'import' ? 'Import backup' : 'Save a copy' : isResponsivePreview ? 'Temporary test saves' : 'Local saves'} subtitle={isResponsivePreview ? 'Ten in-memory slots · lost when this frame reloads or closes' : 'Ten slots · stored in this browser on this device'} className="save-manager">
    {saved.issue && <p className="save-alert" role="alert">{saved.issue}</p>}
    {error && <p className="save-alert" role="alert">{error}</p>}
    {message && <p className="save-success" role="status">{message}</p>}
    {busy && <p role="status">Saving locally…</p>}
    <fieldset disabled={busy} className="save-controls">
    {edit ? <form className="save-edit" onSubmit={(e) => {
      e.preventDefault();
      if (edit.type === 'delete') void run({ type: 'delete', id: edit.id, confirmed: true, permanent: edit.permanent }, edit.permanent ? 'Save permanently deleted.' : 'Save deleted. You can undo the most recent deletion.');
      else if (edit.type === 'load') run({ type: 'load', id: edit.id, discardUnsaved: true }, 'Campaign loaded.', true);
      else if (edit.type === 'rename') run({ type: 'rename', id: edit.id, name: edit.name }, 'Save renamed.');
      else if (edit.type === 'import') run({ type: 'import', id: edit.id, name: edit.name, data: edit.data ?? '', overwrite: !!selected }, 'Backup imported. Load its slot when you are ready.');
      else run({ type: edit.type, id: edit.id, name: edit.name, overwrite: !!selected, discardUnsaved: !saved.activeSlotId }, edit.type === 'new' ? 'New game started.' : 'Copy saved.', edit.type === 'new');
    }}>
      {edit.type === 'delete' || edit.type === 'rename' || edit.type === 'load' ? <p>Slot {edit.id}{selected ? ` · ${selected.name}` : ' · Empty'}</p> : <label>Destination slot<select value={edit.id} onChange={(e) => setEdit({ ...edit, id: Number(e.target.value) })}>{saved.slots.map((slot, i) => <option key={i} value={i + 1} disabled={edit.type === 'import' && saved.activeSlotId === i + 1}>Slot {i + 1} · {slot?.name ?? 'Empty'}</option>)}</select></label>}
      {edit.type !== 'delete' && edit.type !== 'load' && <label>Save name<input autoFocus value={edit.name} maxLength={36} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>}
      {!saved.activeSlotId && (edit.type === 'new' || edit.type === 'load') && <><p className="save-alert">Your current game is only in memory. Continuing will discard it. Export it now if you want to keep it; your existing save slots stay intact unless you explicitly replace one.</p><Button onClick={() => download(exportCurrentSave(), 'tactically-idle-campaign.json')}>Export current game first</Button></>}
      {edit.type === 'delete' ? <><p>This removes “{selected?.name}” from slot {edit.id}. The most recent deletion can be undone unless you select permanent deletion.</p><label className="save-permanent"><input type="checkbox" checked={!!edit.permanent} onChange={(e) => setEdit({ ...edit, permanent: e.target.checked })} />Delete permanently to free storage, and clear the previous undo backup</label>{edit.permanent && <p className="save-alert">This cannot be undone. Export a backup first if you need to keep this save.</p>}</> : edit.type !== 'rename' && edit.type !== 'load' && <>
        {selected && <p className="save-alert">This replaces “{selected.name}” in slot {edit.id}. Its current progress will be overwritten.</p>}
        <p>{edit.type === 'new' ? `Start a separate campaign with a fresh roster roll.${saved.activeSlotId ? ' Your current campaign is saved before switching.' : ''}` : edit.type === 'import' ? 'Store this backup in a slot, then load it when you are ready. Your current campaign stays active.' : 'Keep a snapshot of this campaign in the selected slot. Autosaving will continue in that slot.'}</p>
      </>}
      {selected && edit.type !== 'rename' && <Button onClick={() => { const data = exportSlotSave(edit.id); if (data) download(data, `tactically-idle-slot-${edit.id}.json`); }}>Export existing slot {edit.id}</Button>}
      <div className="save-actions"><Button onClick={() => { importRequest.current++; setEdit(null); setError(null); }}>Cancel</Button><Button type="submit" variant={edit.type === 'delete' || (selected && edit.type !== 'rename') ? 'danger' : 'primary'}>{edit.type === 'delete' ? edit.permanent ? 'Permanently delete save' : 'Delete save' : edit.type === 'rename' ? 'Save name' : edit.type === 'load' ? 'Discard unsaved game and load' : selected ? edit.type === 'new' ? 'Replace and start new' : 'Replace save' : edit.type === 'new' ? 'Start new game' : edit.type === 'import' ? 'Import backup' : 'Save copy'}</Button></div>
    </form> : <>
      <p className="dim save-explainer">{isResponsivePreview ? 'This test library exists only in memory. New games, copies, renames and loads never read or change normal browser campaigns. Reloading or closing this frame discards every test slot.' : 'The active campaign saves automatically. Loading another slot first saves your current progress. Browser data clearing removes local saves; export a backup to keep a copy.'}</p>
      <div className="save-actions save-primary-actions"><Button variant="primary" onClick={() => begin('new', firstEmpty || 1)}>New game</Button><Button onClick={() => run({ type: 'save' }, 'Current campaign saved.')}>Save now</Button><Button onClick={() => begin('copy', firstEmpty || 1)}>Save a copy</Button></div>
      {!firstEmpty && <p className="save-alert">All ten slots are occupied. Choose a slot below to replace, or delete a save you no longer need.</p>}
      <ol className="save-slots">
        {saved.slots.map((slot, i) => <li className={`save-slot${saved.activeSlotId === i + 1 ? ' save-slot-active' : ''}`} key={i}>
          <div className="save-slot-head"><span className="save-slot-number">{String(i + 1).padStart(2, '0')}</span><strong>{slot?.name ?? 'Empty slot'}</strong>{saved.activeSlotId === i + 1 && <Chip tone="mint">Active</Chip>}</div>
          {slot && <><p className="save-slot-summary">{slot.valid ? `Day ${slot.day} · Level ${slot.level} · ${slot.officers} officers · ${money(slot.funding ?? 0)}${slot.operation ? ' · Operation in progress' : ''}` : 'Unreadable save · original data retained'}</p><p className="dim save-slot-time">Saved {timestamp(slot.savedAt)}</p></>}
          <div className="save-actions">
            {slot && <Button size="sm" disabled={!slot.valid || saved.activeSlotId === i + 1} onClick={() => saved.activeSlotId ? run({ type: 'load', id: i + 1 }, 'Campaign loaded.', true) : begin('load', i + 1)}>Load slot {i + 1}</Button>}
            <Button size="sm" onClick={() => begin('new', i + 1)}>New here</Button>
            <Button size="sm" onClick={() => begin('copy', i + 1)}>Save here</Button>
            {slot && <><Button size="sm" onClick={() => begin('rename', i + 1)}>Rename</Button><Button size="sm" variant="ghost" disabled={saved.activeSlotId === i + 1} title={saved.activeSlotId === i + 1 ? 'Load another campaign before deleting this save' : undefined} onClick={() => begin('delete', i + 1)}>Delete</Button></>}
          </div>
        </li>)}
      </ol>
      <div className="save-actions">{saved.canUndoDelete && <Button onClick={() => run({ type: 'undoDelete' }, 'Deleted save restored.')}>Undo last deletion</Button>}<Button onClick={() => download(exportCurrentSave(), 'tactically-idle-campaign.json')}>Export current game</Button><label className="btn btn-secondary btn-md save-import">Import backup<input type="file" accept=".json,application/json" onChange={async (e) => {
        const request = ++importRequest.current;
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('This file is too large for a campaign backup.'); return; }
        try { const data = await file.text(); if (request !== importRequest.current) return; setEdit({ type: 'import', id: firstEmpty || (saved.activeSlotId === 1 ? 2 : 1), name: 'Imported campaign', data }); setError(null); }
        catch { if (request === importRequest.current) setError('This file could not be read. Your saves are unchanged.'); }
      }} /></label>{saved.issue && <Button onClick={() => { const recovery = exportSaveRecovery(); if (recovery) download(recovery, 'tactically-idle-save-recovery.json'); else setError('No saved library is available to export. Export the current game instead.'); }}>Export save library</Button>}</div>
    </>}
    </fieldset>
  </Sheet>;
}
