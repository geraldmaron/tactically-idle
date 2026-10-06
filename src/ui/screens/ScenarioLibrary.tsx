import { useState } from 'react';
import './scenario-library.css';
import { SCENARIO_RECIPES_V9, SCENARIO_TYPES_V9, specForRecipe } from '../../content/scenario-recipes';
import { incidentId } from '../../gen/incident';
import { getScenario } from '../../sim/scenario-registry';
import { Button, Card, Section } from '../components/ui';
import { familyBlurb } from '../components/incident';

/** Only the selected recipe is generated and rendered. A catalog is not 100 cards. */
export function ScenarioLibrary({ onPrepare }: { onPrepare: (id: string) => void }) {
  const [type, setType] = useState(SCENARIO_TYPES_V9[0].type);
  const [index, setIndex] = useState(0);
  const [variation, setVariation] = useState(0);
  const recipes = SCENARIO_RECIPES_V9.filter(recipe => recipe.type === type);
  const recipe = recipes[Math.min(index, recipes.length - 1)];
  const scenario = getScenario(incidentId(specForRecipe(recipe, 7 + variation)));
  return <Section title="Scenario library" icon="flag" hint="100 scenarios across 14 story frameworks. Explore a situation in practice with virtual gear and no lasting consequences.">
    <Card className="scenario-library-card">
      <label className="field">Story framework
        <select value={type} onChange={event => { setType(event.target.value as typeof type); setIndex(0); setVariation(0); }}>
          {SCENARIO_TYPES_V9.map(info => <option key={info.type} value={info.type}>{info.label} ({info.count})</option>)}
        </select>
      </label>
      {scenario ? <>
        <h3>{scenario.title}</h3><p>{scenario.variantLabel}</p><p className="dim">{familyBlurb(recipe.familyId)}</p>
        <p>{scenario.summary}</p>
        <p>{recipe.characteristic === 'deliberate_answers' ? 'The reported speaker needs extra time to consider questions.' : 'Standard conversation pacing.'}</p>
        <div className="scenario-library-nav">
          <Button disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Previous scenario">Previous</Button>
          <span role="status" aria-live="polite">{index + 1} of {recipes.length}</span>
          <Button disabled={index >= recipes.length - 1} onClick={() => setIndex(index + 1)} aria-label="Next scenario">Next</Button>
        </div>
        <p className="dim">Variation {variation + 1}. A new variation changes names, furnishings, and placement while keeping this situation.</p>
        <Button onClick={() => setVariation(variation + 1)}>New variation</Button>
        <Button block variant="primary" onClick={() => onPrepare(scenario.id)}>Practice this scenario</Button>
      </> : <p role="alert">This scenario could not be prepared. Choose another scenario.</p>}
    </Card>
  </Section>;
}
