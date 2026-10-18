// "True device" (spec 10.4 item 3): the call at this step in a real iframe at 320, 360, 390 or
// 430 px wide, so the game's own width rules (max-width 380, 360, 359, 350, 340 px) apply as on a
// phone, which the in-page frame can't do below 390. The iframe loads `?frame=player` with this URL's
// call and path and plays it on saved tuning; nothing is sent between the two pages.
import { useState } from 'react';
import { useLab } from '../../context';
import { playerSearch } from '../../url';
import { Glyph, Modal, SegmentedControl } from '../../viz';

export const DEVICE_WIDTHS = [320, 360, 390, 430] as const;
type DeviceWidth = typeof DEVICE_WIDTHS[number];
const HEIGHT: Record<DeviceWidth, number> = { 320: 568, 360: 780, 390: 844, 430: 932 };

export function TrueDeviceButton() {
  const { url, tuning } = useLab();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<DeviceWidth>(360);
  const unsaved = Object.keys(tuning.patch).length > 0;
  const src = `${window.location.pathname}${playerSearch(url)}`;
  // The modal sits 12vh down and may take 86vh: the iframe gets what the header and bar leave.
  const height = Math.min(HEIGHT[width], Math.max(400, Math.floor(window.innerHeight * 0.86) - 160));
  return (
    <>
      <button type="button" className="lab-button lab-truedevice-button" onClick={() => setOpen(true)}
        title={unsaved ? 'Opens this step in a real iframe on saved tuning: your unsaved tuning is not applied there' : 'Opens this step in a real iframe at a phone width'}>
        <Glyph name="scan" size={13} />{unsaved ? 'True device · Uses saved tuning' : 'True device'}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label="True device" className="lab-truedevice">
        <header className="lab-modal-bar">
          <h2 className="lab-modal-title">True device</h2>
          <button type="button" className="lab-icon-button" onClick={() => setOpen(false)} aria-label="Close"><Glyph name="close" /></button>
        </header>
        <div className="lab-truedevice-bar">
          <SegmentedControl label="Device width" size="small" value={width} options={DEVICE_WIDTHS.map(w => ({ value: w, label: String(w) }))} onChange={setWidth} />
          <span className="lab-muted">{width} × {HEIGHT[width]}{height < HEIGHT[width] ? `, ${height} shown` : ''} · {unsaved ? 'saved tuning, not your unsaved changes' : 'saved tuning'} · a Confirm here stays here</span>
        </div>
        <div className="lab-truedevice-stage">
          <iframe className="lab-truedevice-frame" title={`The call at ${width} px`} src={src} style={{ width, height }} />
        </div>
      </Modal>
    </>
  );
}
