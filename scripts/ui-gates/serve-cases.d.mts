export function runServeCase<T extends object = object>(body: string, inspect?: (tmp: string) => T): { stdout: string; status: number | null; signal: string | null; error: string | null } & T;
export const caches: (tmp: string) => string[];
export const alive: (needle: string) => boolean;
export function settles(check: () => boolean, ms?: number): Promise<boolean>;
