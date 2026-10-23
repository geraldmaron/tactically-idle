export const OPT_IN_RULES: string[];
export const FEEL_SCREENS: Record<string, { primary?: { css: string; name?: string }[] | null; plates?: boolean }>;
export const FEEL_ON: Record<string, string[]>;
export function enforced(rule: string, screen: string, on?: Record<string, string[]>): boolean;
export function judgePrimary(p: object | null | undefined, opts?: object): { rule: string; id: string; detail: string }[];
