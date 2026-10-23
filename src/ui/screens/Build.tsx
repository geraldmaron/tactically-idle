// Build: the station. The diorama is the screen, with a tap target for each room; below it the one room
// worth building next, a card for every room, and the plain index of every upgrade. A room opens its
// sheet, and a purchase plays a beat instead of a toast, lights the room, and closes the sheet.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEV_NODES } from '../../content/dev-tree';
import { nodeOptions } from '../../sim/department-selectors';
import type { Id } from '../../sim/types';
import { useBeat } from '../components/Beat';
import { Disclosure } from '../components/Disclosure';
import { useNow } from '../components/incident';
import { useNav } from '../components/nav';
import { Section } from '../components/ui';
import { useReducedMotion } from '../motion';
import { useStationAmbience } from '../audio/useStationAmbience';
import { useGame } from '../store';
import { UpgradeIndex } from './Develop';
import { GarageCard, NextCard, RoomCard } from './build/RoomCard';
import { RoomSheet, defaultStep } from './build/RoomSheet';
import { Station, stationRooms } from './build/Station';
import { garageView, nextForStation, personById, roomViews, stepHelp, viewOfNode, viewOfRoom } from './build/room-model';
import type { RoomId } from './build/rooms';
import './build.css';

/** How long a newly opened room keeps its fade-in marker. */
const FRESH_MS = 1800;

/** Department facilities and development. Equipment purchases live in the Store. */
export function BuildScreen() {
  useStationAmbience();
  const nav = useNav();
  const game = useGame();
  const beat = useBeat();
  const now = useNow(30_000);
  const still = useReducedMotion();
  const [open, setOpen] = useState<{ room: RoomId; node?: Id } | null>(null);
  const [fresh, setFresh] = useState<RoomId | null>(null);
  const [pending, setPending] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const options = useMemo(() => nodeOptions(game), [game]);
  const views = useMemo(() => roomViews(game, options), [game, options]);
  const garage = garageView(game);
  const rooms = stationRooms(views, garage);
  const next = nextForStation(views);

  // A link from Training, the Armory or Command Staff names a step: open its room with that step chosen.
  useEffect(() => {
    if (!nav.developmentNode || !DEV_NODES[nav.developmentNode]) return;
    const view = viewOfNode(roomViews(game), nav.developmentNode);
    if (view) setOpen({ room: view.room.id, node: nav.developmentNode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.developmentNode, nav.developmentRequest]);
  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => setFresh(null), FRESH_MS);
    return () => clearTimeout(timer);
  }, [fresh]);

  const openRoom = (room: RoomId, node?: Id) => room === 'garage' ? nav.setTeamSection('patrol') : setOpen({ room, node });
  const view = open ? viewOfRoom(views, open.room) : undefined;
  const step = view ? defaultStep(view, open?.node) : undefined;

  const build = () => {
    if (!view || !step?.targetTier || pending) return;
    const help = stepHelp(game, step);
    const row = help.rows.find((r) => r.officerIds.length) ?? help.rows[0];
    const person = row?.officerIds[0] ? personById(game, row.officerIds[0]) : undefined;
    setPending(true);
    try {
      const result = beat.act({ type: 'unlockNode', nodeId: step.node.id, expectedTier: step.targetTier }, {
        stamp: view.open ? 'Built' : 'Open',
        face: person ? { officer: person, kind: 'officer', name: person.surname } : undefined,
        line: row?.reaction,
        sting: 'buy',
      });
      if (result.ok) {
        setFresh(view.room.id);
        setOpen(null);
        top.current?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
      }
    } finally { setPending(false); }
  };

  return <div className="page build-page" ref={top}>
    <h1 className="sr-only">Build</h1>
    <Station rooms={rooms} name={game.department.name} fresh={fresh} onOpen={(id) => openRoom(id)} />
    {next && <NextCard game={game} view={next} now={now} onOpen={() => openRoom(next.room.id, next.next!.node.id)} />}
    <Section title="Rooms" icon="build" id="build-rooms">
      <div className="card room-list" data-ui-list>
        {views.map((v) => <RoomCard key={v.room.id} game={game} view={v} now={now} onOpen={() => openRoom(v.room.id)} />)}
        <GarageCard garage={garage} onOpen={() => openRoom('garage')} />
      </div>
    </Section>
    <Disclosure name="all-department-upgrades" summary="All upgrades" icon="build">
      <UpgradeIndex views={views} funding={game.department.funding} onOpen={(nodeId) => openRoom(viewOfNode(views, nodeId)!.room.id, nodeId)} />
    </Disclosure>
    {view && step && <RoomSheet key={view.room.id} game={game} view={view} step={step} now={now} pending={pending}
      onSelect={(node) => setOpen({ room: view.room.id, node })} onOpenRoom={openRoom} onBuy={build} onClose={() => setOpen(null)} />}
  </div>;
}
