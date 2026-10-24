// What it costs to hire a returning officer: the same wage-based signing hours a recruit costs, without a
// per-service-year add-on or an issue kit (their kit stayed with the department when they left).
import { RECRUIT_TUNING } from '../../content/recruits';

export const recruitSigningCost = (wage: number): number => Math.round((wage * RECRUIT_TUNING.signingHours) / 10) * 10;
