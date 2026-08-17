import { useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopNav } from '../components/TopNav';
import { BossHero } from '../components/BossHero';
import { LegacyImportBanner } from '../features/legacy-import/LegacyImportBanner';
import { PlannerWorkspace } from '../features/planner/PlannerWorkspace';
import { OverviewPage } from '../pages/OverviewPage';
import { TacticsPage } from '../pages/TacticsPage';
import { RaidPage } from '../pages/RaidPage';
import { TimelinePage } from '../pages/TimelinePage';
import { RosterPage } from '../pages/RosterPage';
import { NotesPage } from '../pages/NotesPage';
import { appStore, useAppState } from './store';

export function App() {
  const state = useAppState();
  useEffect(() => { void appStore.hydrate(); }, []);
  const page = state.activePage;
  return <div className="appShell"><Sidebar /><main className="main"><TopNav /><LegacyImportBanner />{page !== 'overview' && <BossHero />}{page === 'overview' && <OverviewPage />}{page === 'tactics' && <TacticsPage />}{page === 'raid' && <RaidPage />}{page === 'planner' && <PlannerWorkspace editable />}{page === 'timeline' && <TimelinePage />}{page === 'roster' && <RosterPage />}{page === 'notes' && <NotesPage />}<footer className="siteFooter">RaidRU 3 · RaidPlan Visual Fidelity · native RaidPlan geometry, единые assets и чистый TypeScript adapter.</footer></main></div>;
}
