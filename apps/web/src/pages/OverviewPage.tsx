import { appStore, difficultyPlan, useAppState } from '../app/store';
import { bosses } from '../data/content';

export function OverviewPage() {
  const state = useAppState();
  const killed = bosses.filter(boss => state.bosses[boss.id].progress >= 100).length;
  const scenes = bosses.reduce((sum, boss) => sum + difficultyPlan(state, boss.id, state.difficulty).scenes.length, 0);
  return <section className="page overviewPage">
    <div className="stats"><div><strong>{killed}/8</strong><span>убито</span></div><div><strong>{bosses.filter(b => state.bosses[b.id].favorite).length}</strong><span>в избранном</span></div><div><strong>{state.roster.length}</strong><span>в составе</span></div><div><strong>{scenes}</strong><span>сцен · {state.difficulty}</span></div></div>
    <div className="bossCards">{bosses.map(boss => { const plan = difficultyPlan(state, boss.id, state.difficulty); return <article key={boss.id} onClick={() => { appStore.setBoss(boss.id); appStore.setPage('raid'); }}><div className="thumb"><img src={boss.mapAsset} alt="" /><b>{boss.order}</b></div><div><small>БОСС {boss.order}</small><h3>{boss.name}</h3><p>{boss.summary}</p><div className="progressLine"><i style={{ width: `${state.bosses[boss.id].progress}%` }} /></div><footer><span>{state.bosses[boss.id].progress}% освоено</span><strong>{plan.scenes.length} сцен</strong></footer></div></article>; })}</div>
  </section>;
}
