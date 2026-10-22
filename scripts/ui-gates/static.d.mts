export interface Finding { file: string; line: number; text: string; kind?: string }
export const STATIC_RULES: Record<string, string>;
export function collectStatic(root: string): Record<string, Finding[]>;
export function countByFile(findings: Finding[]): Record<string, number>;
export function rawLengths(value: string): number[];
export function spacingFindings(file: string, css: string): { R1: Finding[]; R3: Finding[] };
export function tsxSpacingFindings(file: string, tsx: string): Finding[];
export function textSizeFindings(file: string, css: string): Finding[];
export function tsxTextFindings(file: string, tsx: string): Finding[];
export function cssColorFindings(file: string, css: string): Finding[];
export function tsColorFindings(file: string, ts: string): Finding[];
export function iconFindings(file: string, tsx: string): { size: Finding[]; stroke: Finding[]; dynamic: Finding[] };
export function iconCssFindings(file: string, css: string): Finding[];
export function leadFindings(file: string, tsx: string): { heading: Finding[]; section: Finding[]; row: Finding[] };
export function hiddenGlyphFindings(file: string, css: string): Finding[];
export function kitSemanticsFindings(file: string, tsx: string): { basicKit: Finding[]; status: Finding[]; outcome: Finding[] };
export function variantFindings(file: string, css: string): { redefinition: Finding[]; badge: Finding[] };
export function switchFindings(file: string, tsx: string): Finding[];
export function stateFindings(file: string, tsx: string): { empty: Finding[]; error: Finding[] };
