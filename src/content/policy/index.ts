// The content policy, one entry point (docs/content-policy.md). Surfaces import from here.
export { POLICY_SOURCES, type PolicySource, type SourceId } from './sources';
export { CONTROLS, controlById, controlsFor, gaps, type Control, type ControlId, type Enforcement, type Family, type Severity, type Surface, type TextCheckId } from './controls';
export { checkText, blocking, surfaceOfPath, TEXT_CHECKS, type PolicyFinding } from './checks';
export { ratingProfile, reviewNotes, FREQUENT_SHARE, type RatingProfile, type SituationFacts, type Frequency, type AppleAge } from './rating';
export { editorialBrief, EDITOR_LIMITS } from './brief';
export { admitScenario, scenarioFindings, policyRefusals, POLICY_VERSION, type LocatedFinding } from './guard';
