import type { BossId, Difficulty, PlannerSelection, Scene } from '@raidru/shared-types';
import { appStore } from '../../app/store';

function numberValue(value: string, fallback: number) { const next = Number(value); return Number.isFinite(next) ? next : fallback; }

export function InspectorPanel({ bossId, difficulty, scene, sceneIndex, selection, onClearSelection }: { bossId: BossId; difficulty: Difficulty; scene: Scene; sceneIndex: number; selection: PlannerSelection; onClearSelection: () => void }) {
  const token = selection?.kind === 'token' ? scene.tokens.find(item => item.id === selection.id) : undefined;
  const effect = selection?.kind === 'effect' ? scene.effects.find(item => item.id === selection.id) : undefined;
  const route = selection?.kind === 'route' ? scene.routes.find(item => item.id === selection.id) : undefined;

  return <section className="plannerPanel inspectorPanel">
    <header><div><small>ИНСПЕКТОР</small><strong>{token?.label || effect?.label || route?.name || 'Сцена'}</strong></div>{selection && <button className="miniGhost" onClick={onClearSelection}>×</button>}</header>
    {!selection && <div className="inspectorFields">
      <label>Название<input key={`${scene.id}-name-${scene.name}`} defaultValue={scene.name} onBlur={event => event.target.value !== scene.name && appStore.updateScene(bossId, difficulty, sceneIndex, { name:event.target.value || 'Сцена' })} /></label>
      <label>Длительность, сек<input key={`${scene.id}-duration-${scene.duration}`} type="number" min="1" max="900" defaultValue={scene.duration} onBlur={event => appStore.updateScene(bossId, difficulty, sceneIndex, { duration:Math.max(1, numberValue(event.target.value, scene.duration)) })} /></label>
      <label>Затемнение карты<input key={`${scene.id}-dark-${scene.map.dark}`} type="range" min="0" max="12" defaultValue={scene.map.dark} onMouseUp={event => appStore.updateScene(bossId, difficulty, sceneIndex, { map:{ ...scene.map, dark:numberValue((event.target as HTMLInputElement).value, scene.map.dark) } })} /></label>
      <label>Заметка<textarea key={`${scene.id}-note-${scene.note}`} defaultValue={scene.note} onBlur={event => event.target.value !== scene.note && appStore.updateScene(bossId, difficulty, sceneIndex, { note:event.target.value })} /></label>
      <div className="sceneCounters"><span>{scene.tokens.length}<small>объектов</small></span><span>{scene.effects.length}<small>зон</small></span><span>{scene.routes.length}<small>маршрутов</small></span></div>
    </div>}
    {token && <div className="inspectorFields">
      <label>Подпись<input key={`${token.id}-label-${token.label}`} defaultValue={token.label} onBlur={event => appStore.updateToken(bossId, difficulty, sceneIndex, token.id, { label:event.target.value || token.label })} /></label>
      <div className="fieldPair"><label>X<input type="number" min="0" max="100" defaultValue={token.x.toFixed(1)} onBlur={event => appStore.updateToken(bossId, difficulty, sceneIndex, token.id, { x:numberValue(event.target.value, token.x) })} /></label><label>Y<input type="number" min="0" max="100" defaultValue={token.y.toFixed(1)} onBlur={event => appStore.updateToken(bossId, difficulty, sceneIndex, token.id, { y:numberValue(event.target.value, token.y) })} /></label></div>
      <button className="dangerButton" onClick={() => { appStore.removeToken(bossId, difficulty, sceneIndex, token.id); onClearSelection(); }}>Удалить объект</button>
    </div>}
    {effect && <div className="inspectorFields">
      <label>Подпись<input key={`${effect.id}-label-${effect.label || ''}`} defaultValue={effect.label || ''} onBlur={event => appStore.updateEffect(bossId, difficulty, sceneIndex, effect.id, { label:event.target.value })} /></label>
      <div className="fieldPair"><label>Ширина<input type="number" min="2" max="100" defaultValue={effect.w} onBlur={event => appStore.updateEffect(bossId, difficulty, sceneIndex, effect.id, { w:Math.max(2, numberValue(event.target.value, effect.w)) })} /></label><label>Высота<input type="number" min="2" max="100" defaultValue={effect.h} onBlur={event => appStore.updateEffect(bossId, difficulty, sceneIndex, effect.id, { h:Math.max(2, numberValue(event.target.value, effect.h)) })} /></label></div>
      <label>Поворот<input type="number" min="-180" max="180" defaultValue={effect.rot || 0} onBlur={event => appStore.updateEffect(bossId, difficulty, sceneIndex, effect.id, { rot:numberValue(event.target.value, effect.rot || 0) })} /></label>
      <button className="dangerButton" onClick={() => { appStore.removeEffect(bossId, difficulty, sceneIndex, effect.id); onClearSelection(); }}>Удалить зону</button>
    </div>}
    {route && <div className="inspectorFields">
      <label>Название<input key={`${route.id}-name-${route.name}`} defaultValue={route.name} onBlur={event => appStore.updateRoute(bossId, difficulty, sceneIndex, route.id, { name:event.target.value || route.name })} /></label>
      <div className="routeInfo"><strong>{route.points.length}</strong><span>точек маршрута</span></div>
      <p className="hint">Выделенные точки маршрута можно перетаскивать прямо на карте.</p>
      <button className="dangerButton" onClick={() => { appStore.removeRoute(bossId, difficulty, sceneIndex, route.id); onClearSelection(); }}>Удалить маршрут</button>
    </div>}
  </section>;
}
