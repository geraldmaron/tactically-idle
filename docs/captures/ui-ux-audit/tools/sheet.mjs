// Builds JPG contact sheets from capture PNGs, one sheet per screen prefix.
// Usage: node sheet.mjs <repo> <capsDir> <outDir> <width> <prefix,prefix,...> [tileWidth]
import { createRequire } from 'node:module';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [repo, capsDir, outDir, width, prefixes, tileArg] = process.argv.slice(2);
const require = createRequire(path.join(repo, 'package.json'));
const { chromium } = require('playwright-core');
const tile = Number(tileArg ?? 300);
const files = (await readdir(path.join(capsDir, width))).filter((f) => f.endsWith('.png')).sort();
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1.5 });
for (const prefix of prefixes.split(',')) {
  const group = files.filter((f) => f.startsWith(prefix));
  if (!group.length) { console.log('none', prefix); continue; }
  const html = `<html><body style="margin:0;background:#2a2f38;font:12px system-ui;color:#ddd;display:flex;gap:8px;padding:8px;align-items:flex-start">${group.map((f) =>
    `<figure style="margin:0;width:${tile}px"><img style="width:${tile}px;display:block" src="${pathToFileURL(path.join(capsDir, width, f))}"><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('')}</body></html>`;
  await page.setViewportSize({ width: group.length * (tile + 8) + 8, height: 400 });
  const tmp = path.join(outDir, '_sheet.html'); await writeFile(tmp, html); await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  const out = path.join(outDir, `${prefix}-${width}.jpg`);
  await page.screenshot({ path: out, type: 'jpeg', quality: 72, fullPage: true });
  console.log(out);
}
await browser.close();
