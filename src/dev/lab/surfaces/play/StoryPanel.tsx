// The author's reading view of a call's backstory (owner and Codex challenge, 2026-10-23): the scene
// before the call, then who each key person was before today, set at desktop size in the phone's
// column. It reads the same scenario fields the player's brief does (PrepBriefing, DepthBrief), with the
// same names, so there is no second copy to keep in step. Hidden truth stays in the Truth rail; the
// player's orders and reported facts stay in the Brief preview.
import { useMemo } from 'react';
import { PeopleProvider, PeopleText } from '../../../../ui/people/PeopleText';
import { lexiconFor } from '../../../../ui/people/lexicon';
import { getScenario } from '../../../../sim/scenario-registry';
import type { GameState } from '../../../../sim/types';

export function StoryPanel({ state, names }: { state: GameState; names: boolean }) {
  const run = state.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : undefined;
  const lexicon = useMemo(() => (scenario && names ? lexiconFor(scenario, null, []) : null), [scenario, names]);
  if (!scenario) return <div className="lab-story"><p className="lab-muted">The story opens when the call does.</p></div>;
  const people = scenario.briefing.people ?? [];
  return (
    <PeopleProvider lexicon={lexicon}>
      <article className="lab-story" aria-label="Backstory">
        <header className="lab-story-head">
          <h2>{scenario.title}</h2>
          <p><PeopleText text={scenario.summary} /></p>
          <nav className="lab-story-jump" aria-label="Jump to">
            {scenario.coldOpen && <a href="#lab-story-scene">Before the call</a>}
            {people.map(person => <a key={person.personId} href={`#lab-story-${person.personId}`}>{person.name.split(/\s+/)[0]}</a>)}
          </nav>
        </header>
        {!scenario.coldOpen && people.length === 0 && <p className="lab-muted">This call has no backstory written.</p>}
        {scenario.coldOpen && <section id="lab-story-scene" className="lab-story-block">
          <h3>Before the call</h3>
          <p className="lab-story-scene"><PeopleText text={scenario.coldOpen} /></p>
        </section>}
        {people.length > 0 && <section className="lab-story-block" aria-label="Who they are">
          <h3>Who they are</h3>
          <ul className="lab-story-people">{people.map(person => (
            <li key={person.personId} id={`lab-story-${person.personId}`}>
              <span className="lab-story-who"><b><PeopleText text={person.name} /></b>{person.role && <span className="lab-muted">{person.role}</span>}</span>
              <p><PeopleText text={person.text} /></p>
            </li>
          ))}</ul>
        </section>}
      </article>
    </PeopleProvider>
  );
}
