// Review notes: anchors from every selection kind, current / changed / orphaned status against the
// authored text, pins on Script rows, muting lint, and the export in the review skill's row shape
// (.agents/skills/swat-writing-review/SKILL.md, section 11).
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { lintTree } from '../../../gen/incident/trees-v13/dependencies';
import { CLOCK_FIXTURE_IDS, clockFixtureTemplate } from '../../../gen/incident/gates/clock-fixture';
import type { NotesFile, ReviewNote, Selection } from '../types';
import { parseSelection } from '../url';
import REVIEW_DRAWER from '../surfaces/review/index.tsx?raw';
import { emptyNotes } from './endpoints';
import {
  anchorCovers, anchorFor, anchorNode, anchorText, browserOnlyNotes, CALL_ANCHOR, contentHash, drawText, fieldPath, findingRow, findingsMarkdown, mutedFindings,
  mergeNotes, muteNote, noteStatus, pinRow, withNote, withoutNote,
} from './notes';

const hostage = INCIDENT_TEMPLATES.hostage_crisis as IncidentTemplate;
const URL = 'http://localhost:5173/lab?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1&tab=play&sel=choice:offer/take_courier';

function note(anchor: string, over: Partial<ReviewNote> = {}): ReviewNote {
  const text = anchorText(anchor, { template: hostage }) ?? '';
  return { id: `n-${anchor}`, type: 'hostage_crisis', anchor, severity: 'fix', rule: 'fake-choice 4', route: 'swat-call-prose', sees: 'Walk Ana out first.',
    fix: 'Walk Ana out now.', text: 'Preview is softer than its worst result.', at: 1, draw: { situation: 1, call: 2 }, url: URL, contentHash: contentHash(text), ...over };
}

/** A deep copy of the hostage template with one tree edit applied. */
function edited(edit: (t: IncidentTemplate) => void): IncidentTemplate {
  const copy = structuredClone(hostage);
  edit(copy);
  return copy;
}

describe('anchors', () => {
  const offer = hostage.tree.nodes.find(node => node.id === 'offer')!;
  const choice = offer.choices[0];
  const lint = lintTree(hostage);
  const selections: Selection[] = [
    { kind: 'node', node: 'offer' },
    { kind: 'choice', node: 'offer', choice: choice.id },
    { kind: 'band', node: 'offer', choice: choice.id, band: 'mixed' },
    { kind: 'ending', ending: 'handed_over' },
    { kind: 'key', key: 'mark:turned' },
    { kind: 'string', row: `offer.${choice.id}.preview.adverse` },
    { kind: 'field', path: 'RESOLUTION_TUNING.favorableAt' },
    { kind: 'finding', id: lint[0].id },
  ];

  it('anchors every selection kind as it reads in the URL, and reads its text back', () => {
    expect(selections.map(anchorFor)).toEqual([
      'node:offer', `choice:offer/${choice.id}`, `band:offer/${choice.id}/mixed`, 'ending:handed_over', 'key:mark:turned',
      `string:offer.${choice.id}.preview.adverse`, 'field:RESOLUTION_TUNING.favorableAt', `finding:${lint[0].id}`,
    ]);
    for (const sel of selections) {
      expect(parseSelection(anchorFor(sel))).toEqual(sel);
      expect(anchorText(anchorFor(sel), { template: hostage }), anchorFor(sel)).toBeTruthy();
    }
    expect(anchorText(`choice:offer/${choice.id}`, { template: hostage })).toContain(choice.preview.adverse);
    expect(anchorText(`string:offer.${choice.id}.preview.adverse`, { template: hostage })).toBe(choice.preview.adverse);
    expect(anchorText(CALL_ANCHOR, { template: hostage })).toContain(hostage.tree.title);
  });

  it('names the field path a finding row carries', () => {
    expect(selections.map(sel => fieldPath(anchorFor(sel)))).toEqual([
      'offer.prompt', `offer.${choice.id}`, `offer.${choice.id}.mixed`, 'ending.handed_over', 'state mark:turned',
      `offer.${choice.id}.preview.adverse`, 'RESOLUTION_TUNING.favorableAt', `lint ${lint[0].id}`,
    ]);
  });

  it('pins a note on the row it is about, and covers the rows under it', () => {
    expect(pinRow(`choice:offer/${choice.id}`)).toBe(`offer.${choice.id}.title`);
    expect(pinRow(`band:offer/${choice.id}/adverse`)).toBe(`offer.${choice.id}.preview.adverse`);
    expect(pinRow('string:talking.promptIf[1]@s2')).toBe('talking.promptIf[1]');
    expect(pinRow('key:mark:turned')).toBeNull();
    expect(anchorCovers(`choice:offer/${choice.id}`, `offer.${choice.id}.adverse[0]`)).toBe(true);
    expect(anchorCovers(`choice:offer/${choice.id}`, 'offer.prompt')).toBe(false);
    expect(anchorCovers(`band:offer/${choice.id}/adverse`, `offer.${choice.id}.adverse[1]`)).toBe(true);
    expect(anchorCovers(`band:offer/${choice.id}/adverse`, `offer.${choice.id}.mixed[0]`)).toBe(false);
    expect(anchorCovers('node:offer', `offer.${choice.id}.title`)).toBe(true);
    expect(anchorNode(`band:offer/${choice.id}/adverse`)).toBe('offer');
    expect(anchorNode('string:talking.promptIf[1]')).toBe('talking');
    expect(anchorNode('string:briefing.known[0]')).toBeNull();
  });
});

describe('note status', () => {
  const choice = hostage.tree.nodes.find(node => node.id === 'offer')!.choices[0];
  const anchor = `choice:offer/${choice.id}`;
  const n = note(anchor);

  it('is current while the anchored text is unchanged', () => {
    expect(noteStatus(n, a => anchorText(a, { template: hostage }))).toBe('current');
  });

  it('is changed when one word of the anchored string changes', () => {
    const t = edited(copy => { const c = copy.tree.nodes.find(node => node.id === 'offer')!.choices[0]; c.preview.mixed = c.preview.mixed.replace(/\w+/, 'Somehow'); });
    expect(noteStatus(n, a => anchorText(a, { template: t }))).toBe('changed');
    // A note on another choice is untouched by that edit.
    const other = note(`choice:offer/${hostage.tree.nodes.find(node => node.id === 'offer')!.choices[1].id}`);
    expect(noteStatus(other, a => anchorText(a, { template: t }))).toBe('current');
  });

  it('is orphaned when the anchor is gone', () => {
    const t = edited(copy => { const offer = copy.tree.nodes.find(node => node.id === 'offer')!; offer.choices = offer.choices.slice(1); });
    expect(noteStatus(n, a => anchorText(a, { template: t }))).toBe('orphaned');
    expect(noteStatus(note('ending:nowhere'), a => anchorText(a, { template: hostage }))).toBe('orphaned');
    expect(noteStatus(note('finding:dead_write:mark:nothing'), a => anchorText(a, { template: hostage }))).toBe('orphaned');
  });

  it('keeps a finding from runs current (runs may just not have happened yet)', () => {
    expect(noteStatus(note('finding:never_reached:ending:owner_killed'), a => anchorText(a, { template: hostage }))).toBe('current');
  });

  it('reads tuning fields through the resolver it is given', () => {
    const n2 = note('field:RESOLUTION_TUNING.favorableAt', { contentHash: contentHash('8') });
    expect(noteStatus(n2, a => anchorText(a, { template: hostage, field: () => '8' }))).toBe('current');
    expect(noteStatus(n2, a => anchorText(a, { template: hostage, field: () => '10' }))).toBe('changed');
    expect(noteStatus(n2, a => anchorText(a, { template: hostage, field: () => null }))).toBe('orphaned');
  });

  it('treats a note left by the old lab (no hash) as current', () => {
    expect(noteStatus({ ...n, contentHash: '' }, a => anchorText(a, { template: hostage }))).toBe('current');
  });
});

describe('muting lint', () => {
  const finding = lintTree(hostage).find(entry => entry.code === 'threat_only')!;
  const muted = muteNote(finding, 'Kept: command approval is the point of this mark.', { type: 'hostage_crisis', url: URL, draw: { situation: 1, call: 2 } });

  it('writes an accepted note anchored to the finding, which then leaves every count', () => {
    expect(muted.anchor).toBe(`finding:${finding.id}`);
    expect(muted.anchor).toBe('finding:threat_only:mark:turned');
    expect(muted.severity).toBe('accepted');
    expect(muted.text).toBe('Kept: command approval is the point of this mark.');
    const file: NotesFile = withNote({ v: 1, type: 'hostage_crisis', verdict: null, notes: [note('node:offer')] }, muted);
    expect([...mutedFindings(file).keys()]).toEqual([finding.id]);
    expect(noteStatus(muted, a => anchorText(a, { template: hostage }))).toBe('current');
    expect(withoutNote(file, muted.id).notes).toHaveLength(1);
  });
});

describe('merging after the file changed on disk', () => {
  it('keeps what this page added, changed or removed, and everything else from disk', () => {
    const a = note('node:offer'), b = note('node:talking'), c = note('ending:owner_killed');
    const base: NotesFile = { v: 1, type: 'hostage_crisis', verdict: null, notes: [a, b] };
    // This page edits a, removes b and adds c.
    const mine: NotesFile = { ...base, notes: [{ ...a, text: 'Edited here.' }, c] };
    // Meanwhile another page added d and set the verdict.
    const d = note('node:fired_on');
    const disk: NotesFile = { ...base, verdict: { value: 'edit', at: 5 }, notes: [a, b, d] };
    const merged = mergeNotes(base, mine, disk);
    expect(merged.notes.map(entry => entry.id)).toEqual([a.id, d.id, c.id]);
    expect(merged.notes[0].text).toBe('Edited here.');
    expect(merged.verdict).toEqual({ value: 'edit', at: 5 });
    // A verdict this page changed wins.
    expect(mergeNotes(base, { ...mine, verdict: { value: 'approve', at: 9 } }, disk).verdict).toEqual({ value: 'approve', at: 9 });
  });

  it('keeps every note of a page that read its notes from this browser (review finding notes-kept-in-browser-hidden)', () => {
    // The drawer merges against an empty base when its notes came from this browser, not the file.
    const kept = note('node:offer'), added = note('node:talking'), other = note('node:fired_on');
    const mine: NotesFile = { v: 1, type: 'hostage_crisis', verdict: null, notes: [kept, added] };
    const disk: NotesFile = { v: 1, type: 'hostage_crisis', verdict: null, notes: [other] };
    expect(mergeNotes(emptyNotes('hostage_crisis'), mine, disk).notes.map(entry => entry.id)).toEqual([other.id, kept.id, added.id]);
    // Against the browser copy as base, the note saved while the server was down would be lost.
    expect(mergeNotes(mine, { ...mine, notes: [kept, added] }, disk).notes.map(entry => entry.id)).not.toContain(kept.id);
    expect(REVIEW_DRAWER).toMatch(/const base = notes\.shared \? notes\.file : emptyNotes\(template\.type\);/);
  });
});

describe('notes kept in this browser (review finding notes-kept-in-browser-hidden)', () => {
  it('offers notes the browser holds that the file lacks, whether the old lab left them or a save while the server was down', () => {
    const inFile = note('node:offer'), sameText = { ...note('node:talking'), id: 'n-other-id' }, onlyHere = note('ending:owner_killed'), old = { ...note('node:fired_on'), id: 'old-0' };
    const file: NotesFile = { v: 1, type: 'hostage_crisis', verdict: null, notes: [inFile, note('node:talking')] };
    const browser: NotesFile = { v: 1, type: 'hostage_crisis', verdict: null, notes: [inFile, sameText, onlyHere, old] };
    expect(browserOnlyNotes(file, browser).map(entry => entry.id)).toEqual([onlyHere.id, old.id]);
    expect(browserOnlyNotes(file, emptyNotes('hostage_crisis'))).toEqual([]);
    // The drawer reads both shapes the browser can hold, not only the old lab's list.
    expect(REVIEW_DRAWER).toMatch(/setOldNotes\(browserOnlyNotes\(notes\.file, readLocalNotes\(template\.type\)\)\)/);
    expect(REVIEW_DRAWER).not.toMatch(/Array\.isArray\(raw\)/);
  });
});

describe('export', () => {
  // swat-writing-review/SKILL.md:332-334
  const ROW = /^\[(block|fix before freeze|note)\] [^|]+ \| [^|]+ \| sees '[^']*(?:'[^|]*)?' \| rule [^|]+ \| fix as data '[^|]*' \| route (swat-call-design|swat-call-prose|swat-officer-stories|engineering|owner)$/;
  const choice = hostage.tree.nodes.find(node => node.id === 'offer')!.choices[0];

  it('writes one row per note in the review skill shape', () => {
    const row = findingRow(note(`choice:offer/${choice.id}`));
    expect(row).toMatch(ROW);
    expect(row).toBe(`[fix before freeze] hostage_crisis, s2, market_row seed 7 call 2 | offer.${choice.id} | sees 'Walk Ana out first.' | rule fake-choice 4 | fix as data 'Walk Ana out now.' | route swat-call-prose`);
  });

  it('keeps a row on one line with no stray column bars', () => {
    const row = findingRow(note('node:offer', { sees: 'Line one.\nLine two | three', fix: 'A\nB', severity: 'block', route: 'swat-call-design' }));
    expect(row).toMatch(ROW);
    expect(row.split('\n')).toHaveLength(1);
    expect(row).toContain("sees 'Line one. / Line two / three'");
  });

  it('names an id-only draw by its id', () => {
    expect(drawText(note('node:offer', { url: 'http://x/lab?id=gen:hostage_crisis:market_row:7:2:2:13' }))).toBe('hostage_crisis, s2, gen:hostage_crisis:market_row:7:2:2:13');
  });

  it('exports the verdict line, rows blockers first, links, and lint kept on purpose', () => {
    // A lint finding to keep on purpose, from an owned fixture so a content change can't remove it.
    const finding = lintTree(clockFixtureTemplate()).find(entry => entry.code === 'clock_writer')!;
    const file: NotesFile = { v: 1, type: 'hostage_crisis', verdict: { value: 'edit', at: 5 }, notes: [
      note('node:offer', { id: 'a', severity: 'note', at: 1 }),
      note(`choice:offer/${choice.id}`, { id: 'b', severity: 'block', at: 2, route: 'swat-call-design' }),
      muteNote(finding, 'The owner collapsing is meant to set it.', { type: 'hostage_crisis', url: URL, draw: { situation: 0, call: 1 } }),
    ] };
    const md = findingsMarkdown(file, 'One Last Signature', n => `<${n.url}>`);
    expect(md).toContain('Verdict hostage_crisis v13 | edit | block 1 | fix before freeze 0 | note 1 | ships in ?');
    const rows = md.split('\n').filter(line => line.startsWith('['));
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toMatch(ROW);
    expect(rows[0].startsWith('[block]')).toBe(true);
    expect(md).toContain(`<${URL}>`);
    expect(md).toContain('## Lint kept on purpose');
    expect(md).toContain(`lint clock_writer:mark:${CLOCK_FIXTURE_IDS.outMark}: The owner collapsing is meant to set it.`);
  });

  it('says when nothing is open', () => {
    expect(findingsMarkdown({ v: 1, type: 'hostage_crisis', verdict: null, notes: [] }, 'One Last Signature', () => '')).toContain('No open findings.');
  });
});
