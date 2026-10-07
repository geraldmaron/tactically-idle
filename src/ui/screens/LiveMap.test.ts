import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentBuilt, spaceViews, stageProgress } from '../../sim/operation-selectors';
import { makeState, NOW, startRun } from '../../sim/test-fixtures';
import { Blueprint } from '../blueprint/Blueprint';
import { RoomList } from '../blueprint/RoomList';
import { LiveView, type LiveViewProps } from './LiveView';

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (next: unknown) => { hooks.values[index] = typeof next === 'function' ? next(hooks.values[index]) : next; }];
  },
}));

type Element = ReactElement<{ children?: ReactNode; className?: string; 'aria-label'?: string; 'aria-pressed'?: boolean; onClick?: () => void }>;
function descendants(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap((child) => isValidElement(child) ? [child as Element, ...descendants((child as Element).props.children)] : []);
}
function fixture() {
  const g = startRun(makeState(), 'ms_occupancy', ['A']);
  const noop = () => {};
  const props: LiveViewProps = {
    g, now: NOW, title: 'Map inspection', subtitle: 'TEST',
    progress: stageProgress(g), built: currentBuilt(g)!, spaces: spaceViews(g), squadTasks: g.activeRun!.squadTasks,
    deployedSquads: [g.squads[0]], focusSquadId: 'A', onFocusSquad: noop,
    officers: [], actions: [], selectedAction: null, onSelectAction: noop,
    activeOfficerId: null, onSelectOfficer: noop, selectedSpaceId: 'front_yard', onSelectSpace: vi.fn(),
    highlightSpaceIds: [], floor: 0, onFloorChange: vi.fn(), environment: null, lastChange: null,
    showRooms: false, onToggleRooms: () => { props.showRooms = !props.showRooms; },
    clock: 10.2, pressure: 15, canCancel: true, onCancel: noop, onOpenDetails: noop, detailsOpen: false,
  };
  const render = () => {
    hooks.cursor = 0;
    const all = descendants(LiveView(props));
    const map = all.find((element) => element.props.className === 'live-map')!;
    const controls = all.find((element) => element.props['aria-label'] === 'Map display')!;
    const buttons = descendants(controls.props.children).filter((element) => element.type === 'button');
    const drawing = all.find((element) => element.type === Blueprint) as ReactElement<Parameters<typeof Blueprint>[0]> | undefined;
    const rooms = all.find((element) => element.type === RoomList) as ReactElement<Parameters<typeof RoomList>[0]> | undefined;
    return { map, controls, buttons, drawing, rooms };
  };
  return { props, render };
}

beforeEach(() => { hooks.values = []; hooks.cursor = 0; });

describe('live map display controls', () => {
  it('keeps operation status and display buttons outside the drawable surface in both views', () => {
    const { props, render } = fixture();
    for (const showRooms of [false, true]) {
      props.showRooms = showRooms;
      const view = render();
      const children = Children.toArray(view.map.props.children).filter(isValidElement) as Element[];
      expect(children.map((element) => element.props.className)).toEqual(['map-hud map-status', 'live-map-inner', 'map-hud map-actions']);
      expect(children[2].props).toBe(view.controls.props);
      expect(descendants(children[1].props.children).some((element) => element.props['aria-label'] === 'Map display')).toBe(false);
      expect(view.buttons).toHaveLength(showRooms ? 1 : 2);
    }
  });

  it('preserves material visibility and room selection across repeated Map and Rooms switches', () => {
    const { props, render } = fixture();
    expect(render().drawing!.props.showMaterials).toBe(false);
    render().buttons[0].props.onClick!();
    expect(render().drawing!.props.showMaterials).toBe(true);
    expect(render().buttons[0].props['aria-pressed']).toBe(true);
    for (let i = 0; i < 2; i++) {
      render().buttons[1].props.onClick!();
      const list = render();
      expect(list.drawing).toBeUndefined();
      expect(list.rooms!.props.selectedSpaceId).toBe('front_yard');
      expect(list.buttons[0].props['aria-pressed']).toBe(true);
      list.rooms!.props.onSelectSpace!('living');
      list.buttons[0].props.onClick!();
      expect(render().drawing!.props.showMaterials).toBe(true);
    }
    expect(props.onSelectSpace).toHaveBeenCalledTimes(2);
    expect(props.onSelectSpace).toHaveBeenLastCalledWith('living');
    render().buttons[0].props.onClick!();
    expect(render().drawing!.props.showMaterials).toBe(false);
  });

  it('keeps floor and room inspection callbacks independent from display buttons', () => {
    const { props, render } = fixture();
    props.floor = 1;
    const view = render();
    expect(view.drawing!.props.floor).toBe(1);
    view.drawing!.props.onFloorChange!(0);
    view.drawing!.props.onSelectSpace!('front_yard');
    expect(props.onFloorChange).toHaveBeenCalledExactlyOnceWith(0);
    expect(props.onSelectSpace).toHaveBeenCalledExactlyOnceWith('front_yard');
    expect(render().drawing!.props.showMaterials).toBe(false);
    expect(props.showRooms).toBe(false);
  });
});
