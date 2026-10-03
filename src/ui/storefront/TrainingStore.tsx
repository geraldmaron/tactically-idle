import { useEffect, useState } from 'react';
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

export function TrainingStore({ requestedCert, requestKey, onDevelopment }: { requestedCert?: CertId; requestKey: number; onDevelopment: (nodeId: Id) => void }) {
  const game = useGame();
  const { act } = useToast();
  const [officerId, setOfficerId] = useState<Id>('');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ courseId: Id; text: string } | null>(null);
  useEffect(() => { if (requestedCert) setSearch(CERT_LABEL[requestedCert]); }, [requestedCert, requestKey]);
  const officers = Object.values(game.officers).sort((a, b) => a.surname.localeCompare(b.surname) || a.id.localeCompare(b.id));
  const officer = game.officers[officerId];
  const options = courseOptions(game, officer?.id ?? null, game.department.clockHighWater)
    .filter(({ course }) => [course.name, course.grants.cert ? CERT_LABEL[course.grants.cert] : '', course.grants.rating?.key ?? ''].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const inTraining = officers.filter((member) => member.assignment?.kind === 'training').length;
  return <div className="store-training">
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
      return <article className="store-card" key={course.id}>
        <div className="store-card-heading"><div><span className="kicker">{cert ? 'Certification' : 'Skills course'}</span><h3>{course.name}</h3></div><Chip icon="clock">{course.hours}h</Chip></div>
        <p>{cert ? `Earns ${CERT_LABEL[cert]} on completion.` : rating ? `Adds ${rating.delta} ${RATING_META.find((meta) => meta.key === rating.key)?.label ?? rating.key} on completion, up to ${COURSE_RATING_CEILING}.` : ''}</p>
        {!!course.requiresCerts?.length && <p className="dim">Prior qualification: {course.requiresCerts.map((required) => CERT_LABEL[required]).join(' + ')}.</p>}
        {course.requiresNode && <p className={locked ? 'reason' : 'dim'}>{locked ? 'Requires' : 'Program unlocked:'} {DEV_NODES[course.requiresNode]?.name ?? course.requiresNode}.</p>}
        {locked && <Button size="sm" onClick={() => onDevelopment(course.requiresNode!)}>View development program</Button>}
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
