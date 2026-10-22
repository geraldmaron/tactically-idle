export const BASELINE_FILE: string;
export interface RuleEntry { target: number; total: number; counts: Record<string, number> }
export interface Baseline { _?: string; static: Record<string, RuleEntry>; rendered: Record<string, RuleEntry> }
export function readBaseline(root: string): Baseline;
export function entry(counts: Record<string, number>, target?: number): RuleEntry;
export function writeBaseline(root: string, baseline: Baseline): void;
export function compareCounts(current: Record<string, number>, base?: Record<string, number>, options?: { only?: (key: string) => boolean }): { rose: string[]; fell: string[] };
export const RAISED_HELP: string;
export const FELL_HELP: string;
