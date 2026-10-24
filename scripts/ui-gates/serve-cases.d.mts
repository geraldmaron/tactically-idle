export function caseTmp(): { tmp: string; cleanup: () => void };
export function runServeCase(body: string, tmp: string): { stdout: string; status: number | null; signal: string | null; error: string | null };
export function runInGroup(body: string, tmp: string, signal: string): Promise<{ stdout: string; status: number | null; signal: string | null; ready: boolean }>;
export const caches: (tmp: string) => string[];
export const alive: (needle: string) => boolean;
export function settles(check: () => boolean, ms?: number): Promise<boolean>;
