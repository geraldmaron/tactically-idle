import { useMemo, useState } from 'react';
import './scenario-library.css';
import { scenarioSituationsV10, specForSituationV10 } from '../../content/scenario-recipes';
import type { ScenarioSituation } from '../../content/scenario-recipes';
import { SCENARIO_TYPES_V10 } from '../../content/scenario-types-v10';
import { ALL_BUILDING_FAMILIES, PROCEDURAL_FAMILIES, baseFamilyIdV7 } from '../../gen/building';
import { incidentId } from '../../gen/incident';
import { getScenario } from '../../sim/scenario-registry';
import type { IncidentType, ScenarioDefinition } from '../../sim/scenario-types';
import { Button, Card, Section } from '../components/ui';
import { FloorsChip, familyBlurb, familyLabel, scenarioFloorCount, settingIcon } from '../components/incident';
import { Icon } from '../icons';

const FIRST_BUILDING_SEED = 7;
/** Layouts tried per variation before showing whatever building the generator chose. */
const NATIVE_SEED_TRIES = 16;

export const isGeneratedBuilding = (familyId: string) => PROCEDURAL_FAMILIES.some((family) => family.id === familyId);

/** Picker text for a building type. Generated types name their floors, because the number
 * of floors changes how a squad searches and is only visible on the map's floor tabs. */
export function buildingOptionLabel(familyId: string): string {
  const family = ALL_BUILDING_FAMILIES.find((f) => f.id === familyId);
  if (!family) return familyLabel(familyId);
  if (!isGeneratedBuilding(familyId)) return `${familyLabel(familyId)} · ${(familyBlurb(familyId) ?? '').split(' · ')[0]}`;
  const [min, max] = family.floors;
  return max < 2 ? familyLabel(familyId) : `${familyLabel(familyId)} · ${min === max ? `${max} floors` : `${min} or ${max} floors`}`;
}

/** The practice scenario for one library choice, and the building seed it uses.
 * A generated layout cannot host every story; the generator then moves the call to
 * another layout, which would show a different building or situation than the one chosen.
 * The library instead steps to the next layout of the chosen type. */
export function libraryScenarioV10(type: IncidentType, familyId: string, situation: ScenarioSituation, fromSeed: number): { scenario: ScenarioDefinition | null; buildingSeed: number } {
  let fallback: { scenario: ScenarioDefinition; buildingSeed: number } | null = null;
  for (let k = 0; k < NATIVE_SEED_TRIES; k++) {
    const buildingSeed = fromSeed + k;
    const scenario = getScenario(incidentId(specForSituationV10(type, familyId, situation, buildingSeed)));
    if (!scenario) continue;
    if (baseFamilyIdV7(scenario.locationFamilyId) === familyId && scenario.locationSeed === buildingSeed) return { scenario, buildingSeed };
    fallback ??= { scenario, buildingSeed };
  }
  return fallback ?? { scenario: null, buildingSeed: fromSeed };
}

/** Only the selected scenario is generated and rendered. A catalog is not hundreds of cards. */
export function ScenarioLibrary({ onPrepare }: { onPrepare: (id: string) => void }) {
  const [type, setType] = useState(SCENARIO_TYPES_V10[0].type);
  const info = SCENARIO_TYPES_V10.find((entry) => entry.type === type)!;
  const [familyId, setFamilyId] = useState(info.families[0]);
  const [index, setIndex] = useState(0);
  const [variation, setVariation] = useState({ number: 1, fromSeed: FIRST_BUILDING_SEED });
  const situations = scenarioSituationsV10(type);
  const situation = situations[Math.min(index, situations.length - 1)];
  const { scenario, buildingSeed } = useMemo(() => libraryScenarioV10(type, familyId, situation, variation.fromSeed), [type, familyId, situation.variant, situation.characteristic, variation.fromSeed]);
  const floors = scenarioFloorCount(scenario);
  const generated = isGeneratedBuilding(familyId);
  const authored = info.families.filter((id) => !isGeneratedBuilding(id));
  const generatedFamilies = info.families.filter(isGeneratedBuilding);
  const chooseType = (next: IncidentType) => {
    setType(next);
    setFamilyId(SCENARIO_TYPES_V10.find((entry) => entry.type === next)!.families[0]);
    setIndex(0);
    setVariation({ number: 1, fromSeed: FIRST_BUILDING_SEED });
  };
  const chooseBuilding = (next: string) => {
    setFamilyId(next);
    setVariation({ number: 1, fromSeed: FIRST_BUILDING_SEED });
  };
  return <Section title="Scenario library" icon="flag" hint="14 story frameworks, each with six situations, in fixed and generated buildings. Explore one in practice with virtual gear and no lasting consequences.">
    <Card className="scenario-library-card">
      <label className="field">Story framework
        <select value={type} onChange={(event) => chooseType(event.target.value as IncidentType)}>
          {SCENARIO_TYPES_V10.map((entry) => <option key={entry.type} value={entry.type}>{entry.label}</option>)}
        </select>
      </label>
      <label className="field">Building
        <select value={familyId} onChange={(event) => chooseBuilding(event.target.value)}>
          {generatedFamilies.length ? <>
            <optgroup label="Fixed layouts">{authored.map((id) => <option key={id} value={id}>{buildingOptionLabel(id)}</option>)}</optgroup>
            <optgroup label="Generated layouts">{generatedFamilies.map((id) => <option key={id} value={id}>{buildingOptionLabel(id)}</option>)}</optgroup>
          </> : authored.map((id) => <option key={id} value={id}>{buildingOptionLabel(id)}</option>)}
        </select>
      </label>
      {scenario ? <>
        {/* Situation labels can reveal the answer the player is meant to check, so the
            card names the situation by number and leaves the outcome to the debrief. */}
        <h3>{scenario.title}</h3>
        <p className="scenario-library-where">
          <Icon name={settingIcon(scenario.setting)} size={14} />
          <span>{familyBlurb(scenario.locationFamilyId)}</span>
          <FloorsChip floors={floors} />
        </p>
        <p className="dim">Situation {situation.variant + 1} of 3</p>
        <p>{scenario.summary}</p>
        <p className="dim">{situation.characteristic === 'deliberate_answers' ? 'Pacing: one person thinks before answering, so their conversations take longer.' : 'Pacing: standard conversations.'}</p>
        <div className="scenario-library-nav">
          <Button disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Previous situation">Previous</Button>
          <span role="status" aria-live="polite">{index + 1} of {situations.length}</span>
          <Button disabled={index >= situations.length - 1} onClick={() => setIndex(index + 1)} aria-label="Next situation">Next</Button>
        </div>
        <p className="dim">Variation {variation.number}. {generated
          ? 'A new variation generates a different layout of this building type, with new names, furnishings, and placement.'
          : 'A new variation changes names, furnishings, and placement while keeping this situation.'}</p>
        <Button onClick={() => setVariation({ number: variation.number + 1, fromSeed: buildingSeed + 1 })}>New variation</Button>
        <Button block variant="primary" onClick={() => onPrepare(scenario.id)}>Practice this scenario</Button>
      </> : <p role="alert">This scenario could not be prepared. Choose another scenario.</p>}
    </Card>
  </Section>;
}
