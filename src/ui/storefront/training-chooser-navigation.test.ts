import { describe, expect, it } from 'vitest';
import { createTrainingChooserNavigation, TRAINING_CHOOSER_HISTORY_KEY, type TrainingChoice } from './training-chooser-navigation';

function fixture() {
  const route = { tab: 'squad', returnToItem: 'camera_drone', trainingRequest: 1 };
  const entries: Record<string, unknown>[] = [{ route }];
  let position = 0, backCalls = 0, request = 1;
  let selected: TrainingChoice | null = null;
  const history = {
    get state() { return entries[position]; },
    pushState(data: Record<string, unknown>) { entries.splice(position + 1); entries.push(data); position++; },
    replaceState(data: Record<string, unknown>) { entries[position] = data; },
    back() { backCalls++; },
  };
  const nav = createTrainingChooserNavigation(history, { owner: 'training-1', request: () => request, select: (choice) => { selected = choice; } });
  return { nav, entries, route, selected: () => selected, state: () => history.state, backCalls: () => backCalls,
    back() { position--; nav.onPop(); }, forward() { position++; nav.onPop(); }, newRequest() { request++; nav.discard(); } };
}

describe('training chooser navigation', () => {
  it('browser Back dismisses and Forward restores the same course and review', () => {
    const f = fixture();
    f.nav.open('drone_course');
    f.nav.review('off_chen');
    expect(f.selected()).toMatchObject({ courseId: 'drone_course', reviewOfficerId: 'off_chen' });
    f.back();
    expect(f.selected()).toBeNull();
    f.forward();
    expect(f.selected()).toMatchObject({ courseId: 'drone_course', reviewOfficerId: 'off_chen' });
    expect(f.state().route).toEqual(f.route);
  });

  it('review Back returns to comparisons without adding history or spending', () => {
    const f = fixture();
    f.nav.open('composure_workshop'); f.nav.review('off_chen'); f.nav.review(null);
    expect(f.selected()).toMatchObject({ courseId: 'composure_workshop', reviewOfficerId: null });
    expect(f.entries).toHaveLength(2);
    expect(f.backCalls()).toBe(0);
  });

  it('Cancel requests one Back and blocks repeated open/close races', () => {
    const f = fixture();
    expect(f.nav.open('composure_workshop')).toBe(true);
    expect(f.nav.open('drone_course')).toBe(false);
    f.nav.close(); f.nav.close();
    expect(f.selected()).toBeNull();
    expect(f.backCalls()).toBe(1);
    expect(f.nav.open('drone_course')).toBe(false);
    f.back();
    expect(f.nav.open('drone_course')).toBe(true);
    expect(f.entries).toHaveLength(2);
  });

  it('completed enrolment cannot be restored as a stale confirmation by Forward', () => {
    const f = fixture();
    f.nav.open('composure_workshop'); f.nav.review('off_chen'); f.nav.close(true);
    expect(f.state()[TRAINING_CHOOSER_HISTORY_KEY]).toBeUndefined();
    f.back(); f.forward();
    expect(f.selected()).toBeNull();
    expect(f.state().route).toEqual(f.route);
  });

  it('a newer training request or development navigation clears only local chooser state', () => {
    const f = fixture();
    f.nav.open('drone_course'); f.nav.review('off_chen'); f.newRequest();
    expect(f.selected()).toBeNull();
    expect(f.state()).toEqual({ route: f.route });
    expect(f.backCalls()).toBe(0);
    f.nav.open('first_aid_course'); f.nav.discard();
    expect(f.state()).toEqual({ route: f.route });
  });

  it('unmount cleanup preserves the prerequisite return route', () => {
    const f = fixture();
    f.nav.open('drone_course'); f.nav.dispose();
    expect(f.state()).toEqual({ route: f.route });
    expect(f.backCalls()).toBe(0);
  });
});
