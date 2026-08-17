import { difficultyPlan, useAppState } from '../app/store';
import { bossById } from '../data/content';
import { PlannerWorkspace } from '../features/planner/PlannerWorkspace';

export function RaidPage() {
  const state = useAppState();
  const boss = bossById[state.selectedBossId];
  const plan = difficultyPlan(state, boss.id, state.difficulty);
  return <div className="raidPage"><div className="raidSummary"><div><small>ПЛАН БОЯ</small><strong>{plan.scenes.length} сцен</strong><span>{plan.timeline.length} событий таймлайна · {state.difficulty}</span></div><div className="statusPill">PLANNER CORE</div></div><PlannerWorkspace editable={false} /></div>;
}
