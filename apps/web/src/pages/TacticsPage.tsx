import { bossById } from '../data/content';
import { useAppState } from '../app/store';

export function TacticsPage() {
  const state = useAppState();
  const boss = bossById[state.selectedBossId];
  return <section className="page tacticsPage">
    <div className="calloutGrid"><article><small>РЕЙД-ЛИД</small><p>{boss.raidLead}</p></article><article><small>ХИЛЫ</small><p>{boss.healing}</p></article><article><small>ГЕРОИЗМ</small><p>{boss.bloodlust}</p></article></div>
    {boss.phases.map((phase, phaseIndex) => <section className="phaseCard" key={`${phase.name}-${phaseIndex}`}><header><span>{String(phaseIndex + 1).padStart(2,'0')}</span><div><h2>{phase.name}</h2>{phase.description && <p>{phase.description}</p>}</div></header><div className="mechanicGrid">{phase.mechanics.map(mechanic => <article key={`${phase.name}-${mechanic.name}`}><div className={`severity ${mechanic.severity}`} /><div><small>{mechanic.englishName}</small><h3>{mechanic.name}</h3><p>{mechanic.description}</p>{mechanic.note && <em>{mechanic.note}</em>}</div></article>)}</div></section>)}
  </section>;
}
