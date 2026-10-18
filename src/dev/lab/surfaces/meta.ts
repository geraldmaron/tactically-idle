// What each surface is, without its component: label, the key after G, whether it needs a call, and
// the question it answers (spec 2.2). index.ts adds the components; the shell reads both.
import type { Surface } from '../types';

export interface SurfaceMeta { label: string; key: string; needsCall: boolean; question: string }

export const SURFACE_META: Record<Surface, SurfaceMeta> = {
  calls: { label: 'Calls', key: 'C', needsCall: false, question: 'Which call needs attention?' },
  play: { label: 'Play', key: 'P', needsCall: true, question: "What does the player see here, and what's underneath?" },
  flow: { label: 'Flow', key: 'F', needsCall: true, question: 'What are all the routes, and which are used?' },
  outcomes: { label: 'Outcomes', key: 'O', needsCall: true, question: 'How does the call end, by style, and will CI pass?' },
  deps: { label: 'Dependencies', key: 'D', needsCall: true, question: "Who sets this, who reads it, what's dead, why is this locked?" },
  script: { label: 'Script', key: 'S', needsCall: true, question: 'Does every line read right for every draw?' },
  tuning: { label: 'Tuning', key: 'T', needsCall: false, question: 'What happens to the whole game if I change this?' },
};
