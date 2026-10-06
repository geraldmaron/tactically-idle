import type { LocationDefinition, Opening, Vec } from '../../../sim/types';

// Developer drawing of a generated plan, for eyeballing plausibility. Not used by the game.

const FILL: Record<string, string> = {
  bedroom: '#dbe7f5',
  bathroom: '#d6efe9',
  hall: '#eeeeee',
  living: '#f6ead2',
  kitchen: '#f3dcd2',
  storage: '#e4dccf',
  office: '#e3e0f3',
  retail: '#f6efc4',
  utility: '#dfe3d2',
  stair: '#cfcfcf',
};
const ZONE: Record<string, string> = { yard: '#e8f1df', street: '#dcdcdc', alley: '#e6e0d6', porch: '#f3ecdc', parking: '#e1e4ea' };

const pts = (p: Vec[]) => p.map((q) => `${q.x},${q.y}`).join(' ');

function inside(p: Vec, poly: Vec[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

function door(o: Opening, loc: LocationDefinition): string {
  const dx = o.to.x - o.from.x;
  const dy = o.to.y - o.from.y;
  if (o.type === 'window') return `<line x1="${o.from.x}" y1="${o.from.y}" x2="${o.to.x}" y2="${o.to.y}" stroke="#2a7fd4" stroke-width="0.5"/>`;
  if (o.type === 'stair') return `<line x1="${o.from.x}" y1="${o.from.y}" x2="${o.to.x}" y2="${o.to.y}" stroke="#555" stroke-width="0.25" stroke-dasharray="0.5 0.4" marker-end="url(#arr)"/>`;
  if (o.type === 'doorway') return `<line x1="${o.from.x}" y1="${o.from.y}" x2="${o.to.x}" y2="${o.to.y}" stroke="#fff" stroke-width="0.9"/><line x1="${o.from.x}" y1="${o.from.y}" x2="${o.to.x}" y2="${o.to.y}" stroke="#c33" stroke-width="0.15" stroke-dasharray="0.3 0.3"/>`;
  const col = o.material === 'steel' ? '#444' : o.material === 'glass' ? '#4aa' : '#a52';
  let arc = '';
  const into = o.swing ? loc.rooms.find((r) => r.id === o.swing?.into)?.polygon : undefined;
  if (o.swing && into) {
    const hinge = o.swing.hinge === 'from' ? o.from : o.to;
    const free = o.swing.hinge === 'from' ? o.to : o.from;
    const r = Math.hypot(dx, dy);
    const ux = (free.x - hinge.x) / r;
    const uy = (free.y - hinge.y) / r;
    let nx = -uy;
    let ny = ux;
    const m = { x: (o.from.x + o.to.x) / 2, y: (o.from.y + o.to.y) / 2 };
    if (!inside({ x: m.x + nx * 0.3, y: m.y + ny * 0.3 }, into)) {
      nx = -nx;
      ny = -ny;
    }
    const sweep = ux * ny - uy * nx > 0 ? 1 : 0;
    arc = `<path d="M${free.x},${free.y} A${r},${r} 0 0 ${sweep} ${hinge.x + nx * r},${hinge.y + ny * r}" fill="none" stroke="#999" stroke-width="0.1"/>`;
  }
  return `<line x1="${o.from.x}" y1="${o.from.y}" x2="${o.to.x}" y2="${o.to.y}" stroke="#fff" stroke-width="0.9"/><line x1="${o.from.x}" y1="${o.from.y}" x2="${o.to.x}" y2="${o.to.y}" stroke="${col}" stroke-width="0.35"/>${arc}`;
}

export function locationToSvg(loc: LocationDefinition, floor: number, scale = 7): string {
  const { w, h } = loc.bounds;
  const rooms = loc.rooms.filter((r) => r.floor === floor);
  const ids = new Set(rooms.map((r) => r.id));
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" font-family="sans-serif">`);
  out.push('<defs><marker id="arr" markerWidth="3" markerHeight="3" refX="2" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 z" fill="#555"/></marker></defs>');
  out.push(`<rect width="${w}" height="${h}" fill="#fafafa"/>`);
  if (floor === 0) for (const z of loc.zones) out.push(`<polygon points="${pts(z.polygon)}" fill="${ZONE[z.kind] ?? '#eee'}" stroke="#bbb" stroke-width="0.1"/><text x="${z.polygon[0].x + 0.4}" y="${z.polygon[0].y + 1.1}" font-size="0.9" fill="#777">${z.id}</text>`);
  else out.push(`<polygon points="${pts(loc.footprint)}" fill="#ececec"/>`);
  for (const r of rooms) {
    out.push(`<polygon points="${pts(r.polygon)}" fill="${FILL[r.type] ?? '#fff'}" stroke="#222" stroke-width="0.3" stroke-linejoin="round"/>`);
    const xs = r.polygon.map((p) => p.x);
    const ys = r.polygon.map((p) => p.y);
    out.push(`<text x="${Math.min(...xs) + 0.4}" y="${Math.min(...ys) + 1.2}" font-size="1.0" fill="#223">${r.id}</text>`);
  }
  for (const o of loc.openings) {
    const f = o.floor ?? (ids.has(o.a) ? 0 : 0);
    const roomA = loc.rooms.find((r) => r.id === o.a);
    const ofl = o.type === 'stair' ? 0 : roomA ? roomA.floor : f;
    if (o.type === 'doorway' && !roomA && floor !== 0) continue;
    if (ofl !== floor && o.type !== 'stair') continue;
    if (o.type === 'stair' && floor !== 0) continue;
    if (!roomA && floor !== 0) continue;
    out.push(door(o, loc));
  }
  for (const o of loc.objects) {
    if (!ids.has(o.in) && !(floor === 0 && loc.zones.some((z) => z.id === o.in))) continue;
    const sw = o.rotation === 90 || o.rotation === 270;
    const cw = sw ? o.h : o.w;
    const ch = sw ? o.w : o.h;
    const x = o.x + o.w / 2 - cw / 2;
    const y = o.y + o.h / 2 - ch / 2;
    const fill = o.type === 'rug' ? '#e9d9b8' : o.type === 'shrub' || o.type === 'tree' ? '#9ccf8c' : '#fff';
    out.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${fill}" stroke="#666" stroke-width="0.12"/><text x="${x + 0.15}" y="${y + 0.8}" font-size="0.65" fill="#444">${o.type.slice(0, 4)}</text>`);
  }
  for (const n of loc.notes) out.push(`<text x="${n.at.x}" y="${n.at.y}" font-size="0.9" fill="#a33" font-style="italic">${n.text}</text>`);
  out.push(`<text x="0.5" y="${h - 0.5}" font-size="1.1" fill="#000">${loc.name} [${loc.familyId} #${loc.seed}] floor ${floor}</text>`);
  out.push('</svg>');
  return out.join('');
}

/** Several plans on one sheet (floor 0, and floor 1 beside it for two-storey plans). */
export function contactSheet(locs: LocationDefinition[], cols: number, scale = 6): string {
  const tiles: { svg: string; w: number; h: number }[] = [];
  for (const loc of locs) {
    tiles.push({ svg: locationToSvg(loc, 0, scale), w: loc.bounds.w * scale, h: loc.bounds.h * scale });
    if (loc.floors === 2) tiles.push({ svg: locationToSvg(loc, 1, scale), w: loc.bounds.w * scale, h: loc.bounds.h * scale });
  }
  const cw = Math.max(...tiles.map((t) => t.w)) + 10;
  const ch = Math.max(...tiles.map((t) => t.h)) + 10;
  const rows = Math.ceil(tiles.length / cols);
  const body = tiles.map((t, i) => t.svg.replace('<svg ', `<svg x="${(i % cols) * cw}" y="${Math.floor(i / cols) * ch}" `)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${rows * ch}"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
}
