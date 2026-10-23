export interface Box { label: string; top: number; bottom: number }
export interface Finding { rule: string; id: string; detail: string }
export interface PillBar { pills: { id: string; h: number; fontSize: string; fontWeight: string; images?: { w: number; h: number; wellW?: number | null; wellH?: number | null }[] }[]; menu: { h: number } | null }
export const LAYOUT_REGISTRY: { key: string; screen: string; label: string; items: string }[];
export const LAYOUT_EXEMPT: { key: string; label: string; container: string; reason: string }[];
export const LAYOUT_SCREENS: string[];
export const PILL_BUDGET: { height: number; heightTol: number; equalTol: number; minPills: number; iconWell: number };
export function rowOverlaps(items: Box[], tol?: number): [Box, Box][];
export function judgeLists(lists: { id: string; items: Box[] }[]): Finding[];
export function judgeMarkers(entries: { key: string; label: string; count: number; marked: boolean }[]): Finding[];
export function judgePills(bar: PillBar | null | undefined): Finding[];
export function layoutProbe(cfg: object): Promise<{ lists: { id: string; items: Box[] }[]; registry: { key: string; label: string; count: number; marked: boolean }[]; bar: PillBar | null }>;
