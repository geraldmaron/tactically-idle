import { courseFee } from '../../sim/staff-pool';
import { useEffect, useId, useRef, useState } from 'react';
import { COURSES, COURSE_RATING_CEILING, courseXpGain } from '../../content/courses';
import { DEV_NODES } from '../../content/dev-tree';
import { courseOptions } from '../../sim/department-selectors';
import { fullName } from '../../sim/officer';
import type { CertId, Course, Id, Officer } from '../../sim/types';
import { CERT_ICON, RATING_META, ROLE_META } from '../components/labels';
import { StressDisplay } from '../components/StressDisplay';
import { Icon, type IconName } from '../icons';
import { useBeat } from '../components/Beat';
import { Face } from '../components/Face';
import { enrolledBeat } from '../screens/team-beats';
import { picksLine, splitCourses } from './training-picks';
import { Button, Card, Chip, EmptyState, RatingBars, Row } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { Portrait } from '../portraits/Portrait';
import { duration, moneyFull as money } from '../format';
import { EmblemArt } from '../art/EmblemArt';
import { getState, useGame } from '../store';
import { useNav, type TrainingDraft, type TrainingFocus } from '../components/nav';
import { trainingCandidates, trainingOfficerCondition, trainingRatingGain, trainingRatingKeys, trainingStrongestRatings, type TrainingCandidate } from './training-officers';
import { createTrainingChooserNavigation, type TrainingChoice, type TrainingEnrolment } from './training-chooser-navigation';
import './training-store.css';
import '../screens/squad-visual.css';
import './storefront.css';
import { CERT_NAME } from '../../content/certs';
import { squadName } from '../../sim/squad-names';

/** Apply a deep link once; returning from Develop keeps the officer and search the player edited. */
export function trainingDraftForRequest(draft: TrainingDraft, focus: TrainingFocus, request: number): TrainingDraft {
  if (draft.request === request) return draft;
  return {
    officerId: focus.officerId ?? draft.officerId,
    search: focus.courseId ? COURSES[focus.courseId]?.name ?? '' : focus.certId ? CERT_NAME[focus.certId] : focus.officerId ? '' : draft.search,
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
  // The fee actually charged: the Training Sergeant's discount, when one is in post.
  const fee = (cost: number) => courseFee(game, cost);
  const beat = useBeat();
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
  const [feedback, setFeedback] = useState<{ courseId: Id; ok: boolean; text: string } | null>(null);
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
    .filter(({ course }) => [course.name, course.grants.cert ? CERT_NAME[course.grants.cert] : '', course.grants.rating?.key ?? ''].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const inTraining = officers.filter((member) => member.assignment?.kind === 'training').length;
  // What holds the chosen officer back from every course (already in training, deployed) is said once, on the
  // officer, not on each course card: by the condition line when it is an assignment, else by its own line.
  // A full department is shown by the places pips instead.
  const sharedReason = officer ? sharedHoldBack(options.map(({ reason }) => reason), fullName(officer)) : null;
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
  /** A pick's face goes straight to the review for that officer, so the confirm still shows the cost. */
  const openReview = (id: Id, pickedOfficerId: Id) => {
    openChooser(id);
    chooser.current?.review(pickedOfficerId);
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
    // ENROLLED replaces the success toast: the beat is the one announcement.
    const result = beat.act({ type: 'startCourse', officerId: reviewing.officer.id, courseId: selectedCourse.id }, enrolledBeat(reviewing.officer, selectedCourse));
    setFeedback({ courseId: selectedCourse.id, ok: result.ok, text: result.ok ? `${fullName(reviewing.officer)} is training for ${selectedCourse.hours} real hours.` : result.reason });
    if (result.ok) {
      const assignment = getState().officers[reviewing.officer.id]?.assignment;
      if (assignment?.kind === 'training') chooser.current?.complete({ officerName: fullName(reviewing.officer), startedAt: assignment.startedAt, endsAt: assignment.endsAt });
    }
    else submitting.current = false;
  };
  const freePlaces = Math.max(0, game.department.trainingSlots - inTraining);
  return <div ref={root} className="store-training">
    <div className="training-top">
      <h2 className="section-title training-heading sr-only" tabIndex={-1}>Training</h2>
      <TrainingPlaces used={inTraining} total={game.department.trainingSlots} />
    </div>
    {officer && <section className="training-selected-officer" aria-label="Officer to train" data-training-officer-id={officer.id}>
      <Portrait officer={officer} size={44} className="training-portrait" />
      <div className="training-person-name"><strong>{fullName(officer)}</strong><span className="dim">{ROLE_META[officer.role].label} · {trainingOfficerCondition(officer, game.department.clockHighWater)}</span><span className="training-strengths">Highest ratings: {trainingStrongestRatings(officer).map((rating) => `${rating.short} ${officer.ratings[rating.key]}`).join(' · ')}</span></div>
      <StressDisplay value={officer.stress} compact />
      {sharedReason && !officer.assignment && <p className="reason training-officer-reason" role="status">{sharedReason}</p>}
      <Button size="sm" variant="ghost" icon="x" className="training-clear" onClick={() => setOfficerId('')} aria-label={`Clear ${fullName(officer)} as the officer to train`} />
    </section>}
    <div className="training-search">
      <label className="field"><span className="field-label sr-only">Search courses</span><Icon name="search" size={16} /><input type="search" placeholder="Course or certification" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <span className="training-count" role="status">{options.length} of {Object.keys(COURSES).length}</span>
    </div>
    {search && <Button size="sm" variant="ghost" onClick={() => setSearch('')}>Show all training</Button>}
    {!officers.length && <EmptyState spot="noCandidates" title="No officers to train">Recruit an officer before starting a course.</EmptyState>}
    {(() => {
      const split = splitCourses(game, options.map(({ course }) => course));
      const optionOf = (id: Id) => options.find(({ course }) => course.id === id)!;
      return <>
        {split.start.length > 0 && <section className="course-group" aria-labelledby="course-start-h">
          <h3 id="course-start-h" className="course-group-label">Start now<span>{split.start.length}</span></h3>
          <Card className="course-card"><div className="course-grid" data-ui-list>{split.start.map(({ course, picks }) => {
            const { available, reason } = optionOf(course.id);
            const rating = course.grants.rating;
            const cert = course.grants.cert;
            const ratingMeta = rating ? RATING_META.find((meta) => meta.key === rating.key) : undefined;
            const line = picksLine(picks);
            return <article className={`course-tile training-course${courseId === course.id ? ' training-course-highlight' : ''}${officer && available ? ' course-tile-ready' : ''}`} key={course.id} data-course-id={course.id} tabIndex={courseId === course.id ? -1 : undefined} aria-label={course.name}>
              <Row lead={<CourseEmblem course={course} size={40} />} title={course.name}
                detail={<span className="course-tile-meta"><span><Icon name="clock" size={16} />{course.hours}h</span><span><Icon name="cash" size={16} />{money(fee(course.cost))}</span></span>}
                trail={<Button size="sm" variant="primary" disabled={!officers.length} aria-label={`Choose officer for ${course.name}`} onClick={() => openChooser(course.id)}>Choose officer</Button>} />
              <div className="course-tile-more">
                <div className="course-tile-gains">
                  {cert ? <Chip tone="mint" icon={CERT_ICON[cert]}>Earn {CERT_NAME[cert]}</Chip> : rating ? <Chip tone="mint" icon={ratingMeta?.icon}>+{rating.delta} {ratingMeta?.label ?? rating.key}</Chip> : null}
                  <Chip icon="trend">+{courseXpGain(course.hours)} XP</Chip>
                </div>
                {line && <div className="course-picks">
                  <span className="course-picks-faces">{picks.map((pick) => <button type="button" key={pick.officer.id} className="course-pick" aria-label={`Review ${fullName(pick.officer)} for ${course.name}`} onClick={() => openReview(course.id, pick.officer.id)}><Face size="sm" kind="officer" officer={pick.officer} /></button>)}</span>
                  <span className="course-picks-line">{line}</span>
                </div>}
                {!line && officers.length > 0 && <p className="course-tile-note">Nobody is free to take this now.</p>}
                {rating && <p className="course-tile-note">Enrol below {COURSE_RATING_CEILING}</p>}
                {officer && <div className="training-course-personal"><span className="dim">For {officer.firstName}</span><TrainingGain course={course} officer={officer} compact /></div>}
                {/* A full department is shown once by the places pips, not repeated on every tile. */}
                {reason && reason !== 'No free training slot' && reason !== sharedReason && <p className="reason">{reason}</p>}
                {officer && available && <p className="training-eligible"><Icon name="check" size={16} />{officer.firstName} can enrol</p>}
                {feedback?.courseId === course.id && <p className={feedback.ok ? 'training-course-receipt' : 'reason'} role="status">{feedback.ok && <Icon name="check" size={16} />}{feedback.text}</p>}
              </div>
            </article>;
          })}</div></Card>
        </section>}
        {split.later.length > 0 && <section className="course-group" aria-labelledby="course-later-h">
          <h3 id="course-later-h" className="course-group-label">Opens later<span>{split.later.length}</span></h3>
          <Card className="course-card"><div className="course-grid" data-ui-list>{split.later.map(({ course, gate }) => {
            const rating = course.grants.rating;
            const cert = course.grants.cert;
            const ratingMeta = rating ? RATING_META.find((meta) => meta.key === rating.key) : undefined;
            const via = gate.kind === 'cert' && gate.via ? COURSES[gate.via] : null;
            // A course held back by a qualification links to the course that grants it, or to the Build room that opens that one.
            const viaNode = via?.requiresNode && !game.department.unlockedNodes.includes(via.requiresNode) ? via.requiresNode : null;
            return <article className={`course-tile training-course course-tile-locked${courseId === course.id ? ' training-course-highlight' : ''}`} key={course.id} data-course-id={course.id} tabIndex={courseId === course.id ? -1 : undefined} aria-label={`${course.name}, opens later`}>
              <Row lead={<CourseEmblem course={course} locked size={40} />} title={course.name}
                detail={<span className="course-tile-meta"><span className="course-tile-need"><Icon name="lock" size={16} />{gate.line}</span></span>}
                trail={gate.kind === 'node'
                  ? <Button size="sm" variant="secondary" icon="unlock" aria-label={`View development program for ${course.name}`} onClick={() => openDevelopment(gate.nodeId)}>Open in Build</Button>
                  : via ? <Button size="sm" variant="secondary" icon="arrowRight" aria-label={`See ${via.name}, the course that opens ${course.name}`} onClick={() => {
                    if (viaNode) openDevelopment(viaNode);
                    else { const target = root.current?.querySelector<HTMLElement>(`[data-course-id="${via.id}"]`); target?.scrollIntoView({ block: 'center' }); target?.focus({ preventScroll: true }); }
                  }}>{viaNode ? 'Open in Build' : `See ${via.name}`}</Button> : null} />
              <div className="course-tile-more">
                <div className="course-tile-gains">
                  {cert ? <Chip icon={CERT_ICON[cert]}>Earns {CERT_NAME[cert]}</Chip> : rating ? <Chip icon={ratingMeta?.icon}>+{rating.delta} {ratingMeta?.label ?? rating.key}</Chip> : null}
                  <Chip icon="clock">{course.hours}h</Chip>
                  <Chip icon="cash">{money(fee(course.cost))}</Chip>
                </div>
              </div>
            </article>;
          })}</div></Card>
        </section>}
      </>;
    })()}
    {!options.length && <EmptyState spot="nothingInStock" title="No courses match">Clear the course search to see all training.</EmptyState>}
    <Sheet open={!!selectedCourse} onClose={closeChooser} title={choice?.enrolment ? 'Enrolment confirmed' : reviewing ? 'Review enrolment' : 'Choose officer'} subtitle={selectedCourse ? `${selectedCourse.name} · ${money(fee(selectedCourse.cost))} · ${selectedCourse.hours}h` : undefined} className="training-chooser" footer={selectedCourse && <div className="training-chooser-footer">
      {choice?.enrolment ? <TrainingEnrolmentActions course={selectedCourse} paid={fee(selectedCourse.cost)} onDone={closeChooser} /> : reviewing ? <>
        <p className="training-confirm-cost">{money(fee(selectedCourse.cost))} funding · 1 slot · {selectedCourse.hours} real hours</p>
        <div className="training-confirm-actions"><Button onClick={backToCandidates}>Back</Button><Button variant="primary" disabled={!reviewing.option.available} onClick={enrol} aria-label={`Enrol ${fullName(reviewing.officer)} in ${selectedCourse.name} for ${money(fee(selectedCourse.cost))}`}>Enrol officer</Button></div>
      </> : <Button block onClick={closeChooser}>Cancel</Button>}
    </div>}>
      {selectedCourse && (choice?.enrolment ? <div className="training-review">
        <h3 ref={reviewHeading} className="training-review-heading" tabIndex={-1}>{choice.enrolment.officerName} enrolled</h3>
        <TrainingEnrolmentReceipt course={selectedCourse} enrolment={choice.enrolment} officer={game.officers[choice.reviewOfficerId!]} now={game.department.clockHighWater} />
      </div> : reviewing ? <div className="training-review">
        <h3 ref={reviewHeading} className="training-review-heading" tabIndex={-1}>Confirm {fullName(reviewing.officer)}</h3>
        <TrainingOfficerCard candidate={reviewing} now={game.department.clockHighWater} selected />
        <div className="training-confirm-details">
          <p className="training-confirm-line"><Icon name="cash" size={16} />{game.department.funding >= fee(selectedCourse.cost) ? <>Funding {money(game.department.funding)} <span aria-hidden="true">→</span><span className="sr-only"> to </span> {money(game.department.funding - fee(selectedCourse.cost))}</> : `Funding ${money(game.department.funding)} of ${money(fee(selectedCourse.cost))} needed`}</p>
          <p className="training-confirm-line"><Icon name="mortarboard" size={16} />{freePlaces} training {freePlaces === 1 ? 'place' : 'places'} free <TrainingPlaces used={inTraining} total={game.department.trainingSlots} bare /></p>
          <p className="training-confirm-line"><Icon name="clock" size={16} />Away from squad duties for {selectedCourse.hours} real hours</p>
          <p className="dim">Grants arrive on completion. XP may also improve a rating.</p>
        </div>
        {feedback?.courseId === selectedCourse.id && <p className="reason" role="status">{feedback.text}</p>}
      </div> : <div className="training-candidates">
        <div className="training-comparison-intro">
          <div className="course-tile-gains">
            {selectedCourse.grants.cert ? <Chip tone="mint" icon={CERT_ICON[selectedCourse.grants.cert]}>Earn {CERT_NAME[selectedCourse.grants.cert]}</Chip> : selectedCourse.grants.rating ? <Chip tone="mint" icon={RATING_META.find((meta) => meta.key === selectedCourse.grants.rating!.key)?.icon}>+{selectedCourse.grants.rating.delta} {RATING_META.find((meta) => meta.key === selectedCourse.grants.rating!.key)?.label}</Chip> : null}
            <Chip icon="trend">+{courseXpGain(selectedCourse.hours)} XP</Chip>
            <TrainingPlaces used={inTraining} total={game.department.trainingSlots} />
          </div>
          <p>{selectedCourse.grants.cert ? 'Bars show current ratings that matter for this work.' : `Bars show the gain on completion. Enrol below ${COURSE_RATING_CEILING}.`}</p>
          <p className="dim" role="status">{eligible} can enrol · {candidates.length - eligible} unavailable</p>
        </div>
        {selectedCourse.requiresNode && !game.department.unlockedNodes.includes(selectedCourse.requiresNode) && <div className="training-program-lock"><p className="reason">Requires {DEV_NODES[selectedCourse.requiresNode]?.name ?? selectedCourse.requiresNode}</p><Button size="sm" onClick={() => openDevelopment(selectedCourse.requiresNode!)}>View development program</Button></div>}
        {!candidates.length && <EmptyState spot="noCandidates" title="No officers to train">Recruit an officer before starting a course.</EmptyState>}
        {candidates.map((candidate) => <TrainingOfficerCard key={candidate.officer.id} candidate={candidate} now={game.department.clockHighWater} selected={candidate.officer.id === officerId} onSelect={() => {
          setOfficerId(candidate.officer.id);
          setFeedback(null);
          chooser.current?.review(candidate.officer.id);
        }} />)}
      </div>)}
    </Sheet>
  </div>;
}

/** The reason about the officer (it names them) that two or more courses give: it belongs to the officer, so
 * the screen says it once. Reasons about a course or the department stay on their cards. */
export function sharedHoldBack(reasons: readonly (string | undefined | null)[], officerName: string): string | null {
  const counts = new Map<string, number>();
  for (const reason of reasons) if (reason?.startsWith(officerName)) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  const [top] = [...counts].sort((a, b) => b[1] - a[1]);
  return top && top[1] >= 2 ? top[0] : null;
}

/** Keep the previous Enrol hit area inert so a repeated tap cannot dismiss the sheet. */
export function TrainingEnrolmentActions({ course, paid = course.cost, onDone }: { course: Course; paid?: number; onDone: () => void }) {
  return <>
    <p className="training-confirm-cost">{money(paid)} funding paid · {course.hours} real hours</p>
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
    <div className="training-receipt-emblem"><CourseEmblem course={course} /><span className="training-receipt-check" aria-hidden="true"><Icon name="check" size={20} /></span></div>
    <div className="training-person">
      {officer && <Portrait officer={officer} size={68} className="training-portrait" />}
      <div className="training-person-name"><strong>{enrolment.officerName}</strong><span>{course.name}</span><span className="training-eligible" role="status">{inTraining ? `In training · ${duration(assignment.endsAt - now)} remaining` : completed ? 'Course completed' : officer ? trainingOfficerCondition(officer, now) : 'No longer on the roster'}</span></div>
    </div>
    <div className="training-confirm-details"><strong>{completed ? 'Course completion benefits' : 'On completion'}</strong><p className="training-course-gain">{cert ? `Earn ${CERT_NAME[cert]}` : rating ? `+${rating.delta} ${RATING_META.find((meta) => meta.key === rating.key)?.label ?? rating.key}` : ''}</p><p>+{courseXpGain(course.hours)} XP</p><p className="dim">{inTraining ? 'Away from squad duties until training finishes. Gains arrive on completion; XP may also improve a rating.' : completed ? 'Training has finished. Course gains and XP have been applied.' : 'Enrolment recorded. Check the officer’s current assignment for their availability.'}</p></div>
  </div>;
}

/** Course art when the emblem set lists it as ready; otherwise the certificate or skill icon. */
export function CourseEmblem({ course, locked = false, size = 64 }: { course: Course; locked?: boolean; size?: number }) {
  const icon: IconName = course.grants.cert ? CERT_ICON[course.grants.cert] : RATING_META.find((meta) => meta.key === course.grants.rating?.key)?.icon ?? 'mortarboard';
  return <span className={`node-medallion course-emblem${locked ? ' node-medallion-locked' : ''}`} aria-hidden="true">
    <EmblemArt id={course.id} icon={icon} size={size} iconSize={Math.round(size * 0.56)} />
    {locked && <span className="node-medallion-badge node-badge-locked"><Icon name="lock" size={16} /></span>}
  </span>;
}

/** Training places as pips: filled places are officers already in a course. */
export function TrainingPlaces({ used, total, bare = false }: { used: number; total: number; bare?: boolean }) {
  const pips = <span className="training-pips" aria-hidden="true">{Array.from({ length: Math.max(total, used) }, (_, index) => <i key={index} className={index < used ? 'on' : ''} />)}</span>;
  if (bare) return pips;
  return <span className="training-places" role="img" aria-label={`${used} of ${total} training places in use`}>
    <Icon name="mortarboard" size={16} /><span className="training-places-label">Training places</span>{pips}<b>{used}/{total}</b>
  </span>;
}

function TrainingGain({ course, officer, compact = false }: { course: Course; officer: Officer; compact?: boolean }) {
  const gain = trainingRatingGain(course, officer);
  const cert = course.grants.cert;
  if (gain) return <p className={`training-gain${gain.delta ? ' training-gain-positive' : ''}`}>
    {!compact && <span>Direct course gain</span>}
    <strong>{RATING_META.find((meta) => meta.key === gain.key)?.short}: {gain.before} → {gain.after}</strong>
    {(!compact || !gain.delta) && <span>{gain.delta ? `+${gain.delta} on completion` : `Enrolment cutoff reached (${COURSE_RATING_CEILING})`}</span>}
  </p>;
  return cert ? <p className="training-gain"><strong>{officer.certs.includes(cert) ? `Already certified: ${CERT_NAME[cert]}` : `Earns ${CERT_NAME[cert]}`}</strong></p> : null;
}

/** Comparison and confirmation share the same live eligibility and gain presentation. */
export function TrainingOfficerCard({ candidate: { officer, option }, now, selected, onSelect }: { candidate: TrainingCandidate; now: number; selected?: boolean; onSelect?: () => void }) {
  const keys = trainingRatingKeys(option.course);
  const gain = trainingRatingGain(option.course, officer);
  const { squads } = useGame();
  return <article className={`training-officer-card${selected ? ' training-officer-selected' : ''}${option.available ? '' : ' training-officer-unavailable'}`} data-training-candidate={officer.id} tabIndex={-1} aria-label={`${fullName(officer)}, ${option.available ? 'can enrol' : 'unavailable'}`}>
    <div className="training-person">
      <Portrait officer={officer} size={44} className="training-portrait" />
      <div className="training-person-name"><strong>{fullName(officer)}</strong><span className="dim"><Icon name={ROLE_META[officer.role].icon} size={16} /> {ROLE_META[officer.role].label}{officer.squadId ? ` · ${squadName(squads, officer.squadId)}` : ' · Unassigned'}</span><span className="training-condition">{trainingOfficerCondition(officer, now)}</span></div>
      <StressDisplay value={officer.stress} compact />
      {onSelect && <Button size="sm" variant={option.available ? 'primary' : 'secondary'} disabled={!option.available} onClick={onSelect} aria-label={`Select ${fullName(officer)} for ${option.course.name}`} className="training-select">Select</Button>}
      {selected && !onSelect && <span className="training-selected-label">Selected</span>}
    </div>
    <RatingBars ratings={officer.ratings} only={keys} dense gains={gain && gain.delta ? { [gain.key]: gain.after } : undefined} label="Current relevant ratings" />
    {!gain?.delta && <div className="training-benefits" aria-label="On completion"><TrainingGain course={option.course} officer={officer} compact /><span className="training-xp">+{courseXpGain(option.course.hours)} XP</span></div>}
    {!!option.course.requiresCerts?.length && <p className="training-prerequisite">Prior qualification: {option.course.requiresCerts.map((cert) => `${CERT_NAME[cert]} (${officer.certs.includes(cert) ? 'held' : 'needed'})`).join(' · ')}</p>}
    {option.reason ? <p className="reason">{option.reason}</p> : !onSelect && <p className="training-eligible">Can enrol</p>}
  </article>;
}
