// How the action sheet groups a choice's contributors (moved from LiveView.tsx), shared with the
// Scenario Lab's X-ray so both group and sum the same way. Pure: no React, no store.
import type { Contributor } from '../../sim/types';
import type { IconName } from '../icons';

export interface ContributorGroup { id: string; label: string; sources: readonly Contributor['source'][]; icon: IconName }

/** One group per contributor source, in the order a player reads them: who, what they carry, where, then the situation. */
export const CONTRIBUTOR_GROUPS: readonly ContributorGroup[] = [
  { id: 'rating', label: 'Officer ratings', sources: ['rating'], icon: 'gauge' },
  { id: 'condition', label: 'Officer condition', sources: ['condition'], icon: 'pulse' },
  { id: 'trait', label: 'Traits', sources: ['trait'], icon: 'star' },
  { id: 'equipment', label: 'Equipment', sources: ['equipment'], icon: 'wrench' },
  { id: 'space', label: 'Space and position', sources: ['space'], icon: 'blueprint' },
  { id: 'support', label: 'Support', sources: ['support'], icon: 'handover' },
  { id: 'preparation', label: 'Preparation', sources: ['preparation'], icon: 'list' },
  { id: 'familiarity', label: 'Familiarity', sources: ['familiarity'], icon: 'book' },
  { id: 'pressure', label: 'Pressure', sources: ['pressure'], icon: 'flame' },
  { id: 'difficulty', label: 'Difficulty', sources: ['difficulty'], icon: 'mountain' },
];
