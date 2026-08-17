import { useAppState, appStore } from '../../app/store';
import { Arena } from './Arena';

export function PlannerWorkspace({ editable = true }: { editable?: boolean }) {
  const state = useAppState();
  const bossId = state.selectedBossId;
  const plan = state.bosses[bossId];
  const rawIndex = state.selectedSceneByBoss[bossId] || 0;
  const sceneIndex = Math.min(rawIndex, Math.max(0, plan.scenes.length - 1));
  const scene = plan.scenes[sceneIndex];
  if (!scene) return <div className="emptyState">У этого босса пока нет сцен.</div>;

  return <section className="page plannerPage">
    <div className="sceneRail"><div className="sceneRailTitle"><strong>СЦЕНЫ</strong><span>{plan.scenes.length}</span></div>{plan.scenes.map((item, index) => <button key={item.id} className={index === sceneIndex ? 'active' : ''} onClick={() => appStore.setScene(bossId, index)}><i>{index + 1}</i><span><strong>{item.name}</strong><small>{item.duration} сек</small></span></button>)}</div>
    <div className="workspace"><div className="workspaceToolbar"><div><small>{editable ? 'PLAN EDITOR' : 'PLAN VIEWER'}</small><strong>{scene.name}</strong></div><span>Сцена {sceneIndex + 1} / {plan.scenes.length}</span></div><Arena bossId={bossId} scene={scene} sceneIndex={sceneIndex} editable={editable} /><div className="sceneNote">{scene.note || 'Для этой сцены пока нет заметки.'}</div></div>
  </section>;
}
