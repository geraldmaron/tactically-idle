// The certifications an officer can hold, in the two ways text names them: the qualification
// ("Crisis negotiation", on cards, sheets and the training store) and the person who holds it
// ("crisis negotiator", in what a locked choice or a squad lacks).
import type { CertId } from '../sim/types';

export const CERTIFICATIONS: Readonly<Record<CertId, { name: string; holder: string }>> = {
  crisis_negotiation: { name: 'Crisis negotiation', holder: 'crisis negotiator' },
  entry_team: { name: 'Entry team', holder: 'entry-trained officer' },
  advanced_first_aid: { name: 'Advanced first aid', holder: 'advanced first aider' },
  surveillance: { name: 'Surveillance', holder: 'surveillance specialist' },
  drone_operator: { name: 'Drone operator', holder: 'drone operator' },
  less_lethal: { name: 'Less-lethal response', holder: 'less-lethal qualified officer' },
  advanced_less_lethal: { name: 'Advanced less-lethal response', holder: 'advanced less-lethal qualified officer' },
  deescalation: { name: 'De-escalation', holder: 'de-escalation qualified officer' },
  vehicle_operations: { name: 'Vehicle operations', holder: 'qualified vehicle operator' },
  precision_support: { name: 'Precision support', holder: 'qualified specialist support officer' },
  controlled_access: { name: 'Controlled access', holder: 'controlled-access qualified officer' },
};

export const CERT_IDS = Object.keys(CERTIFICATIONS) as CertId[];
export const isCertId = (cert: string): cert is CertId => Object.hasOwn(CERTIFICATIONS, cert);
const pick = (field: 'name' | 'holder') => Object.fromEntries(CERT_IDS.map(id => [id, CERTIFICATIONS[id][field]])) as Record<CertId, string>;
/** "Crisis negotiation": the qualification. */
export const CERT_NAME = pick('name');
/** "crisis negotiator": the officer who holds it. */
export const CERT_HOLDER = pick('holder');
