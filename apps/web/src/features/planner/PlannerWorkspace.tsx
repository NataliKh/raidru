import { useEffect, useState } from 'react';
import type { PlannerSelection } from '@raidru/shared-types';
import { appStore, difficultyPlan, useAppState } from '../../app/store';
import { Arena } from './Arena';
import { InspectorPanel } from './InspectorPanel';
import { PalettePanel } from './PalettePanel';
import { paletteItems } from './palette';
import { RaidPlanImportDialog } from '../raidplan-import/RaidPlanImportDialog';

export function PlannerWorkspace({ editable = true }: { editable?: boolean }) {
  const state = useAppState();
  const bossId = state.selectedBossId;
  const difficulty = state.difficulty;
  const plan = difficultyPlan(state, bossId, difficulty);
  const rawIndex = state.selectedSceneByBoss[bossId]?.[difficulty] || 0;
  const sceneIndex = Math.min(rawIndex, Math.max(0, plan.scenes.length - 1));
  const scene = plan.scenes[sceneIndex];
  const [selection, setSelection] = useState<PlannerSelection>(null);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [raidPlanOpen, setRaidPlanOpen] = useState(false);

  useEffect(() => { setSelection(null); setActiveRouteId(null); }, [bossId, difficulty, sceneIndex]);

  useEffect(() => {
    if (!editable) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.key === 'Escape' && activeRouteId) { setActiveRouteId(null); return; }
      if (typing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? appStore.redo() : appStore.undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); appStore.redo(); return; }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selection && scene) {
        event.preventDefault();
        if (selection.kind === 'token') appStore.removeToken(bossId, difficulty, sceneIndex, selection.id);
        if (selection.kind === 'effect') appStore.removeEffect(bossId, difficulty, sceneIndex, selection.id);
        if (selection.kind === 'route') appStore.removeRoute(bossId, difficulty, sceneIndex, selection.id);
        setSelection(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editable, activeRouteId, selection, scene, bossId, difficulty, sceneIndex]);

  if (!scene) return <div className="emptyState">У этого босса пока нет сцен.</div>;

  const importedRaidPlan = scene.map.source === 'raidplan';
  const raidPlanBaseUrl = scene.map.raidPlan?.sourceUrl?.split('#')[0] || (scene.map.raidPlan?.sourceCode ? `https://raidplan.io/plan/${scene.map.raidPlan.sourceCode}` : '');
  const raidPlanSourceUrl = raidPlanBaseUrl ? `${raidPlanBaseUrl}#${scene.map.raidPlan?.sceneIndex || sceneIndex + 1}` : '';
  const raidPlanTextCount = scene.tokens.filter(token => token.type === 'text').length;
  const raidPlanVectorCount = scene.effects.filter(effect => effect.meta?.source === 'RaidPlan' && (effect.type === 'path' || effect.type === 'line' || effect.type === 'arrow')).length;
  const raidPlanOffCanvasCount = scene.effects.filter(effect => effect.meta?.source === 'RaidPlan' && effect.points?.some(point => point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100)).length;

  function addPaletteItem(itemId: string, x = 50, y = 50) {
    const item = paletteItems.find(candidate => candidate.id === itemId);
    if (!item) return;
    if (item.kind === 'token') {
      const id = appStore.addToken(bossId, difficulty, sceneIndex, { ...item.token, x, y, meta:{ ...item.token.meta, paletteId:item.id } });
      setSelection({ kind:'token', id });
    } else {
      const id = appStore.addEffect(bossId, difficulty, sceneIndex, { ...item.effect, x, y });
      setSelection({ kind:'effect', id });
    }
  }

  function toggleRouteDrawing() {
    if (activeRouteId) { setActiveRouteId(null); return; }
    const id = appStore.createRoute(bossId, difficulty, sceneIndex);
    setActiveRouteId(id);
    setSelection({ kind:'route', id });
  }

  function duplicateScene() { appStore.duplicateScene(bossId, difficulty, sceneIndex); }
  function deleteScene() {
    if (plan.scenes.length <= 1) return;
    if (window.confirm(`Удалить сцену «${scene.name}»?`)) appStore.deleteScene(bossId, difficulty, sceneIndex);
  }
  function clearScene() {
    if (window.confirm('Очистить все объекты, зоны и маршруты этой сцены?')) {
      appStore.clearScene(bossId, difficulty, sceneIndex);
      setSelection(null);
      setActiveRouteId(null);
    }
  }

  return <section className={`page plannerPage ${editable ? 'plannerEditor' : 'plannerViewer'}`}>
    <div className="sceneRail">
      <div className="sceneRailTitle"><strong>СЦЕНЫ</strong><div><span>{plan.scenes.length}</span>{editable && <button title="Новая сцена" onClick={() => appStore.addScene(bossId, difficulty, sceneIndex)}>＋</button>}</div></div>
      {plan.scenes.map((item, index) => <button key={item.id} className={index === sceneIndex ? 'active' : ''} onClick={() => appStore.setScene(bossId, index, difficulty)}><i>{index + 1}</i><span><strong>{item.name}</strong><small>{item.duration} сек · {item.tokens.length + item.effects.length} объектов</small></span></button>)}
    </div>

    <div className="workspace">
      <div className="workspaceToolbar">
        <div className="workspaceIdentity"><small>{editable ? 'PLANNER · RAIDPLAN READY' : 'PLAN VIEWER'}</small><strong>{scene.name}</strong></div>
        {editable ? <div className="plannerToolbar">
          <button onClick={() => appStore.undo()} disabled={!appStore.canUndo()} title="Отменить (Ctrl+Z)">↶</button>
          <button onClick={() => appStore.redo()} disabled={!appStore.canRedo()} title="Повторить (Ctrl+Y)">↷</button>
          <span />
          <button onClick={() => appStore.addScene(bossId, difficulty, sceneIndex)} title="Новая сцена">＋ Сцена</button>
          <button onClick={duplicateScene} title="Дублировать сцену">⧉</button>
          <button onClick={deleteScene} disabled={plan.scenes.length <= 1} title="Удалить сцену">−</button>
          <span />
          <button className="raidPlanToolbarButton" onClick={() => setRaidPlanOpen(true)} title="Импортировать RaidPlan">⇩ RaidPlan</button>
          {importedRaidPlan && raidPlanSourceUrl && <a className="raidPlanExternalLink" href={raidPlanSourceUrl} target="_blank" rel="noreferrer" title="Открыть эту сцену в RaidPlan">↗ RaidPlan</a>}
          <span />
          <button className={activeRouteId ? 'active' : ''} onClick={toggleRouteDrawing}>{activeRouteId ? '✓ Маршрут' : '⌁ Маршрут'}</button>
          <button onClick={clearScene} title="Очистить карту">⌫</button>
        </div> : <span>Сцена {sceneIndex + 1} / {plan.scenes.length}</span>}
      </div>
      <Arena bossId={bossId} difficulty={difficulty} scene={scene} sceneIndex={sceneIndex} editable={editable} selection={selection} activeRouteId={activeRouteId} onSelect={setSelection} onPaletteDrop={addPaletteItem} onRoutePoint={(x,y) => activeRouteId && appStore.appendRoutePoint(bossId, difficulty, sceneIndex, activeRouteId, x, y)} />
      {importedRaidPlan && <div className="raidPlanFidelityStrip">
        <small>VISUAL FIDELITY</small>
        <span>сцена {scene.map.raidPlan?.sceneIndex || sceneIndex + 1}</span>
        <span>{scene.map.sourceWidth || 1200}×{scene.map.sourceHeight || 675}</span>
        <span>{scene.tokens.length} токенов</span>
        <span>{raidPlanTextCount} текст</span>
        <span>{raidPlanVectorCount} векторов</span>
        <span className={raidPlanOffCanvasCount ? 'warn' : ''}>{raidPlanOffCanvasCount} off-canvas</span>
        {scene.map.raidPlan?.revision != null && <span>rev {scene.map.raidPlan.revision}</span>}
      </div>}
      <div className="sceneNote"><small>{importedRaidPlan ? 'ЗАМЕТКА СЦЕНЫ RAIDPLAN' : 'ЗАМЕТКА СЦЕНЫ'}</small><span>{scene.note || 'Для этой сцены пока нет заметки.'}</span></div>
    </div>

    {editable && <aside className="plannerSidebar"><PalettePanel onAdd={itemId => addPaletteItem(itemId)} /><InspectorPanel bossId={bossId} difficulty={difficulty} scene={scene} sceneIndex={sceneIndex} selection={selection} onClearSelection={() => setSelection(null)} /></aside>}
    {editable && <RaidPlanImportDialog open={raidPlanOpen} onClose={() => setRaidPlanOpen(false)} />}
  </section>;
}
