// One burst of emergency light as a call's briefing opens: red and blue sweep across the scene four
// times and are gone, so the moment lands with weight but never drags or competes with the reading.
// Safety: 2.5 flashes a second, under the three-a-second limit (WCAG 2.3.1), confined to the hero
// plate (a small share of the screen), colours kept below full saturation, and it plays once per
// mount. Under reduced motion there is no flash, only a faint still tint. Decorative: hidden from
// assistive technology.
import './siren-flash.css';

export function SirenFlash() {
  return <span className="siren-flash" aria-hidden="true"><i className="siren-flash-red" /><i className="siren-flash-blue" /></span>;
}
