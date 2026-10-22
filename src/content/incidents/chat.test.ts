// The chat that follows a call's pressure (docs/call-pressure.md, "Chat that follows the pressure";
// .agents/skills/swat-call-prose/references/live-chat.md). Gates 1 to 7 of the live-chat request: the
// shape every threat's chat has, the wording rules every line keeps, and the state pools a stream
// needs wherever something in the call can cut, slow, speed or shrink it. They check shape and
// wording. Whether a thread reads as real, narrows, leaks an outcome or trivializes harm is read in
// the Lab (swat-writing-review), never here. Plus the control the shape was approved on: chat is
// presentation, so a call compiles to the same mechanics with and without it.
import { describe, expect, it } from 'vitest';
import { META_PHRASING, SUICIDE_METHOD, UNSAFE_DETAIL } from '../../gen/incident/gates/prose-lint';
import { generateIncident } from '../../gen/incident';
import type { ChatLine, CallTree, TreeThreat } from '../call-trees/types';
import type { Clock, IncidentTemplate } from './types';
import { WORLD_TOKENS } from '../world';
import { INCIDENT_TEMPLATES } from '.';
import { HOSTAGE_LIVE } from '../call-trees/hostage-live';

/** A phase's thread: long enough to fill its phase at Standard, short enough not to be cut off there. */
const THREAD_MIN = 5, THREAD_MAX = 7;
const STATE_POOL_MIN = 3;
const LINE_MAX = 60;
/** Emoji on at most this share of a call's chat lines. */
const EMOJI_SHARE_MAX = 0.22;
const ALLOWED_EMOJI = ['👀', '📍', '🙏', '😳', '😬', '😢', '😮', '🤞', '❤️'];
const GENDERED = /\b(he|she|him|her|his|hers|himself|herself|bro|dude|man|girl|guy|sis)\b/i;
const HARM_WORD = /\b(hurt|shot|shoot|gun|handgun|dead|die|dies|blood|kill|killed|police|cops?)\b/i;
const STREET_ADDRESS = /\d+\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const graphemes = (text: string) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)].length;

interface Used { template: IncidentTemplate; tree: CallTree; clock: Clock }
/** Every call whose stream carries a chat (a pressure source with reactions). */
const used: Used[] = Object.values(INCIDENT_TEMPLATES).flatMap(template => {
  const clock = template!.situations.flatMap(situation => situation.clocks ?? []).find(c => c.source?.reactions);
  return clock ? [{ template: template!, tree: template!.tree, clock }] : [];
});

const text = (line: ChatLine) => typeof line === 'string' ? line : line.text;
const speaker = (line: ChatLine) => typeof line === 'string' ? undefined : line.by;
const threatsOf = (tree: CallTree): [string, TreeThreat][] => tree.nodes.flatMap(node => node.threat ? [[node.id, node.threat] as [string, TreeThreat]] : []);
/** Every line of a call's chat, in thread order, with where it lives. */
function allLines({ tree, clock }: Used) {
  const reactions = clock.source!.reactions!;
  const pools: [string, string[]][] = [...reactions.byCue.map((pool, i): [string, string[]] => [`cue ${i}`, pool]), ['spike', reactions.spike ?? []],
    ...(['stopped', 'slowed', 'surged', 'dropped'] as const).map((key): [string, string[]] => [key, reactions[key] ?? []])];
  const lines = pools.flatMap(([where, pool]) => pool.map(line => ({ where, line, by: undefined as string | undefined })));
  for (const [id, threat] of threatsOf(tree)) {
    if (!threat.chat) continue;
    for (const phase of ['early', 'closing', 'imminent'] as const) for (const line of threat.chat[phase]) lines.push({ where: `${id}.${phase}`, line: text(line), by: speaker(line) });
  }
  return lines;
}
const tokenIsKnown = (token: string, tree: CallTree) => {
  const role = /^\{([a-z_]+)\.(first|full)\}$/.exec(token)?.[1];
  return (role && tree.roles.some(r => r.id === role)) || WORLD_TOKENS.includes(token.slice(1, -1));
};
const fourWordRuns = (line: string) => {
  const words = line.toLowerCase().replace(/\p{Extended_Pictographic}|️/gu, ' ').replace(/[^a-z0-9’' {}._]/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, -3).map((_, i) => words.slice(i, i + 4).join(' '));
};

describe('chat that follows the pressure', () => {
  it('finds the calls that use it', () => expect(used.length).toBeGreaterThan(0));

  describe.each(used.map(u => [u.tree.type, u] as const))('%s', (_, u) => {
    const { tree, clock } = u;
    const reactions = clock.source!.reactions!;

    it('gives every threat all three phases at the thread length, or says the stream is down', () => {
      for (const [id, threat] of threatsOf(tree)) {
        expect(threat.chat, `${id} has a chat`).not.toBeUndefined();
        if (threat.chat === false) continue;
        for (const phase of ['early', 'closing', 'imminent'] as const) {
          const count = threat.chat![phase].length;
          expect(count, `${id}.${phase}`).toBeGreaterThanOrEqual(THREAD_MIN);
          expect(count, `${id}.${phase}`).toBeLessThanOrEqual(THREAD_MAX);
        }
      }
    });

    it('keeps every line inside the wording rules', () => {
      for (const { where, line } of allLines(u)) {
        expect(graphemes(line), `${where}: ${line}`).toBeLessThanOrEqual(LINE_MAX);
        expect(line, `${where}: no dashes or colons`).not.toMatch(/[—–:]|\s-\s/);
        expect(line, `${where}: gendered word`).not.toMatch(GENDERED);
        expect(line, where).not.toMatch(UNSAFE_DETAIL);
        expect(line, where).not.toMatch(SUICIDE_METHOD);
        expect(line, where).not.toMatch(META_PHRASING);
        for (const token of line.match(/\{[^}]+\}/g) ?? []) expect(tokenIsKnown(token, tree), `${where}: ${token}`).toBe(true);
      }
    });

    it('never says a line twice or repeats a 4-word run across the whole call', () => {
      const lines = allLines(u).map(entry => entry.line);
      expect(lines.filter((line, i) => lines.indexOf(line) !== i)).toEqual([]);
      const runs = lines.flatMap(line => [...new Set(fourWordRuns(line))].map(run => [run, line] as const));
      expect(runs.filter(([run], i) => runs.findIndex(([other]) => other === run) !== i)).toEqual([]);
    });

    it('uses only the allowed emoji, sparingly, and never beside harm', () => {
      const lines = allLines(u);
      const withEmoji = lines.filter(entry => EMOJI.test(entry.line));
      expect(withEmoji.length / lines.length, 'share of lines with an emoji').toBeLessThanOrEqual(EMOJI_SHARE_MAX);
      for (const { where, line, by } of withEmoji) {
        const kinds = new Set(line.match(/\p{Extended_Pictographic}️?/gu));
        expect(kinds.size, `${where}: one kind a line: ${line}`).toBe(1);
        expect([...kinds].every(kind => ALLOWED_EMOJI.includes(kind)), `${where}: ${line}`).toBe(true);
        expect(line, `${where}: no skin tone or joined sequence`).not.toMatch(/[‍\u{1F3FB}-\u{1F3FF}]/u);
        expect(line, `${where}: no emoji beside a harm word`).not.toMatch(HARM_WORD);
        expect(by, `${where}: no emoji on a named speaker's line`).toBeUndefined();
      }
      for (const [id, threat] of threatsOf(tree)) {
        if (!threat.chat) continue;
        const thread = [...threat.chat.early, ...threat.chat.closing, ...threat.chat.imminent].map(text);
        thread.forEach((line, i) => { if (i && EMOJI.test(line)) expect(thread[i - 1], `${id}: emoji straight after a harm line: ${line}`).not.toMatch(HARM_WORD); });
      }
    });

    it('ends a threat that names a {handle} on that commenter, and orders nothing behind a beat it lacks', () => {
      for (const [id, threat] of threatsOf(tree)) {
        if (!threat.chat) continue;
        const beats = new Set((threat.beats ?? []).map(beat => beat.id));
        if (`${threat.label} ${threat.text}`.includes('{handle}')) {
          expect(speaker(threat.chat.imminent.at(-1)!), `${id}: the poster has the last line`).toBe('{handle}');
          for (const line of [...threat.chat.early, ...threat.chat.closing, ...threat.chat.imminent]) if (speaker(line) === '{handle}') expect(text(line), `${id}: no address in the poster's line`).not.toMatch(STREET_ADDRESS);
        }
        for (const line of [...threat.chat.early, ...threat.chat.closing, ...threat.chat.imminent]) {
          const waits = typeof line === 'string' ? undefined : line.after;
          if (waits) expect(beats.has(waits), `${id}: ${text(line)} waits for ${waits}`).toBe(true);
        }
      }
    });

    it('has a state pool wherever anything in the call can cut, slow, speed or shrink the stream', () => {
      const id = clock.id;
      const bumps: number[] = [];
      let stabilizes = false;
      for (const node of tree.nodes) {
        const threat = node.threat;
        for (const bump of [threat?.bump, ...(threat?.beats ?? []).map(beat => beat.bump)]) if (bump?.[id] !== undefined) bumps.push(bump[id]);
        for (const choice of node.choices) for (const band of ['favorable', 'mixed', 'adverse'] as const) for (const outcome of choice.outcomes[band]) {
          if (outcome.bump?.[id] !== undefined) bumps.push(outcome.bump[id]);
          if (outcome.stabilize?.includes(id)) stabilizes = true;
        }
      }
      const pool = (key: 'stopped' | 'slowed' | 'surged' | 'dropped') => reactions[key] ?? [];
      if (stabilizes || bumps.some(bump => bump <= -100)) expect(pool('stopped').length, 'stopped').toBeGreaterThanOrEqual(STATE_POOL_MIN);
      if (bumps.some(bump => bump <= -100 / 7)) expect(pool('dropped').length, 'dropped').toBeGreaterThanOrEqual(STATE_POOL_MIN);
      if (clock.rateFlags?.length) expect(pool('slowed').length, 'slowed').toBeGreaterThanOrEqual(STATE_POOL_MIN);
      if (clock.source!.surges?.length) expect(pool('surged').length, 'surged').toBeGreaterThanOrEqual(STATE_POOL_MIN);
    });
  });

  it('compiles a call to the same mechanics with the chat and the state pools and without them', () => {
    const spec = { type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 3, tier: 2, contentVersion: 13 } as const;
    const withChat = JSON.parse(JSON.stringify(generateIncident(spec)));
    const saved = new Map<TreeThreat, TreeThreat['chat']>();
    const pools: [Record<string, unknown>, Record<string, unknown>][] = [];
    for (const node of HOSTAGE_LIVE.nodes) if (node.threat) { saved.set(node.threat, node.threat.chat); delete node.threat.chat; }
    for (const situation of INCIDENT_TEMPLATES.hostage_crisis!.situations) for (const clock of situation.clocks ?? []) {
      const reactions = clock.source?.reactions as Record<string, unknown> | undefined;
      if (reactions) { pools.push([reactions, { stopped: reactions.stopped, slowed: reactions.slowed, surged: reactions.surged, dropped: reactions.dropped }]); for (const key of ['stopped', 'slowed', 'surged', 'dropped']) delete reactions[key]; }
    }
    let without: unknown;
    try { without = JSON.parse(JSON.stringify(generateIncident(spec))); } finally {
      for (const [threat, chat] of saved) if (chat !== undefined) threat.chat = chat;
      for (const [reactions, restore] of pools) Object.assign(reactions, restore);
    }
    // What the chat adds: the threat's chat on each shown threat, and the four state pools on the stream.
    for (const stage of Object.values<{ contextPrompts?: { threat?: Record<string, unknown> }[] }>(withChat.stages)) for (const entry of stage.contextPrompts ?? []) if (entry.threat) delete entry.threat.chat;
    for (const clock of withChat.clocks ?? []) if (clock.source?.reactions) for (const key of ['stopped', 'slowed', 'surged', 'dropped']) delete clock.source.reactions[key];
    expect(withChat).toEqual(without);
  });

  describe('the compiler refuses a chat that cannot play', () => {
    const spec = { type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 3, tier: 2, contentVersion: 13 } as const;
    /** Compile with `change` applied to going_live's chat, then put it back. */
    const compileWith = (change: (chat: NonNullable<TreeThreat['chat']> & object) => void) => {
      const threat = HOSTAGE_LIVE.nodes.find(node => node.id === 'going_live')!.threat!;
      const saved = threat.chat;
      threat.chat = structuredClone(saved) as typeof threat.chat;
      try { change(threat.chat as NonNullable<TreeThreat['chat']> & object); return generateIncident(spec); } finally { threat.chat = saved; }
    };
    it('throws on a speaker that is neither {handle} nor a role of the call', () => {
      expect(() => compileWith(chat => { chat.early[0] = { by: '{nobody.first}', text: 'hi' }; })).toThrow(/neither \{handle\} nor a role/);
    });
    it('throws on a line waiting for a beat the threat does not have', () => {
      expect(() => compileWith(chat => { chat.closing[0] = { text: 'hi', after: 'no_such_beat' }; })).toThrow(/not a beat of this threat/);
    });
    it('throws when a threat that names a {handle} does not end on that commenter', () => {
      expect(() => compileWith(chat => { chat.imminent[chat.imminent.length - 1] = 'typing it now'; })).toThrow(/last imminent chat line must be by \{handle\}/);
    });
  });
});
