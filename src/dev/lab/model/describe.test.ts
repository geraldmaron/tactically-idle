// Review finding duplicate-ending-titles: two hostage endings share the title "Both still inside", so
// the lab's lists (Flow, Outcomes, the palette) read the same twice. The lab tells them apart by each
// one's first remaining task; the authored title, which the player reads, is the content's to change.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { plainTokens } from '../../../gen/incident/trees-v13/dependencies';
import { endingListTitle, endingTwinCrumb } from './describe';

const TEMPLATES = Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[];

describe('endings with the same title', () => {
  const hostage = INCIDENT_TEMPLATES.hostage_crisis as IncidentTemplate;
  it('get their first remaining task as a crumb; every other ending keeps its title alone', () => {
    expect(hostage.tree.endings.held_both.title).toBe(hostage.tree.endings.held_both_down.title);
    expect(endingTwinCrumb(hostage.tree, 'held_both')).toBe(hostage.tree.endings.held_both.remainingTasks![0]);
    expect(endingTwinCrumb(hostage.tree, 'held_both_down')).toBe(hostage.tree.endings.held_both_down.remainingTasks![0]);
    expect(endingTwinCrumb(hostage.tree, 'held_inside')).toBeNull();
    expect(endingListTitle(hostage.tree, 'held_inside', text => text)).toBe(hostage.tree.endings.held_inside.title);
  });
  for (const template of TEMPLATES) {
    it(`lists every ending of ${template.type} under a title of its own`, () => {
      const bind = (text: string) => plainTokens(text, template.tree);
      const titles = Object.keys(template.tree.endings).map(id => endingListTitle(template.tree, id, bind));
      expect(new Set(titles).size).toBe(titles.length);
    });
  }
});
