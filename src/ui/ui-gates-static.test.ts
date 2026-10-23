// The static UI gates (backlog `ui-gates`, docs/visual-kit.md "UI gates"). Each rule counts its debt in
// source and compares it with src/ui/ui-debt.json, which `npm run ui:baseline` writes: a count that rises
// is new debt, and a count that falls has to be written down so it stays paid. Under the gate, each
// rule has a negative control: a fixture this file owns that must trip the detector, and one that
// must not, so a detector cannot go blind without a test failing.
import { describe, expect, it } from 'vitest';
import {
  STATIC_RULES, collectStatic, countByFile, cssColorFindings, iconCssFindings, iconFindings, kitSemanticsFindings,
  loadSources, rawLengths, spacingFindings, stateFindings, switchFindings, textSizeFindings, tsColorFindings, tsxSpacingFindings,
  tsxTextFindings, variantFindings,
} from '../../scripts/ui-gates/static.mjs';
import { FELL_HELP, RAISED_HELP, compareCounts, readBaseline } from '../../scripts/ui-gates/ratchet.mjs';

declare const process: { cwd(): string; getBuiltinModule(id: 'node:fs'): { readFileSync(path: string, encoding: 'utf8'): string } };
const ROOT = process.cwd();
const baseline = readBaseline(ROOT);
const found = collectStatic(ROOT);
const retiredStaticRules = new Set(['R4.heading', 'R4.section', 'R4.row', 'R4.hidden-glyph']);

describe('ui gates (static): the debt only falls', () => {
  it('reads the source it gates', () => {
    expect(found['R1'].length, 'the CSS scan found no spacing declarations: the scan is blind').toBeGreaterThan(100);
    expect(Object.keys(baseline.static).filter((id) => !retiredStaticRules.has(id)).every((id) => id in STATIC_RULES), 'ui-debt.json names a rule the gate no longer has: run npm run ui:baseline').toBe(true);
  });

  it('keeps ui-debt.json as the generator wrote it', () => {
    for (const [id, entry] of Object.entries(baseline.static)) {
      if (retiredStaticRules.has(id)) continue; // The lead regenerates ui-debt.json after the surfaces settle.
      expect(entry.target, `${id} target`).toBe(0);
      expect(entry.total, `${id}: total is not the sum of its counts (hand edit? run npm run ui:baseline)`).toBe(Object.values(entry.counts).reduce((a, b) => a + b, 0));
    }
  });

  it.each(Object.entries(STATIC_RULES))('%s: %s', (id) => {
    const now = countByFile(found[id]);
    const { rose, fell } = compareCounts(now, baseline.static[id]?.counts);
    const where = (file: string) => found[id].filter((f) => f.file === file.split(':')[0]).slice(-3).map((f) => `    ${f.file}:${f.line} ${f.text}`).join('\n');
    expect(rose.map((r) => `${r}\n${where(r)}`), `${id} rose. ${RAISED_HELP}`).toEqual([]);
    expect(fell, `${id} fell. ${FELL_HELP}`).toEqual([]);
  });
});

/** R13, static half. The rendered half runs the inset fixtures (npm run check:ui). The shell draws
 * the app edge to edge (viewport-fit=cover), so exactly these stylesheets own the insets; a new
 * reference elsewhere would count one inset twice (padding on a parent and on its child). */
const SAFE_AREA_OWNERS = ['src/ui/app.css', 'src/ui/player-navigation.css', 'src/ui/components/sheet-viewport.css', 'src/ui/settings/settings.css', 'src/ui/storefront/storefront.css'];

describe('ui gates (static): safe areas', () => {
  it('draws edge to edge and declares who owns each inset', () => {
    expect(process.getBuiltinModule('node:fs').readFileSync(`${ROOT}/index.html`, 'utf8')).toMatch(/viewport-fit=cover/);
    const users = loadSources(ROOT).css.filter(({ text }) => /env\(\s*safe-area-inset-/.test(text)).map(({ file }) => file).sort();
    expect(users, 'a stylesheet outside the owners reads a safe-area inset: add it to SAFE_AREA_OWNERS here once it is the only place that insets that edge').toEqual(SAFE_AREA_OWNERS.slice().sort());
  });
});

// ----------------------------------------------------------------------- negative controls

const CSS = 'src/ui/fixture.css';
const TSX = 'src/ui/fixture.tsx';
const ui = (body: string) => `import { Section, Row } from '../components/ui';\nexport const X = () => <>${body}</>;`;

describe('ui gates (static): each detector fails what it owns', () => {
  it('R1 counts declarations, not lines, and ignores comments and tokens', () => {
    const bad = spacingFindings(CSS, '.a { padding: 6px 10px; margin-top: 3px; gap: 4px }\n/* padding: 9px */');
    expect(bad.R1).toHaveLength(3);
    expect(bad.R1.map((f) => f.kind)).toEqual(['off-scale', 'off-scale', 'on-scale']);
    const good = spacingFindings(CSS, '.a { padding: var(--sp2) var(--sp4); margin: 0 auto; gap: 0; width: 7px; background: url("data:image/svg+xml;utf8,<svg width=\'9px\'/>") }');
    expect(good.R1).toEqual([]);
    expect(rawLengths('calc(var(--sp2) + 2px)')).toEqual([2]);
    expect(spacingFindings('src/ui/theme.css', ':root { --sp1: 4px; padding: 5px }').R1, 'theme.css defines the tokens').toEqual([]);
  });

  it('R1 sees inline style spacing in TSX', () => {
    expect(tsxSpacingFindings(TSX, 'const s = { padding: 6, gap: "4px 8px" };')).toHaveLength(2);
    expect(tsxSpacingFindings(TSX, 'const s = { padding: 0, margin: "0" };')).toEqual([]);
  });

  it('R3 flags gaps off the scale, only gaps', () => {
    expect(spacingFindings(CSS, '.a { gap: 6px } .b { column-gap: 10px }').R3).toHaveLength(2);
    expect(spacingFindings(CSS, '.a { gap: 8px } .b { padding: 6px }').R3).toEqual([]);
  });

  it('R5 wants the source glyph beside "Basic kit" and the marks for status and outcome', () => {
    const bad = kitSemanticsFindings(TSX, ui('<li><span className="dim">Basic kit</span></li><p>{BASIC_KIT_LINE}</p><Icon name={STATUS_META[s].icon} /><Icon name={OUTCOME_ICON.mixed} />'));
    expect([bad.basicKit.length, bad.status.length, bad.outcome.length]).toEqual([2, 1, 1]);
    const good = kitSemanticsFindings(TSX, ui('<p><Icon name={GEAR_SOURCE_ICON.basic} size={20} />{BASIC_KIT_LINE}</p><Sheet subtitle="Basic kit goes with every officer" />'));
    expect([good.basicKit.length, good.status.length, good.outcome.length]).toEqual([0, 0, 0]);
    expect(kitSemanticsFindings(TSX, ui('<li className="outcome-option"><div><strong>Smoothly</strong></div></li>')).forecast, 'a forecast row without its mark').toHaveLength(1);
    expect(kitSemanticsFindings(TSX, ui('<li className="outcome-option"><div><OutcomeMark band="favorable" /><strong>Smoothly</strong></div></li>')).forecast).toEqual([]);
  });

  it('R7 flags text under the floors in CSS and TSX', () => {
    const css = textSizeFindings(CSS, '.a { font-size: 11px } .b { font: 600 13px/1 x } .c { font-size: var(--s14) } .d { font-size: var(--s12) }');
    expect(css.map((f) => f.kind)).toEqual(['floor', 'sub14', 'sub14']);
    expect(textSizeFindings('src/ui/blueprint/blueprint.css', '.svg { font-size: 3px }'), 'blueprint SVG units are not screen pixels').toEqual([]);
    expect(tsxTextFindings(TSX, 'const a = { fontSize: 10 }; const b = { fontSize: size * .3 }; const c = { fontSize: 16 };').map((f) => f.kind)).toEqual(['floor', 'dynamic']);
  });

  it('R8 flags literal colors in every spelling, outside the theme only', () => {
    const bad = cssColorFindings(CSS, '.a { color: #fff; background: rgba(0,0,0,.5); border: 1px solid red; box-shadow: 0 0 4px hsl(10 20% 30%); fill: color-mix(in srgb, #123456 50%, transparent) }');
    expect(bad).toHaveLength(5);
    const good = cssColorFindings(CSS, '.a { color: var(--t1); background: color-mix(in srgb, var(--act) 20%, transparent); border-color: currentColor; fill: transparent; font-family: Black Ops, serif; background-image: url("data:image/svg+xml,%3Csvg fill=\'%23fff\'/%3E") }');
    expect(good).toEqual([]);
    expect(cssColorFindings('src/ui/theme.css', ':root { --x: #fff }')).toEqual([]);
    expect(cssColorFindings(CSS, '.a { -webkit-mask-image: linear-gradient(#000, transparent) }').map((f) => f.kind), 'masks are the registered alpha-only exception').toEqual(['mask']);
    expect(tsColorFindings(TSX, 'const a = <rect fill="#031a52" stroke={"rgba(1,2,3,.4)"} />; const b = <a href="#cutaway" fill="var(--bp-ink)" />;')).toHaveLength(2);
  });

  it('R9 holds icons to 16, 20 and 24 at stroke 1.75', () => {
    const bad = iconFindings(TSX, ui('<Icon name="a" size={18} /><Icon name="b" size={n} /><Icon name="c" size={16} strokeWidth={2} />'));
    expect([bad.size.length, bad.dynamic.length, bad.stroke.length]).toEqual([1, 1, 1]);
    const good = iconFindings(TSX, ui('<Icon name="a" /><Icon name="b" size={16} /><Icon name="c" size={20} strokeWidth={1.75} /><Icon name="d" size={24} />'));
    expect([good.size.length, good.dynamic.length, good.stroke.length]).toEqual([0, 0, 0]);
    expect(iconCssFindings(CSS, '.btn .icon { width: 18px; height: 18px }')).toHaveLength(1);
    expect(iconCssFindings(CSS, '.btn .icon { width: 20px } .card { width: 18px }')).toEqual([]);
  });

  it('R10 keeps one implementation per family', () => {
    const redefined = variantFindings('src/ui/screens/x.css', '.cl-card .chip { padding: 2px 9px; margin-left: 4px }').redefinition;
    expect(redefined).toHaveLength(1);
    expect(variantFindings('src/ui/screens/x.css', '.prep-foot .btn { flex: 1; margin-top: 4px }').redefinition, 'layout is the caller\'s').toEqual([]);
    expect(variantFindings('src/ui/app.css', '.chip { padding: 2px 9px }').redefinition, 'the owner may define it').toEqual([]);
    expect(variantFindings('src/ui/screens/x.css', '.staff-pill { border-radius: 999px; padding: 2px 8px; font-size: 12px; background: var(--ink-3) }').badge).toHaveLength(1);
    expect(variantFindings('src/ui/screens/x.css', '.card-row { border-radius: 12px; padding: 8px }').badge).toEqual([]);
    expect(switchFindings(TSX, ui('<input type="checkbox" role="switch" /><label className="toggle"><input type="checkbox" /></label>'))).toHaveLength(2);
    expect(switchFindings(TSX, ui('<label><input type="checkbox" /></label>')), 'a plain checkbox is not a switch').toEqual([]);
    expect(switchFindings('src/ui/components/ui.tsx', ui('<input type="checkbox" role="switch" />')), 'ui.tsx owns the shared switch').toEqual([]);
  });

  it('R11 sends empty and failed states through the shared treatment', () => {
    const bad = stateFindings(TSX, ui('<p className="dim">No rules yet.</p><li className="strip-empty">x</li><p className="save-alert" role="alert">Failed</p>'));
    expect([bad.empty.length, bad.error.length]).toEqual([2, 1]);
    const good = stateFindings(TSX, ui('<EmptyState title="No rules yet"><span>No rules yet.</span></EmptyState><p>Nobody home</p>'));
    expect([good.empty.length, good.error.length]).toEqual([0, 0]);
  });
});
