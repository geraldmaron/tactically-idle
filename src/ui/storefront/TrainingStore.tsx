import { useEffect, useRef, useState } from 'react';
import { COURSES, COURSE_RATING_CEILING } from '../../content/courses';
import { DEV_NODES } from '../../content/dev-tree';
import { courseOptions } from '../../sim/department-selectors';
import { fullName } from '../../sim/officer';
import type { CertId, Id } from '../../sim/types';
import { CERT_LABEL, RATING_META } from '../components/labels';
import { useToast } from '../components/toast';
import { Button, Chip, EmptyState } from '../components/ui';
import { moneyFull as money } from '../format';
import { useGame } from '../store';
import { useNav, type TrainingDraft, type TrainingFocus } from '../components/nav';

/** Apply a deep link once; returning from Develop keeps the officer and search the player edited. */
export function trainingDraftForRequest(draft: TrainingDraft, focus: TrainingFocus, request: number): TrainingDraft {
  if (draft.request === request) return draft;
  return {
    officerId: focus.officerId ?? draft.officerId,
    search: focus.courseId ? COURSES[focus.courseId]?.name ?? '' : focus.certId ? CERT_LABEL[focus.certId] : focus.officerId ? '' : draft.search,
    request,
  };
}

interface TrainingStoreProps {
  requestedCert?: CertId;
  requestedOfficer?: Id;
  requestedCourse?: Id;
  requestKey?: number;
  onDevelopment?: (nodeId: Id) => void;
}
export function TrainingStore({ requestedCert, requestedOfficer, requestedCourse, requestKey, onDevelopment }: TrainingStoreProps = {}) {
  const game = useGame();
  const { act } = useToast();
  const nav = useNav();
  const focus = nav.trainingFocus;
  const certId = requestedCert ?? focus.certId;
  const courseId = requestedCourse ?? focus.courseId;
  const selectedOfficer = requestedOfficer ?? focus.officerId;
  const root = useRef<HTMLDivElement>(null);
  const focusRequest = requestKey ?? nav.trainingRequest;
  const draft = trainingDraftForRequest(nav.trainingDraft, { officerId: selectedOfficer, certId, courseId }, focusRequest);
  const { officerId, search } = draft;
  const setOfficerId = (id: Id) => nav.setTrainingDraft({ ...draft, officerId: id });
  const setSearch = (value: string) => nav.setTrainingDraft({ ...draft, search: value });
  const [feedback, setFeedback] = useState<{ courseId: Id; text: string } | null>(null);
  useEffect(() => {
    if (draft !== nav.trainingDraft) nav.setTrainingDraft(draft);
    setFeedback(null);
    const frame = requestAnimationFrame(() => {
      const target = courseId ? root.current?.querySelector<HTMLElement>(`[data-course-id="${courseId}"]`) : root.current?.querySelector<HTMLElement>('.training-heading');
      target?.scrollIntoView({ block: 'nearest' });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedOfficer, certId, courseId, focusRequest]);
  const officers = Object.values(game.officers).sort((a, b) => a.surname.localeCompare(b.surname) || a.id.localeCompare(b.id));
  const officer = game.officers[officerId];
  const options = courseOptions(game, officer?.id ?? null, game.department.clockHighWater)
    .filter(({ course }) => [course.name, course.grants.cert ? CERT_LABEL[course.grants.cert] : '', course.grants.rating?.key ?? ''].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const inTraining = officers.filter((member) => member.assignment?.kind === 'training').length;
  return <div ref={root} className="store-training">
    <h2 className="section-title training-heading" tabIndex={-1}>Training</h2>
    <p className="dim">Enrol one officer at a time. Courses use funding and a training slot. Certifications and rating gains arrive when training finishes; a development unlock alone does not qualify anyone.</p>
    <div className="chips"><Chip icon="mortarboard">{inTraining}/{game.department.trainingSlots} training slots used</Chip></div>
    <div className="store-filter-row">
      <label className="field"><span className="field-label">Officer to train</span><select value={officer?.id ?? ''} onChange={(event) => { setOfficerId(event.target.value); setFeedback(null); }}><option value="">Select an officer</option>{officers.map((member) => <option key={member.id} value={member.id}>{fullName(member)}{member.assignment ? ` · ${member.assignment.kind}` : ''}</option>)}</select></label>
      <label className="field"><span className="field-label">Search courses</span><input type="search" placeholder="Course or certification" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    </div>
    {search && <Button size="sm" variant="ghost" onClick={() => setSearch('')}>Show all training</Button>}
    <p className="dim" role="status">{options.length} of {Object.keys(COURSES).length} courses</p>
    {!officers.length && <EmptyState icon="people" title="No officers to train">Recruit an officer before starting a course.</EmptyState>}
    <div className="store-grid">{options.map(({ course, available, reason }) => {
      const locked = !!course.requiresNode && !game.department.unlockedNodes.includes(course.requiresNode);
      const rating = course.grants.rating;
      const cert = course.grants.cert;
      return <article className={`store-card${courseId === course.id ? ' training-course-highlight' : ''}`} key={course.id} data-course-id={course.id} tabIndex={courseId === course.id ? -1 : undefined}>
        <div className="store-card-heading"><div><span className="kicker">{cert ? 'Certification' : 'Skills course'}</span><h3>{course.name}</h3></div><Chip icon="clock">{course.hours}h</Chip></div>
        <p>{cert ? `Earns ${CERT_LABEL[cert]} on completion.` : rating ? `Adds ${rating.delta} ${RATING_META.find((meta) => meta.key === rating.key)?.label ?? rating.key} on completion, up to ${COURSE_RATING_CEILING}.` : ''}</p>
        {!!course.requiresCerts?.length && <p className="dim">Prior qualification: {course.requiresCerts.map((required) => CERT_LABEL[required]).join(' + ')}.</p>}
        {course.requiresNode && <p className={locked ? 'reason' : 'dim'}>{locked ? 'Requires' : 'Program unlocked:'} {DEV_NODES[course.requiresNode]?.name ?? course.requiresNode}.</p>}
        {locked && <Button size="sm" onClick={() => (onDevelopment ?? nav.openDevelopment)(course.requiresNode!)}>View development program</Button>}
        <div className="store-card-foot"><strong>{money(course.cost)} <span className="dim">funding</span></strong><Button size="sm" variant="primary" disabled={!officer || !available} onClick={() => {
          if (!officer) return;
          const result = act({ type: 'startCourse', officerId: officer.id, courseId: course.id }, `${fullName(officer)} started ${course.name}`);
          setFeedback({ courseId: course.id, text: result.ok ? `${fullName(officer)} is training for ${course.hours} game hours.` : result.reason });
        }}>Enrol officer</Button></div>
        {reason && <p className="reason">{reason}</p>}
        {!officer && <p className="dim">Choose an officer to check staffing, income and qualification requirements.</p>}
        {feedback?.courseId === course.id && <p role="status">{feedback.text}</p>}
      </article>;
    })}</div>
    {!options.length && <EmptyState icon="mortarboard" title="No courses match">Clear the course search to see all training.</EmptyState>}
  </div>;
}
