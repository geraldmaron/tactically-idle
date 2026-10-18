// Scenario Lab shared types: the focus every surface reads from the URL (surface, call, path,
// selection and view toggles) and the review notes. url.ts reads and writes LabUrl; context.tsx
// hands it to every surface through useLab().
import type { Policy } from '../../gen/incident/trees-v13/balance';
import type { IncidentType } from '../../sim/scenario-types';
import type { OutcomeBand } from '../../sim/types';
import type { Kit, LabParams } from './model/call';

export type { Kit };
export type Surface = 'calls' | 'play' | 'flow' | 'outcomes' | 'deps' | 'script' | 'tuning';
export type FrameScreen = 'card' | 'brief' | 'live' | 'debrief';
export type Scope = 'call' | 'step' | 'type';
export type Vision = 'deutan' | 'protan' | 'tritan';

export type Selection =
  | { kind: 'node'; node: string } | { kind: 'choice'; node: string; choice: string }
  | { kind: 'band'; node: string; choice: string; band: OutcomeBand } | { kind: 'ending'; ending: string }
  | { kind: 'key'; key: string } | { kind: 'string'; row: string } | { kind: 'field'; path: string } | { kind: 'finding'; id: string };

/** Instance B for the compare view (`vs`): the draw fields that differ from the call in focus. The
 * situation is left out on purpose; "Compare situations" on the path rail covers it. */
export interface CompareDraw { family?: string; seed?: number; tier?: number; kit?: Kit; squad?: number; certs?: string[] }

/** The call draw in focus: every LabParams field but the path, which LabUrl keeps on its own. */
export type LabCall = Omit<LabParams, 'path'>;

export interface LabUrl {
  tab: Surface;
  /** Null when no call is in focus (`/lab` with no `type` or `id`, the Calls landing). */
  call: LabCall | null;
  squad: number; certs: string[]; handoff: string | null; hist: string;
  path: string; node: string | null; sel: Selection | null; scope: Scope; style: Policy; runs: number | null;
  xray: boolean; names: boolean; truth: boolean; screen: FrameScreen | null; dice: 'roll' | 'force'; width: 390 | 430; zoom: 'fit' | '1';
  flow: { mode: 'reach' | 'structure' | 'state'; color: 'band' | 'fate'; pruned: boolean; expanded: string[] };
  vision: Vision | null; tuning: { group: string; advanced: boolean }; filter: string;
  notes: boolean; frame: 'player' | null; labAlias: boolean;
  /** Instance B of the compare view, or null when it is closed. */
  vs: CompareDraw | null;
}

export interface ReviewNote {
  id: string; type: IncidentType; anchor: string; severity: 'block' | 'fix' | 'note' | 'accepted'; rule: string;
  route: 'swat-call-design' | 'swat-call-prose' | 'swat-officer-stories' | 'engineering' | 'owner';
  sees: string; fix: string; text: string; at: number; draw: { situation: 0 | 1 | 2; call: number }; url: string; contentHash: string;
}

export interface NotesFile { v: 1; type: IncidentType; verdict: { value: 'approve' | 'edit' | 'reject'; at: number } | null; notes: ReviewNote[] }
