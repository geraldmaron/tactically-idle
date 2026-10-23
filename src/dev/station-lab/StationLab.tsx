// Dev only: the station-rebuild primitives on one page, at /lab?station (src/main.tsx folds this away
// from a normal build, and scripts/check-no-lab.mjs checks it). Store-free like the rest of the lab: the
// Beat here is driven by a local controller and its command sender always succeeds.
import { useEffect, useMemo, useRef, useState } from 'react';
import '../../ui/app.css';
import '../../ui/skin.css';
import './station-lab.css';
import { Face } from '../../ui/components/Face';
import { BeatContext, BeatLayer, useBeat } from '../../ui/components/Beat';
import { createBeatApi, createBeatController } from '../../ui/components/beat-controller';
import { SceneHotspots, type Hotspot, type HotspotState } from '../../ui/components/SceneHotspots';
import { rotation, turnedLine, type StoryPerson } from '../../ui/people/story-line';
import { playSting, startStationAmbience, stopStationAmbience, STING_KINDS, type StingKind } from '../../ui/audio/live-audio';
import { reducedMotion } from '../../ui/motion';
import { readSettings, updateSettings } from '../../ui/settings/prefs';
import { PERSONAS } from '../../content/personas';
import { PATROL_GRADES } from '../../sim/patrol';

const portrait = (id: string) => `art/portraits/${id}.webp`;
const BROOKS = PERSONAS.find((p) => p.surname === 'Brooks') ?? PERSONAS[1];
const CHEN = PERSONAS.find((p) => p.surname === 'Chen') ?? PERSONAS[0];

const ROOMS: { id: string; label: string; x: number; y: number; w: number; h: number; image?: string }[] = [
  { id: 'academy', label: 'Academy', x: 6, y: 36, w: 22, h: 28 },
  { id: 'armory', label: 'Armory', x: 34, y: 40, w: 20, h: 26, image: 'art/plates/scene_armory_counter.webp' },
  { id: 'garage', label: 'Garage', x: 60, y: 44, w: 18, h: 24 },
  { id: 'range', label: 'Range', x: 82, y: 58, w: 7, h: 12 },
  { id: 'lockers', label: 'Lockers', x: 14, y: 70, w: 22, h: 22, image: 'art/rooms/not-painted-yet.webp' },
];

function BeatDemo() {
  const beat = useBeat();
  const [taps, setTaps] = useState(0);
  const crest = { face: { src: portrait(BROOKS.id), kind: 'officer' as const, name: 'Brooks' } };
  return <section className="lab-section" aria-label="Beat">
    <h2>Beat</h2>
    <p>About 1.5 seconds, over the screen, never blocks a tap. Tapping the counter while a beat plays still counts.</p>
    <div className="lab-row">
      <button type="button" onClick={() => beat.play({ stamp: 'Open', ...crest, line: 'That bay has been dark since March.', sting: 'buy' })}>Open</button>
      <button type="button" onClick={() => beat.play({ stamp: 'Signed', face: { src: portrait(CHEN.id), kind: 'officer', name: 'Chen' }, line: 'Chen signs on Monday and brings her own sketchbook.', sting: 'hire' })}>Signed</button>
      <button type="button" onClick={() => beat.play({ stamp: 'Enrolled', ...crest, line: 'Brooks takes the first seat.', sting: 'enrol' })}>Enrolled</button>
      <button type="button" onClick={() => beat.play({ stamp: 'Promoted', ...crest, line: 'Sergeant Brooks, effective today.', sting: 'promotion' })}>Promoted</button>
      <button type="button" onClick={() => beat.play({ stamp: 'Open' })}>Stamp only</button>
    </div>
    <button type="button" className="lab-hold" onClick={() => setTaps(taps + 1)}>Tap me while it plays ({taps})</button>
  </section>;
}

function SceneDemo() {
  const beat = useBeat();
  const [states, setStates] = useState<Record<string, HotspotState>>({ academy: 'lit', armory: 'lit', garage: 'ready', range: 'dark', lockers: 'dark' });
  const hotspots: Hotspot[] = ROOMS.map((room) => ({
    ...room, state: states[room.id],
    status: room.id === 'range' ? 'locked until level 3' : undefined,
    onSelect: () => {
      if (states[room.id] === 'ready') {
        setStates((s) => ({ ...s, [room.id]: 'lit' }));
        beat.play({ stamp: 'Open', face: { src: portrait(BROOKS.id), kind: 'officer', name: 'Brooks' }, line: `The ${room.label.toLowerCase()} has power again.`, sting: 'buy' });
      }
    },
  }));
  return <section className="lab-section" aria-label="Scene hotspots">
    <h2>SceneHotspots</h2>
    <p>Glow is lit, shade is dark, ringed is ready (tap it). The armory carries stand-in art, the lockers point at art that does not exist.</p>
    <SceneHotspots plate="hub_hq" label="Station" hotspots={hotspots} />
  </section>;
}

const OFFICER = { id: 'off_demo', career: { operations: 0, favorable: 0, adverse: 0 }, traits: [] as never[], promotions: [], assignment: null };
const PEOPLE: { name: string; person: StoryPerson; face: { src: string; kind: 'officer' | 'patrol' } }[] = [
  { name: 'Brooks', face: { src: portrait(BROOKS.id), kind: 'officer' }, person: { kind: 'officer', officer: { ...OFFICER, id: 'off_brooks', identityId: BROOKS.id, traits: ['mentor'], promotions: [{ rank: 'sergeant', day: 400, cause: 'after Barricade on Wren Court' }], career: { operations: 14, favorable: 11, adverse: 1 } }, status: { mark: null, band: 'ready', until: null } } },
  { name: 'Chen', face: { src: portrait(CHEN.id), kind: 'officer' }, person: { kind: 'officer', officer: { ...OFFICER, id: 'off_chen', identityId: CHEN.id }, status: { mark: 'strained', band: 'strained', until: null } } },
  { name: 'Ortiz', face: { src: portrait(PERSONAS[2].id), kind: 'officer' }, person: { kind: 'officer', officer: { ...OFFICER, id: 'off_ortiz', identityId: PERSONAS[2].id, assignment: { kind: 'operation', runId: 'r' } as never }, status: { mark: 'deployed', band: 'ready', until: null } } },
  { name: 'Patrol', face: { src: portrait(PERSONAS[5].id), kind: 'patrol' }, person: { kind: 'patrol', gradeName: (grade) => PATROL_GRADES[grade].name, employee: { id: 'patrol_1', profileId: PERSONAS[5].id, grade: 2, serviceHours: 212, training: null, dismissedAt: null } } },
];

function StoryDemo({ now }: { now: number }) {
  const still = reducedMotion();
  return <section className="lab-section" aria-label="Story lines">
    <h2>StoryLine</h2>
    <p>One true line per person, turning over every 8 seconds{still ? ' (held still: reduced motion)' : ''}.</p>
    <ul className="lab-people">
      {PEOPLE.map(({ name, person, face }) => <li key={name}>
        <Face size="md" kind={face.kind} src={face.src} />
        <span><strong>{name}</strong><em>{turnedLine(person, now, still)?.text}</em><small>{rotation(person, now).map((l) => l.kind).join(' / ')}</small></span>
      </li>)}
    </ul>
  </section>;
}

function SoundDemo() {
  const [ambient, setAmbient] = useState(false);
  useEffect(() => () => stopStationAmbience(), []);
  const settings = readSettings();
  return <section className="lab-section" aria-label="Station sound">
    <h2>Station sound</h2>
    <p>Sound setting: {settings.sound ? 'on' : 'muted'}. Reduced motion: {reducedMotion() ? 'yes (silent)' : 'no'}.</p>
    <div className="lab-row">
      {STING_KINDS.map((kind: StingKind) => <button key={kind} type="button" onClick={() => playSting(kind)}>{kind}</button>)}
      <button type="button" aria-pressed={ambient} onClick={() => { if (ambient) stopStationAmbience(); else startStationAmbience(); setAmbient(!ambient); }}>Room tone {ambient ? 'on' : 'off'}</button>
      <button type="button" onClick={() => { updateSettings({ sound: !settings.sound }); setAmbient(ambient); }}>{settings.sound ? 'Mute' : 'Unmute'}</button>
    </div>
  </section>;
}

export function StationLab() {
  // "Hold beats" stretches the clock and freezes the animation at its full frame, to look at one.
  const [hold, setHold] = useState(false);
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const controller = useMemo(() => createBeatController({ setTimer: (fn, ms) => window.setTimeout(fn, holdRef.current ? ms * 8 : ms) }), []);
  const api = useMemo(() => createBeatApi(controller, () => ({ ok: true }), () => undefined), [controller]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  return <div className={`stage${hold ? ' lab-hold-beats' : ''}`}><div className="app">
    <BeatContext.Provider value={api}>
      <main className="lab-station">
        <h1>Station primitives <small>dev only</small></h1>
        <label className="lab-check"><input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} /> Hold beats for inspection</label>
        <BeatDemo />
        <SceneDemo />
        <StoryDemo now={now} />
        <SoundDemo />
      </main>
      <BeatLayer controller={controller} />
    </BeatContext.Provider>
  </div></div>;
}
