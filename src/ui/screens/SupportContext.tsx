import type { ActionView, Id, OperationRun } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { scenarioActions } from '../../sim/scenario-types';
import { externalSupportViews } from '../../sim/external-support';
import { Button } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { Icon } from '../icons';
import { opMinutes } from '../format';
import './support-context.css';

type ServiceView = ReturnType<typeof externalSupportViews>[number];

/** The briefing is public authored information, never reconstructed from hidden incident truth. */
export function IncidentBriefContext({ scenario, compact = false }: { scenario: ScenarioDefinition; compact?: boolean }) {
  const { dispatchReason, teamResponsibilities } = scenario.briefing;
  if (!dispatchReason && !teamResponsibilities?.length) return null;
  const content = <>
    {dispatchReason && <p>{dispatchReason}</p>}
    {!!teamResponsibilities?.length && <div className="incident-responsibilities"><strong>Your team’s responsibilities</strong><ul>{teamResponsibilities.map((task) => <li key={task}>{task}</li>)}</ul></div>}
  </>;
  if (compact) return <details className="incident-context incident-context-compact"><summary>Why your team was requested</summary>{content}</details>;
  return <section className="incident-context" aria-label="Your team’s role"><h3><Icon name="radio" size={16} />Why your team was requested</h3>{content}</section>;
}

export function supportStatusLine(service: ServiceView): string {
  if (service.status === 'unrequested') return 'Not requested';
  if (service.status === 'unavailable') return service.requestedAt === null ? 'No response available' : 'Requested · no response available';
  if (service.status === 'requested') return `Requested · waiting ${opMinutes(service.minutesRemaining ?? 0)}`;
  if (service.status === 'available') return 'Available · awaiting acceptance';
  return 'Accepted';
}

/** Match only public, currently listed choices. Opening details never creates a second command. */
export function contextualSupportAction(scenario: ScenarioDefinition, actions: ActionView[], service: ServiceView): ActionView | null {
  if (service.status === 'accepted' || service.status === 'unavailable') return null;
  const definitions = new Map(scenarioActions(scenario).map((action) => [action.id, action]));
  const candidates = actions.filter((view) => {
    const action = definitions.get(view.id);
    if (!action) return false;
    if (service.status === 'requested') return action.awaitSupport === service.id;
    const effect = service.status === 'unrequested' ? 'requestSupport' : 'acceptSupport';
    return Object.values(action.outcomes).some((effects) => effects.some((outcome) => outcome[effect]?.includes(service.id)));
  });
  return candidates.find((action) => action.eligible) ?? candidates[0] ?? null;
}

export function SupportContext({ scenario, run, actions, open, onOpen, onClose, onPickAction }: {
  scenario: ScenarioDefinition;
  run: OperationRun;
  actions: ActionView[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPickAction: (id: Id) => void;
}) {
  const services = externalSupportViews(scenario, run);
  if (!services.length) return null;
  return <>
    <section className="support-context" aria-label="Care and support">
      <div className="support-context-heading"><h2><Icon name="handover" size={16} />Care &amp; support</h2><button type="button" className="support-details-trigger" onClick={onOpen} aria-haspopup="dialog" aria-expanded={open}>Details<Icon name="chevronRight" size={16} /></button></div>
      <ul className="support-status-list" aria-live="polite">{services.map((service) => <li key={service.id} data-support-status={service.status}><strong>{service.label}</strong><span>{supportStatusLine(service)}</span></li>)}</ul>
    </section>
    <Sheet open={open} onClose={onClose} title="Care and support" className="support-context-sheet" footer={<Button block onClick={onClose}>Back to decisions</Button>}>
      <IncidentBriefContext scenario={scenario} />
      <p className="support-clock-note">Response times use operation minutes. Time moves when you confirm a decision.</p>
      <div className="support-service-details">{services.map((service) => {
        const definition = scenario.externalServices?.find((entry) => entry.id === service.id);
        const action = contextualSupportAction(scenario, actions, service);
        return <section key={service.id} className="support-service" aria-label={service.label}>
          <h3>{service.label}</h3>
          <p className="support-service-status">{supportStatusLine(service)}</p>
          <p>{service.description}</p>
          {service.status === 'unrequested' && definition && <p className="support-clock-note">Expected response: {opMinutes(definition.arrivalMinutes)} after your request.</p>}
          {service.requestedAt !== null && <p className="support-clock-note">Requested at {opMinutes(service.requestedAt)}{service.status === 'requested' && service.availableAt !== null ? ` · Expected at ${opMinutes(service.availableAt)}` : ''}{service.acceptedAt !== null ? ` · Accepted at ${opMinutes(service.acceptedAt)}` : ''}</p>}
          {service.status === 'requested' && <p>Your team keeps responsibility while the service is on its way.</p>}
          {service.status === 'available' && <p>Ready to help. Confirm the next step with them.</p>}
          {service.status === 'accepted' && <p>They’ve accepted the agreed next step. Finish any remaining team tasks.</p>}
          {action ? <div className="support-context-action"><Button variant="primary" block onClick={() => onPickAction(action.id)}>Review: {action.title}</Button>{!action.eligible && action.reason && <p className="support-clock-note">{action.reason}</p>}</div> : service.status !== 'accepted' && <p className="support-clock-note">Use the current decisions to address what the call still needs.</p>}
        </section>;
      })}</div>
    </Sheet>
  </>;
}
