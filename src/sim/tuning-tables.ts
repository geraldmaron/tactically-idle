// Registers every tunable table (sim/tuning.ts). Importing this module loads each module that
// defines one, so tunable() has run for all of them and a patch reaches every table, whatever the
// entry point loaded first. The lab worker imports it before anything else; tuning-tables.test.ts
// checks this list against the registry and the committed tuning.json against the tables.
//
// The engine modules sit in import cycles (see scripts/cross-engine-fingerprints.ts). Entering
// through operation.ts first resolves them the way the game does, so it comes first here.
import './operation';
import './resolution';
import './officer';
import './spatial-factors';
import './roster';
import './incidents';
import './clocks';
import './force-risk';
import './career';
import './develop';
import './threat';
import './environment';
import './outcome-score';
import './authorization';
import './incident-factors';
import './drawn-effects';
import './meters';
import './economy';
import './equipment';
import '../content/recruits';

/** Every table wrapped with tunable(), by the name it registers under. */
export const TUNED_TABLES = [
  'RESOLUTION_TUNING', 'EXPERIENCE_TUNING', 'STRESS_TUNING', 'SPATIAL_TUNING', 'ROSTER_TUNING', 'INCIDENT_TUNING', 'CLOCK_RULES_V1',
  'FORCE_RISK_V1', 'CAREER_TUNING', 'LEARNING_MULTIPLIER', 'DEVELOP_TUNING', 'THREAT_TUNING', 'ENV_TUNING',
  'OUTCOME_SCORE_V1', 'AUTHORIZATION_V1', 'INCIDENT_CLASS_V1', 'INTEL_V1', 'INCOMING_FIRE_V1', 'TEAM_FORCE_V1', 'CASCADE_V1',
  'METERS_V1', 'ECONOMY_TUNING', 'EQUIPMENT_TUNING', 'RECRUIT_TUNING',
] as const;
export type TunedTable = typeof TUNED_TABLES[number];
