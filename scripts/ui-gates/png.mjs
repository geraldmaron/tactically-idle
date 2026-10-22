// A small PNG reader and the contrast sampler R14 uses for text drawn over art. The page cannot read its
// own pixels, so the walk screenshots the text's box with the text hidden and measures what is behind it.
import { inflateSync } from 'node:zlib';

/** Decode an 8-bit RGB or RGBA, non-interlaced PNG into { width, height, data: RGBA bytes }. */
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, width = 0, height = 0, depth = 0, color = 0, interlace = 0;
  const idat = [];
  while (off < buffer.length) {
    const len = buffer.readUInt32BE(off), type = buffer.toString('ascii', off + 4, off + 8), body = buffer.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; color = body[9]; interlace = body[12]; }
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (color !== 6 && color !== 2)) throw new Error(`unsupported PNG (depth ${depth}, color ${color}, interlace ${interlace})`);
  const bpp = color === 6 ? 4 : 3, stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height * 4, 255);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let add = 0;
      if (filter === 1) add = a; else if (filter === 2) add = b; else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = (line[i] + add) & 255;
    }
    for (let x = 0; x < width; x++) for (let k = 0; k < bpp; k++) out[(y * width + x) * 4 + k] = line[x * bpp + k];
    prev = line;
  }
  return { width, height, data: out };
}

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** The contrast of text colour `fg` ([r,g,b,a]) against the pixels behind it: the ratio the worst 10% of
 * pixels give, so one noisy pixel in the art does not fail a line that reads. */
export function worstContrast(png, fg) {
  const ratios = [];
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b] = [0, 1, 2].map((k) => fg[k] * fg[3] + png.data[i + k] * (1 - fg[3]));
    const l1 = lum(r, g, b), l2 = lum(png.data[i], png.data[i + 1], png.data[i + 2]);
    ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
  }
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length * 0.1)] ?? Infinity;
}

/**
 * R14 over art: hide every glyph, photograph the box each painted text sits in, and measure the text's
 * colour against those pixels. Returns R14.sampled findings for the texts that fall under their
 * threshold. This is a report for a human to look at, not a gate: a decoration inside a text's box (a dot,
 * a meter bar) lands in the sample, so a low ratio here is a place to look, not proof.
 * @param {import('playwright-core').Page} page
 * @param {{ id: string, x: number, y: number, w: number, h: number, need: number, fg: number[], label: string }[]} texts
 */
export async function measurePainted(page, texts, { debugDir } = {}) {
  const findings = [];
  if (!texts.length) return findings;
  const tag = await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}' });
  try {
    for (const t of texts) {
      let worst = Infinity;
      for (const [i, line] of t.lines.entries()) {
        const clip = { x: Math.max(0, line.x), y: Math.max(0, line.y), width: Math.max(1, line.w), height: Math.max(1, line.h) };
        const buffer = await page.screenshot({ type: 'png', clip, scale: 'css' });
        const ratio = worstContrast(decodePng(buffer), t.fg);
        if (debugDir && ratio < t.need) (await import('node:fs')).writeFileSync(`${debugDir}/painted-${t.id.replace(/[^\w]+/g, '_').slice(-50)}-${i}.png`, buffer);
        worst = Math.min(worst, ratio);
      }
      if (worst < t.need) findings.push({ rule: 'R14.sampled', id: t.id, detail: `${worst.toFixed(2)}:1 against the pixels behind it, needs ${t.need}:1 (${t.label}, text rgba(${t.fg.map((c, k) => k < 3 ? Math.round(c) : Math.round(c * 100) / 100).join(',')}))` });
    }
  } finally {
    await tag.evaluate((el) => el.remove());
  }
  return findings;
}
