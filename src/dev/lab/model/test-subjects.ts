// Subjects for the lab's property tests (COORDINATION.md, "Tests across lanes"). Each finder returns
// the subject on a shipped call where one has it, for realism, and always on an owned fixture too,
// so a property is tested whatever content does, and the fixture path is exercised every run.
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { CLOCK_FIXTURE_CLOCK, CLOCK_FIXTURE_IDS, clockFixtureTemplate } from '../../../gen/incident/gates/clock-fixture';
import { CERT_FIXTURE, certFixtureTemplate, compileFixtureCall } from '../../../gen/incident/gates/fixture-call';
import { GROUP_TEMPLATE } from '../../../gen/incident/trees-v13/group-fixture';
import { withDraftScenario } from '../../../gen/incident/gates/engine-driver';
import { choiceActionId } from '../../../gen/incident/trees-v13/compile';
import { parseLabUrl } from '../url';
import { currentFrame, fixtureSession, openSession } from './session';
import type { Session } from './session';

export interface CertSubject {
  source: string; node: string; choice: string; cert: string; actionId: string;
  /** Runs `fn` with a session without the cert and one with it granted to squad A's first officer. */
  withSessions<T>(fn: (bare: Session, granted: Session) => T): T;
}

const open = (query: string): Session => {
  const s = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in s)) throw new Error(`could not open ${query}: ${s.message}`);
  return s;
};

/** A root choice that needs a certification the reference squad lacks: on the first shipped call
 * that has one, and on the certification fixture. */
export function certSubjects(): CertSubject[] {
  const out: CertSubject[] = [];
  for (const template of Object.values(INCIDENT_TEMPLATES) as (IncidentTemplate | undefined)[]) {
    if (!template || out.length) continue;
    const query = `type=${template.type}&tier=2`;
    const bare = open(query), root = template.tree.nodes.find(node => node.id === template.tree.root)!;
    for (const choice of root.choices) {
      const cert = choice.requires?.certs?.[0];
      const actionId = choiceActionId(template.type, root.id, choice.id);
      if (!cert || currentFrame(bare).views.find(view => view.id === actionId)?.eligible !== false) continue;
      out.push({ source: template.type, node: root.id, choice: choice.id, cert, actionId, withSessions: fn => fn(bare, open(`${query}&certs=${cert}`)) });
      break;
    }
  }
  const template = certFixtureTemplate(), scenario = compileFixtureCall(template);
  out.push({ source: 'fixture', node: template.tree.root, choice: CERT_FIXTURE.choice, cert: CERT_FIXTURE.cert, actionId: choiceActionId(template.tree.type, template.tree.root, CERT_FIXTURE.choice),
    withSessions: fn => withDraftScenario(scenario, id => fn(fixtureSession(template, id), fixtureSession(template, id, [CERT_FIXTURE.cert]))) });
  return out;
}

export interface ClockSubject {
  source: string; clock: string; target: { node: string } | { ending: string };
  /** Runs `fn` with a session whose call has this clock. */
  withSession<T>(fn: (s: Session) => T): T;
}

/** A clock that can run out (not story, a rate above zero) and routes the call: on the first shipped
 * call that has one, in a situation that draws it, and on the clock fixture (gates/clock-fixture.ts). */
export function clockSubjects(): ClockSubject[] {
  const out: ClockSubject[] = [];
  for (const template of Object.values(INCIDENT_TEMPLATES) as (IncidentTemplate | undefined)[]) {
    if (!template || out.length) continue;
    for (const situation of template.situations) for (const clock of situation.clocks ?? []) {
      const next = clock.onOut?.next;
      if (out.length || clock.story || !(clock.ratePerMin > 0) || !next || 'turn' in next) continue;
      const s = open(`type=${template.type}&tier=2&variant=${situation.index}`);
      if (!s.instance.clocks.some(entry => entry.id === clock.id)) continue;
      out.push({ source: template.type, clock: clock.id, target: next, withSession: fn => fn(s) });
    }
  }
  const template = clockFixtureTemplate(CLOCK_FIXTURE_CLOCK, { playable: true }), scenario = compileFixtureCall(template);
  out.push({ source: 'fixture', clock: CLOCK_FIXTURE_IDS.clock, target: { node: CLOCK_FIXTURE_IDS.node }, withSession: fn => withDraftScenario(scenario, id => fn(fixtureSession(template, id))) });
  return out;
}

/** The clock fixture with its clock never running down (rate 0): a clock that can't run out. */
export function stoppedClockSession<T>(fn: (s: Session) => T): T {
  const template = clockFixtureTemplate({ ...CLOCK_FIXTURE_CLOCK, ratePerMin: 0 }, { playable: true }), scenario = compileFixtureCall(template);
  return withDraftScenario(scenario, id => fn(fixtureSession(template, id)));
}

/** A session on the group fixture with no others: a call the tooling owns, for controls. */
export function groupFixtureSession<T>(fn: (s: Session) => T): T {
  const scenario = compileFixtureCall(GROUP_TEMPLATE);
  return withDraftScenario(scenario, id => fn(fixtureSession(GROUP_TEMPLATE, id)));
}
