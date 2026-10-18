// The surface registry (spec 9.2): tab → label, the key after G that opens it, its component and
// whether it needs a call in focus. Each surface lives in surfaces/<name>/index.tsx as a default
// export; the review drawer is registered on its own because it opens over any surface.
import type { ComponentType } from 'react';
import type { Surface } from '../types';
import CallsSurface from './calls';
import DependenciesSurface from './deps';
import FlowSurface from './flow';
import { SURFACE_META } from './meta';
import type { SurfaceMeta } from './meta';
import OutcomesSurface from './outcomes';
import PlaySurface from './play';
import ReviewDrawer from './review';
import ScriptSurface from './script';
import TuningSurface from './tuning';

/** A key binding a surface lists in the shortcut sheet: the keys as shown, and what they do. */
export interface ShortcutRow { keys: string; does: string }

export interface SurfaceEntry extends SurfaceMeta {
  tab: Surface; Component: ComponentType;
  /** Surface keys for the shortcut sheet; a stream adds its own as it builds them. */
  keys?: readonly ShortcutRow[];
}

const COMPONENTS: Record<Surface, ComponentType> = {
  calls: CallsSurface, play: PlaySurface, flow: FlowSurface, outcomes: OutcomesSurface, deps: DependenciesSurface, script: ScriptSurface, tuning: TuningSurface,
};

/** Each surface's own keys, as its key handler binds them. Outcomes, Dependencies and Script have
 * none beyond the global ones. */
const SURFACE_KEYS: Partial<Record<Surface, readonly ShortcutRow[]>> = {
  calls: [{ keys: 'R', does: 'Run the CI gate' }],
  play: [
    { keys: '1 to 9', does: 'Select that row of This moment' },
    { keys: 'W C B', does: 'Force the selected choice: goes well, complications, goes badly (also in the band picker)' },
    { keys: 'R or Enter', does: 'Roll the selected choice' },
    { keys: '[ ]', does: 'Step back or forward along the path' },
    { keys: 'Backspace', does: 'Rewind one step' },
    { keys: 'X', does: 'Show or hide the X-ray rail' },
    { keys: 'T', does: 'Show or hide the tape on hidden truth' },
    { keys: 'P', does: 'People colors on or off' },
    { keys: 'F D S', does: 'This choice in Flow, Dependencies or Script' },
  ],
  flow: [
    { keys: '← → ↑ ↓', does: 'Move between boxes, along routes or within a column' },
    { keys: 'Enter', does: 'Show or fold a node’s choices' },
    { keys: 'P', does: 'Play here' },
    { keys: 'M', does: 'Next view: Reach, Structure, State' },
    { keys: '0', does: 'Fit the call' },
    { keys: '.', does: 'Center the selection' },
    { keys: '+ −', does: 'Zoom in or out' },
    { keys: 'Esc', does: 'Close the inspector' },
  ],
  tuning: [{ keys: '⌘Z', does: 'Undo the last tuning edit' }],
};

export const SURFACE_REGISTRY = Object.fromEntries(
  (Object.keys(SURFACE_META) as Surface[]).map(tab => [tab, { tab, ...SURFACE_META[tab], Component: COMPONENTS[tab], ...SURFACE_KEYS[tab] ? { keys: SURFACE_KEYS[tab] } : {} }]),
) as Record<Surface, SurfaceEntry>;

/** The surfaces in the top bar's tab row, in order. Calls opens from the call switcher (and G C). */
export const TAB_ORDER: readonly Surface[] = ['play', 'flow', 'outcomes', 'deps', 'script', 'tuning'];

export const REVIEW: { label: string; Component: ComponentType } = { label: 'Review', Component: ReviewDrawer };
