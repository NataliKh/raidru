import { useAppState, appStore } from '../app/store';

function formatTime(seconds: number) { const min = Math.floor(seconds / 60); const sec = Math.floor(seconds % 60); return `${min}:${String(sec).padStart(2,'0')}`; }

export function TimelinePage() {
  const state = useAppState();
  const bossId = state.selectedBossId;
  const plan = state.bosses[bossId];
  return <section className="page timelinePage"><div className="timelineHeader"><div><small>ТАЙМЛАЙН</small><h2>{plan.timeline.length} событий</h2></div><p>Таймлайн и сцены теперь читают одну модель состояния. Никаких отдельных DOM-кэшей.</p></div><div className="timelineList">{plan.timeline.map(event => <button key={event.id} onClick={() => { appStore.setScene(bossId, event.sceneIndex); appStore.setPage('raid'); }}><time>{formatTime(event.time)}</time><i className={event.kind} /><span><strong>{event.label}</strong><small>Сцена {event.sceneIndex + 1}</small></span></button>)}</div></section>;
}
