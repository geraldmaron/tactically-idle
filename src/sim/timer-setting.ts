// The call timer setting (docs/call-pressure.md, owner decision 2026-10-20): how fast real time on
// an open decision becomes dither minutes. Off never adds any. Rates and reading floors live in
// src/sim/tuning.json; this file only names the settings.

export const TIMER_SETTINGS = ['off', 'relaxed', 'standard'] as const;
export type TimerSetting = (typeof TIMER_SETTINGS)[number];

export const DEFAULT_TIMER_SETTING: TimerSetting = 'relaxed';
