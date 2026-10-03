import { useEffect, useId, useRef, useState } from 'react';
import { COURSES, COURSE_RATING_CEILING, courseXpGain } from '../../content/courses';
import { DEV_NODES } from '../../content/dev-tree';
import { courseOptions } from '../../sim/department-selectors';
import { fullName } from '../../sim/officer';
import type { CertId, Course, Id, Officer } from '../../sim/types';
import { CERT_LABEL, RATING_META, ROLE_META } from '../components/labels';
import { useToast } from '../components/toast';
import { Button, Chip, EmptyState, Meter } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { Portrait } from '../portraits/Portrait';
import { duration, moneyFull as money } from '../format';
import { getState, useGame } from '../store';
import { useNav, type TrainingDraft, type TrainingFocus } from '../components/nav';
import { trainingCandidates, trainingOfficerCondition, trainingRatingGain, trainingRatingKeys, trainingStrongestRatings, type TrainingCandidate } from './training-officers';
import { createTrainingChooserNavigation, type TrainingChoice, type TrainingEnrolment } from './training-chooser-navigation';
import './training-store.css';

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
  const [choice, setChoice] = useState<TrainingChoice | null>(null);
  const owner = useId();
  const requestRef = useRef(focusRequest);
  requestRef.current = focusRequest;
  const chooser = useRef<ReturnType<typeof createTrainingChooserNavigation> | null>(null);
  if (!chooser.current && typeof window !== 'undefined') chooser.current = createTrainingChooserNavigation(window.history, { owner, request: () => requestRef.current, select: setChoice });
  const submitting = useRef(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = chooser.current!;
    window.addEventListener('popstate', controller.onPop);
    return () => { window.removeEventListener('popstate', controller.onPop); controller.dispose(); };
  }, []);
  useEffect(() => {
    if (draft !== nav.trainingDraft) nav.setTrainingDraft(draft);
    setFeedback(null);
    chooser.current?.discard();
    const frame = requestAnimationFrame(() => {
      const target = courseId ? root.current?.querySelector<HTMLElement>(`[data-course-id="${courseId}"]`) : root.current?.querySelector<HTMLElement>('.training-heading');
      target?.scrollIntoView({ block: 'nearest' });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedOfficer, certId, courseId, focusRequest]);
  useEffect(() => {
    if (!choice?.reviewOfficerId) return;
    reviewHeading.current?.focus({ preventScroll: true });
    reviewHeading.current?.scrollIntoView({ block: 'nearest' });
  }, [choice?.reviewOfficerId, choice?.enrolment]);
  const officers = Object.values(game.officers).sort((a, b) => a.surname.localeCompare(b.surname) || a.id.localeCompare(b.id));
  const officer = game.officers[officerId];
  const options = courseOptions(game, officer?.id ?? null, game.department.clockHighWater)
    .filter(({ course }) => [course.name, course.grants.cert ? CERT_LABEL[course.grants.cert] : '', course.grants.rating?.key ?? ''].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const inTraining = officers.filter((member) => member.assignment?.kind === 'training').length;
  const selectedCourse = choice ? COURSES[choice.courseId] : null;
  const candidates = selectedCourse ? trainingCandidates(game, selectedCourse.id) : [];
  const reviewing = choice?.reviewOfficerId && !choice.enrolment ? candidates.find((candidate) => candidate.officer.id === choice.reviewOfficerId) : null;
  const eligible = candidates.filter(({ option }) => option.available).length;
  const closeChooser = () => chooser.current?.close();
  const openChooser = (id: Id) => {
    submitting.current = false;
    setFeedback(null);
    chooser.current?.open(id);
  };
  const backToCandidates = () => {
    const selected = choice?.reviewOfficerId;
    chooser.current?.review(null);
    requestAnimationFrame(() => {
      const candidate = [...document.querySelectorAll<HTMLElement>('[data-training-candidate]')].find((element) => element.dataset.trainingCandidate === selected);
      const target = candidate?.querySelector<HTMLButtonElement>('button:not([disabled])') ?? candidate;
      target?.focus({ preventScroll: true });
      candidate?.scrollIntoView({ block: 'nearest' });
    });
  };
  const openDevelopment = (nodeId: Id) => {
    chooser.current?.discard();
    (onDevelopment ?? nav.openDevelopment)(nodeId);
  };
  const enrol = () => {
    if (!reviewing || !selectedCourse || !reviewing.option.available || submitting.current) return;
    submitting.current = true;
    const result = act({ type: 'startCourse', officerId: reviewing.officer.id, courseId: selectedCourse.id }, `${fullName(reviewing.officer)} started ${selectedCourse.name}`);
    setFeedback({ courseId: selectedCourse.id, text: result.ok ? `${fullName(reviewing.officer)} is training for ${selectedCourse.hours} real hours.` : result.reason });
    if (result.ok) {
      const assignment = getState().officers[reviewing.officer.id]?.assignment;
      if (assignment?.kind === 'training') chooser.current?.complete({ officerName: fullName(reviewing.officer), startedAt: assignment.startedAt, endsAt: assignment.endsAt });
    }
    else submitting.current = false;
  };
  return <div ref={root} className="store-training">
    <h2 className="section-title training-heading" tabIndex={-1}>Training</h2>
    <p className="dim training-intro">Choose a course, compare officers, then confirm enrolment. Gains arrive when training finishes.</p>
    <div className="chips"><Chip icon="mortarboard">{inTraining}/{game.department.trainingSlots} training slots used</Chip></div>
    {officer && <section className="training-selected-officer" aria-label="Officer to train" data-training-officer-id={officer.id}>
      <div className="training-person">
        <Portrait officer={officer} size={52} className="training-portrait" />
        <div className="training-person-name"><span className="kicker">Officer to train</span><strong>{fullName(officer)}</strong><span className="dim">{ROLE_META[officer.role].label} · {trainingOfficerCondition(officer, game.department.clockHighWater)}</span><span className="dim">Stress {Math.round(officer.stress)}/100</span></div>
      </div>
      <p className="training-strengths">Highest ratings: {trainingStrongestRatings(officer).map((rating) => `${rating.short} ${officer.ratings[rating.key]}`).join(' · ')}</p>
      <div className="training-selected-foot"><span className="dim">Choose a course to compare officers</span><Button size="sm" variant="ghost" onClick={() => setOfficerId('')} aria-label={`Clear ${fullName(officer)} as the officer to train`}>Clear</Button></div>
    </section>}
    <div className="store-filter-row">
      <label className="field"><span className="field-label">Search courses</span><input type="search" placeholder="Course or certification" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    </div>
    {search && <Button size="sm" variant="ghost" onClick={() => setSearch('')}>Show all training</Button>}
    <p className="dim" role="status">{options.length} of {Object.keys(COURSES).length} courses</p>
    {!officers.length && <EmptyState icon="people" title="No officers to train">Recruit an officer before starting a course.</EmptyState>}
    <div className="store-grid">{options.map(({ course, available, reason }) => {
      const locked = !!course.requiresNode && !game.department.unlockedNodes.includes(course.requiresNode);
      const rating = course.grants.rating;
      const cert = course.grants.cert;
      return <article className={`store-card training-course${courseId === course.id ? ' training-course-highlight' : ''}`} key={course.id} data-course-id={course.id} tabIndex={courseId === course.id ? -1 : undefined}>
        <div className="store-card-heading"><div><span className="kicker">{cert ? 'Certification' : 'Skills course'}</span><h3>{course.name}</h3></div><Chip icon="clock">{course.hours}h</Chip></div>
        <p className="training-course-gain">{cert ? `Earn ${CERT_LABEL[cert]}` : rating ? `+${rating.delta} ${RATING_META.find((meta) => meta.key === rating.key)?.label ?? rating.key} · enrol below ${COURSE_RATING_CEILING}` : ''}</p>
        <p className="training-xp">+{courseXpGain(course.hours)} XP on completion</p>
        {officer && <div className="training-course-personal"><span className="dim">For {officer.firstName}</span><TrainingGain course={course} officer={officer} /></div>}
        {!!course.requiresCerts?.length && <p className="dim">Prior qualification: {course.requiresCerts.map((required) => CERT_LABEL[required]).join(' + ')}.</p>}
        {reason && <p className="reason">{reason}</p>}
        {officer && available && <p className="training-eligible">{officer.firstName} can enrol</p>}
        {locked && <Button size="sm" variant="ghost" onClick={() => openDevelopment(course.requiresNode!)}>View development program</Button>}
        <div className="store-card-foot"><strong>{money(course.cost)} <span className="dim">funding</span></strong><Button size="sm" variant="primary" disabled={!officers.length} aria-label={`Choose officer for ${course.name}`} onClick={() => openChooser(course.id)}>Choose officer</Button></div>
        {feedback?.courseId === course.id && <p role="status">{feedback.text}</p>}
      </article>;
    })}</div>
    {!options.length && <EmptyState icon="mortarboard" title="No courses match">Clear the course search to see all training.</EmptyState>}
    <Sheet open={!!selectedCourse} onClose={closeChooser} title={choice?.enrolment ? 'Enrolment confirmed' : reviewing ? 'Review enrolment' : 'Choose officer'} subtitle={selectedCourse ? `${selectedCourse.name} · ${money(selectedCourse.cost)} · ${selectedCourse.hours}h` : undefined} className="training-chooser" footer={selectedCourse && <div className="training-chooser-footer">
      {choice?.enrolment ? <TrainingEnrolmentActions course={selectedCourse} onDone={closeChooser} /> : reviewing ? <>
        <p className="training-confirm-cost">{money(selectedCourse.cost)} funding · 1 slot · {selectedCourse.hours} real hours</p>
        <div className="training-confirm-actions"><Button onClick={backToCandidates}>Back</Button><Button variant="primary" disabled={!reviewing.option.available} onClick={enrol} aria-label={`Enrol ${fullName(reviewing.officer)} in ${selectedCourse.name} for ${money(selectedCourse.cost)}`}>Enrol officer</Button></div>
      </> : <Button block onClick={closeChooser}>Cancel</Button>}
    </div>}>
      {selectedCourse && (choice?.enrolment ? <div className="training-review">
        <h3 ref={reviewHeading} className="training-review-heading" tabIndex={-1}>{choice.enrolment.officerName} enrolled</h3>
        <TrainingEnrolmentReceipt course={selectedCourse} enrolment={choice.enrolment} officer={game.officers[choice.reviewOfficerId!]} now={game.department.clockHighWater} />
      </div> : reviewing ? <div className="training-review">
        <h3 ref={reviewHeading} className="training-review-heading" tabIndex={-1}>Confirm {fullName(reviewing.officer)}</h3>
        <TrainingOfficerCard candidate={reviewing} now={game.department.clockHighWater} selected />
        <div className="training-confirm-details"><p>{game.department.funding >= selectedCourse.cost ? `Funding: ${money(game.department.funding)} → ${money(game.department.funding - selectedCourse.cost)}` : `Funding: ${money(game.department.funding)} of ${money(selectedCourse.cost)} needed`}</p><p>{Math.max(0, game.department.trainingSlots - inTraining)} training {game.department.trainingSlots - inTraining === 1 ? 'slot' : 'slots'} free</p><p className="dim">Away from squad duties for {selectedCourse.hours} real hours. Grants arrive on completion; XP may also improve a rating.</p></div>
        {feedback?.courseId === selectedCourse.id && <p className="reason" role="status">{feedback.text}</p>}
      </div> : <div className="training-candidates">
        <div className="training-comparison-intro"><p>{selectedCourse.grants.cert ? `Certification on completion: ${CERT_LABEL[selectedCourse.grants.cert]}.` : `Compare current ratings and direct course gains. Enrol below ${COURSE_RATING_CEILING}.`} Gains arrive on completion; XP may also improve a rating.</p><p className="dim" role="status">{eligible} can enrol · {candidates.length - eligible} unavailable · Stress: lower is better</p></div>
        {selectedCourse.requiresNode && !game.department.unlockedNodes.includes(selectedCourse.requiresNode) && <div className="training-program-lock"><p className="reason">Requires {DEV_NODES[selectedCourse.requiresNode]?.name ?? selectedCourse.requiresNode}</p><Button size="sm" onClick={() => openDevelopment(selectedCourse.requiresNode!)}>View development program</Button></div>}
        {!candidates.length && <EmptyState icon="people" title="No officers to train">Recruit an officer before starting a course.</EmptyState>}
        {candidates.map((candidate) => <TrainingOfficerCard key={candidate.officer.id} candidate={candidate} now={game.department.clockHighWater} selected={candidate.officer.id === officerId} onSelect={() => {
          setOfficerId(candidate.officer.id);
          setFeedback(null);
          chooser.current?.review(candidate.officer.id);
        }} />)}
      </div>)}
    </Sheet>
  </div>;
}

/** Keep the previous Enrol hit area inert so a repeated tap cannot dismiss the sheet. */
export function TrainingEnrolmentActions({ course, onDone }: { course: Course; onDone: () => void }) {
  return <>
    <p className="training-confirm-cost">{money(course.cost)} funding paid · {course.hours} real hours</p>
    <div className="training-confirm-actions"><Button variant="primary" onClick={(event) => { if (event.detail <= 1) onDone(); }}>Done</Button><Button disabled>Enrolled</Button></div>
  </>;
}

export function TrainingEnrolmentReceipt({ course, enrolment, officer, now }: { course: Course; enrolment: TrainingEnrolment; officer?: Officer; now: number }) {
  const assignment = officer?.assignment;
  const inTraining = assignment?.kind === 'training' && assignment.courseId === course.id && assignment.startedAt === enrolment.startedAt;
  const completed = !!officer && !inTraining && now >= enrolment.endsAt;
  const rating = course.grants.rating;
  const cert = course.grants.cert;
  return <div className="training-enrolment" data-training-enrolment={course.id}>
    <div className="training-person">
      {officer && <Portrait officer={officer} size={52} className="training-portrait" />}
      <div className="training-person-name"><strong>{enrolment.officerName}</strong><span>{course.name}</span><span className="training-eligible" role="status">{inTraining ? `In training · ${duration(assignment.endsAt - now)} remaining` : completed ? 'Course completed' : officer ? trainingOfficerCondition(officer, now) : 'No longer on the roster'}</span></div>
    </div>
    <div className="training-confirm-details"><strong>{completed ? 'Course completion benefits' : 'On completion'}</strong><p className="training-course-gain">{cert ? `Earn ${CERT_LABEL[cert]}` : rating ? `+${rating.delta} ${RATING_META.find((meta) => meta.key === rating.key)?.label ?? rating.key}` : ''}</p><p>+{courseXpGain(course.hours)} XP</p><p className="dim">{inTraining ? 'Away from squad duties until training finishes. Gains arrive on completion; XP may also improve a rating.' : completed ? 'Training has finished. Course gains and XP have been applied.' : 'Enrolment recorded. Check the officer’s current assignment for their availability.'}</p></div>
  </div>;
}

function TrainingGain({ course, officer, compact = false }: { course: Course; officer: Officer; compact?: boolean }) {
  const gain = trainingRatingGain(course, officer);
  const cert = course.grants.cert;
  if (gain) return <p className={`training-gain${gain.delta ? ' training-gain-positive' : ''}`}>
    {!compact && <span>Direct course gain</span>}
    <strong>{RATING_META.find((meta) => meta.key === gain.key)?.short}: {gain.before} → {gain.after}</strong>
    {(!compact || !gain.delta) && <span>{gain.delta ? `+${gain.delta} on completion` : `Enrolment cutoff reached (${COURSE_RATING_CEILING})`}</span>}
  </p>;
  return cert ? <p className="training-gain"><strong>{officer.certs.includes(cert) ? `Already certified: ${CERT_LABEL[cert]}` : `Earns ${CERT_LABEL[cert]}`}</strong></p> : null;
}

/** Comparison and confirmation share the same live eligibility and gain presentation. */
export function TrainingOfficerCard({ candidate: { officer, option }, now, selected, onSelect }: { candidate: TrainingCandidate; now: number; selected?: boolean; onSelect?: () => void }) {
  const keys = trainingRatingKeys(option.course);
  return <article className={`training-officer-card${selected ? ' training-officer-selected' : ''}`} data-training-candidate={officer.id} tabIndex={-1} aria-label={`${fullName(officer)}, ${option.available ? 'can enrol' : 'unavailable'}`}>
    <div className="training-person"><Portrait officer={officer} size={52} className="training-portrait" /><div className="training-person-name"><strong>{fullName(officer)}</strong><span className="dim">{ROLE_META[officer.role].label}{officer.squadId ? ` · Squad ${officer.squadId}` : ' · Unassigned'}</span><span className="training-condition">{trainingOfficerCondition(officer, now)} · Stress {Math.round(officer.stress)}/100</span></div>{selected && <span className="training-selected-label">Selected</span>}</div>
    <div className="training-rating-list" aria-label="Current relevant ratings">{keys.map((key) => {
      const meta = RATING_META.find((rating) => rating.key === key)!;
      return <div className="training-rating" key={key}><div><span title={meta.label}>{meta.short}</span><strong>{officer.ratings[key]}</strong></div><Meter value={officer.ratings[key]} label={meta.label} /></div>;
    })}</div>
    <div className="training-benefits" aria-label="On completion"><TrainingGain course={option.course} officer={officer} compact /><span className="training-xp">+{courseXpGain(option.course.hours)} XP</span></div>
    {!!option.course.requiresCerts?.length && <p className="training-prerequisite">Prior qualification: {option.course.requiresCerts.map((cert) => `${CERT_LABEL[cert]} (${officer.certs.includes(cert) ? 'held' : 'needed'})`).join(' · ')}</p>}
    {option.reason ? <p className="reason">{option.reason}</p> : !onSelect && <p className="training-eligible">Can enrol</p>}
    {onSelect && <Button block size="sm" variant={option.available ? 'primary' : 'secondary'} disabled={!option.available} onClick={onSelect} aria-label={`Select ${fullName(officer)} for ${option.course.name}`}>Select {officer.firstName}</Button>}
  </article>;
}
