# Mobile interaction patterns

This pass addresses decision clarity and comparison, in addition to responsive containment.

## Selection and navigation

- Related views use one horizontal row, with a clear selected state and 44px minimum targets.
- Labels stay together. Larger sets scroll within their own rail rather than wrapping into a second row or shrinking text.
- Filter groups expose radio semantics; view destinations expose navigation semantics; squad tabs identify the panel they control.
- Arrow keys and Home/End move through available choices. Selection reveals the option horizontally without scrolling the surrounding page.
- The five main destinations remain HQ, Squad, Ops, Develop and Gear. Shared control styling also covers duties and deployed squads.

## Training

Choose a course before comparing officers. The comparison keeps the course, duration and funding cost in view, shows portraits and the same relevant ratings for each candidate, then confirms the named enrolment. Availability uses the simulation's enrolment rules; stress, injury and deployment are presented as distinct facts.

Direct rating gains and XP are different benefits. The existing 85 rating threshold governs new enrolment, while a course already started preserves its full authored gain up to 100. Every course also grants its existing hours × 5 XP. No new qualification, growth rule or recommendation score is introduced.

## Results and progression

Debriefs lead with objective, safety and rewards. Meaningful officer changes receive portraits and visual stress comparisons. Unchanged practice participants are grouped, and detailed evidence and logs remain available through disclosure controls. Harm and losses remain prominent.

Officer XP fills a real progress gauge toward the next primary-rating point, using the same career threshold and bank as the simulation. There is no invented officer level. Archived debriefs display recorded deltas rather than reconstructing past progress from the current roster.

## Verification

Automated checks cover eligibility, direct grants, XP thresholds, maximum ratings, archived results, unavailable selections, keyboard order, navigation history and saved drafts. Before release, inspect the actual 320px and 390px screens, long labels, larger text, selected/busy/empty states, Cancel/Back/Forward and repeated enrolment. Passing markup or width checks alone does not prove a usable comparison flow.

## Design references

- [Apple gauges](https://developer.apple.com/design/human-interface-guidelines/gauges): real values within an understandable range
- [Apple layout](https://developer.apple.com/design/human-interface-guidelines/layout): grouping, hierarchy and scanning
- [Material scrollable tabs](https://github.com/material-components/material-components-android/blob/master/docs/components/Tabs.md#adding-scrollable-tabs): overflow within a single row
- [WAI-ARIA tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) and [modal dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): keyboard and focus behavior
