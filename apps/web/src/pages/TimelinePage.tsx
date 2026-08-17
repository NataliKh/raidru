import { difficultyPlan, useAppState, appStore } from '../app/store';

function formatTime(seconds: number) { const min = Math.floor(seconds / 60); const sec = Math.floor(seconds % 60); return `${min}:${String(sec).padStart(2,'0')}`; }

export function TimelinePage() {
  const state = useAppState();
  const bossId = state.selectedBossId;
  const plan = difficultyPlan(state, bossId, state.difficulty);
  return <section className="page timelinePage"><div className="timelineHeader"><div><small>ТАЙМЛАЙН · {state.difficulty.toUpperCase()}</small><h2>{plan.timeline.length} событий</h2></div><p>Таймлайн привязан к отдельному плану сложности и использует те же индексы сцен, что Planner Core.</p></div><div className="timelineList">{plan.timeline.map(event => <button key={event.id} onClick={() => { appStore.setScene(bossId, event.sceneIndex, state.difficulty); appStore.setPage('raid'); }}><time>{formatTime(event.time)}</time><i className={event.kind} /><span><strong>{event.label}</strong><small>Сцена {event.sceneIndex + 1}</small></span></button>)}</div></section>;
}
