import { useState } from 'react';
import type { CertId, Id } from '../../sim/types';
import { Chip } from '../components/ui';
import { moneyFull as money } from '../format';
import { useGame } from '../store';
import { DevelopScreen } from '../screens/Develop';
import { EquipmentStore } from './EquipmentStore';
import { TrainingStore } from './TrainingStore';
import { TestStore } from './TestStore';

type StoreTab = 'equipment' | 'training' | 'development' | 'test_dp';
const TABS: { id: StoreTab; label: string }[] = [
  { id: 'equipment', label: 'Equipment' }, { id: 'training', label: 'Training' }, { id: 'development', label: 'Development' }, { id: 'test_dp', label: 'Test DP' },
];

export function Storefront({ active }: { active: boolean }) {
  const game = useGame();
  const [tab, setTab] = useState<StoreTab>('equipment');
  const [requestedCert, setRequestedCert] = useState<CertId>();
  const [requestedNode, setRequestedNode] = useState<Id>();
  const [trainingRequest, setTrainingRequest] = useState(0);
  const [developmentRequest, setDevelopmentRequest] = useState(0);
  const openDevelopment = (nodeId: Id) => { setRequestedNode(nodeId); setDevelopmentRequest((key) => key + 1); setTab('development'); };
  return <section className="storefront" hidden={!active} aria-label="Department store">
    <header className="store-heading"><div><span className="kicker">DEPARTMENT PROCUREMENT</span><h2>Store</h2></div><Chip icon="cash">{money(game.department.funding)} funding</Chip></header>
    <nav className="store-tabs" aria-label="Store sections">{TABS.map((section) => <button type="button" key={section.id} aria-current={tab === section.id ? 'page' : undefined} className={tab === section.id ? 'is-selected' : ''} onClick={() => setTab(section.id)}>{section.label}</button>)}</nav>
    <EquipmentStore active={active && tab === 'equipment'} onDevelopment={openDevelopment} onTraining={(cert) => { setRequestedCert(cert); setTrainingRequest((key) => key + 1); setTab('training'); }} />
    <div hidden={tab !== 'training'}><TrainingStore requestedCert={requestedCert} requestKey={trainingRequest} onDevelopment={openDevelopment} /></div>
    <div hidden={tab !== 'development'}><DevelopScreen embedded highlightedNode={requestedNode} highlightRequest={developmentRequest} /></div>
    <div hidden={tab !== 'test_dp'}><TestStore /></div>
  </section>;
}
