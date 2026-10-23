// The station as the Build screen: the diorama painted dark, each open room lit through its own outline,
// and one tap target per room. Opening a room fades its light in; under reduced motion it is simply lit.
import { SceneHotspots, type Hotspot } from '../../components/SceneHotspots';
import { assetUrl } from '../../art/assetUrl';
import { plateUrl } from '../../art/Plates';
import type { GarageView, RoomView } from './room-model';
import { PLATE_H, PLATE_W, ROOMS, clipPolygon, pctX, pctY, type RoomDef, type RoomId } from './rooms';

const SPOT_W = 9;
/** Plate percentages: a square on screen is 1.5 times as tall in percent as it is wide (3:2 plate). */
const SPOT_H = SPOT_W * (PLATE_W / PLATE_H);

export interface StationRoom { room: RoomDef; open: boolean; state: Hotspot['state']; status: string }

/** The six rooms as the diorama draws them. The garage is always lit; the others follow what is built. */
export function stationRooms(views: readonly RoomView[], garage: GarageView): StationRoom[] {
  return ROOMS.map((room) => {
    if (room.id === 'garage') return { room, open: true, state: 'lit', status: `open, ${garage.employed} of ${garage.capacity} patrol positions filled` };
    const view = views.find((v) => v.room.id === room.id)!;
    const status = view.state === 'ready' ? (view.open ? 'open, a step is ready to build' : 'not built, ready to build') : view.open ? 'open' : 'not built';
    return { room, open: view.open, state: view.state, status };
  });
}

export function Station({ rooms, name, fresh, onOpen }: {
  rooms: readonly StationRoom[];
  /** The department's name, for the caption. */
  name: string;
  /** The room that has just opened: its light fades in once. */
  fresh: RoomId | null;
  onOpen: (id: RoomId) => void;
}) {
  const dark = plateUrl('scene_facilities_plan_dark');
  const lit = plateUrl('scene_facilities_plan');
  const open = rooms.filter((r) => r.open).length;
  const hotspots: Hotspot[] = rooms.map(({ room, state, status }) => ({
    id: room.id, label: room.name, state, status,
    x: pctX(room.at[0]) - SPOT_W / 2, y: pctY(room.at[1]) - SPOT_H / 2, w: SPOT_W, h: SPOT_H,
    onSelect: () => onOpen(room.id),
  }));
  return <section className="station" aria-label="Station">
    <div className="station-art" aria-hidden="true">
      {dark && <img className="station-plate" src={dark} alt="" decoding="async" draggable={false} />}
      {lit && rooms.map(({ room, open: isOpen }) => <img key={room.id} className="station-light" src={lit} alt="" decoding="async" draggable={false}
        data-room={room.id} data-open={isOpen ? 'yes' : undefined} data-fresh={fresh === room.id ? 'yes' : undefined} style={{ clipPath: clipPolygon(room.region) }} />)}
    </div>
    <SceneHotspots plate="none" label="Station rooms" aspect={`${PLATE_W} / ${PLATE_H}`} names={false} hotspots={hotspots} />
    <div className="station-caption">
      <h2 className="station-name">{name}</h2>
      <span className="station-count">{open} of {rooms.length} rooms open</span>
    </div>
  </section>;
}

/** The painting of a room, lit or dark, for cards and sheets. */
export function RoomArt({ room, open, className }: { room: RoomDef; open: boolean; className?: string }) {
  return <img className={`room-art${className ? ` ${className}` : ''}`} data-open={open ? 'yes' : undefined} src={assetUrl(`art/plates/room_${room.id}_${open ? 'lit' : 'dark'}.webp`)} alt="" decoding="async" draggable={false} />;
}
