import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { BossId, Difficulty, PlannerSelection, Scene } from '@raidru/shared-types';
import { mapAssetForScene } from '../../data/content';
import { appStore } from '../../app/store';

function tokenClass(type: string, role?: string, range?: string) {
  if (['tank','healer','melee','ranged','boss','marker'].includes(type)) return type;
  if (role === 'tank' || role === 'healer') return role;
  if (range === 'melee' || range === 'ranged') return range;
  return 'marker';
}

function arenaPosition(arena: HTMLElement, clientX: number, clientY: number) {
  const rect = arena.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
  };
}

type Props = {
  bossId: BossId;
  difficulty: Difficulty;
  scene: Scene;
  sceneIndex: number;
  editable: boolean;
  selection: PlannerSelection;
  activeRouteId: string | null;
  onSelect: (selection: PlannerSelection) => void;
  onPaletteDrop: (itemId: string, x: number, y: number) => void;
  onRoutePoint: (x: number, y: number) => void;
};

export function Arena({ bossId, difficulty, scene, sceneIndex, editable, selection, activeRouteId, onSelect, onPaletteDrop, onRoutePoint }: Props) {
  function startTokenDrag(event: ReactPointerEvent<HTMLButtonElement>, tokenId: string) {
    event.stopPropagation();
    onSelect({ kind:'token', id:tokenId });
    if (!editable) return;
    const arena = event.currentTarget.closest('.arena') as HTMLElement | null;
    if (!arena) return;
    appStore.beginPlannerGesture();
    const move = (nativeEvent: PointerEvent) => {
      const pos = arenaPosition(arena, nativeEvent.clientX, nativeEvent.clientY);
      appStore.moveToken(bossId, difficulty, sceneIndex, tokenId, pos.x, pos.y);
    };
    const up = () => {
      appStore.endPlannerGesture();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function startEffectDrag(event: ReactPointerEvent<HTMLButtonElement>, effectId: string) {
    event.stopPropagation();
    onSelect({ kind:'effect', id:effectId });
    if (!editable) return;
    const arena = event.currentTarget.closest('.arena') as HTMLElement | null;
    if (!arena) return;
    appStore.beginPlannerGesture();
    const move = (nativeEvent: PointerEvent) => {
      const pos = arenaPosition(arena, nativeEvent.clientX, nativeEvent.clientY);
      appStore.moveEffect(bossId, difficulty, sceneIndex, effectId, pos.x, pos.y);
    };
    const up = () => {
      appStore.endPlannerGesture();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function startRoutePointDrag(event: ReactPointerEvent<HTMLButtonElement>, routeId: string, pointIndex: number) {
    event.stopPropagation();
    onSelect({ kind:'route', id:routeId });
    if (!editable) return;
    const arena = event.currentTarget.closest('.arena') as HTMLElement | null;
    if (!arena) return;
    appStore.beginPlannerGesture();
    const move = (nativeEvent: PointerEvent) => {
      const pos = arenaPosition(arena, nativeEvent.clientX, nativeEvent.clientY);
      appStore.moveRoutePoint(bossId, difficulty, sceneIndex, routeId, pointIndex, pos.x, pos.y);
    };
    const up = () => {
      appStore.endPlannerGesture();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
    if (!editable) return;
    event.preventDefault();
    const itemId = event.dataTransfer.getData('application/x-raidru-palette');
    if (!itemId) return;
    const pos = arenaPosition(event.currentTarget, event.clientX, event.clientY);
    onPaletteDrop(itemId, pos.x, pos.y);
  }

  function handleArenaClick(event: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || !activeRouteId || event.button !== 0) return;
    const pos = arenaPosition(event.currentTarget, event.clientX, event.clientY);
    onRoutePoint(pos.x, pos.y);
  }

  return <div
    className={`arena ${editable ? 'editable' : ''} ${activeRouteId ? 'routeDrawing' : ''}`}
    onPointerDown={handleArenaClick}
    onDragOver={event => { if (editable) event.preventDefault(); }}
    onDrop={handleDrop}
  >
    <img className="arenaImage" src={mapAssetForScene(bossId, scene.name)} alt="Карта арены" draggable={false} />
    <div className="arenaShade" style={{ background: `rgba(0,0,0,${Math.max(0, Math.min(0.6, scene.map.dark / 20))})` }} />
    <svg className="effectsLayer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {scene.effects.map(effect => effect.type === 'line' || effect.type === 'arrow'
        ? <g key={effect.id} className={selection?.kind === 'effect' && selection.id === effect.id ? 'selectedEffectSvg' : ''} transform={`translate(${effect.x} ${effect.y}) rotate(${effect.rot || 0})`}><line x1={-effect.w/2} y1="0" x2={effect.w/2} y2="0" className={effect.type} />{effect.type === 'arrow' && <polygon points={`${effect.w/2},0 ${effect.w/2-3},-2 ${effect.w/2-3},2`} className="arrowHead" />}</g>
        : <ellipse key={effect.id} cx={effect.x} cy={effect.y} rx={Math.max(1,effect.w/2)} ry={Math.max(1,effect.h/2)} className={`effectShape ${effect.type} ${selection?.kind === 'effect' && selection.id === effect.id ? 'selectedEffectSvg' : ''}`} />)}
      {scene.routes.map(route => route.points.length > 1 && <polyline key={route.id} points={route.points.map(point => `${point.x},${point.y}`).join(' ')} className={`routePath ${selection?.kind === 'route' && selection.id === route.id ? 'selected' : ''}`} />)}
    </svg>

    {scene.effects.map(effect => editable && <button key={`handle-${effect.id}`} className={`effectAnchor ${selection?.kind === 'effect' && selection.id === effect.id ? 'selected' : ''}`} style={{ left:`${effect.x}%`, top:`${effect.y}%` }} title={effect.label || effect.type} onPointerDown={event => startEffectDrag(event, effect.id)}>◆</button>)}

    {scene.routes.map(route => <div key={`route-ui-${route.id}`} className="routeUi">
      {route.points[0] && <button className={`routeLabel ${selection?.kind === 'route' && selection.id === route.id ? 'selected' : ''}`} style={{ left:`${route.points[0].x}%`, top:`${route.points[0].y}%` }} onPointerDown={event => { event.stopPropagation(); onSelect({ kind:'route', id:route.id }); }}>{route.name}</button>}
      {editable && (selection?.kind === 'route' && selection.id === route.id || activeRouteId === route.id) && route.points.map((point, index) => <button key={`${route.id}-${index}`} className="routePoint" style={{ left:`${point.x}%`, top:`${point.y}%` }} onPointerDown={event => startRoutePointDrag(event, route.id, index)} title={`Точка ${index + 1}`} />)}
    </div>)}

    {scene.tokens.map(token => <button key={token.id} className={`mapToken ${tokenClass(token.type, token.meta?.role as string | undefined, token.meta?.range as string | undefined)} ${selection?.kind === 'token' && selection.id === token.id ? 'selected' : ''}`} style={{ left: `${token.x}%`, top: `${token.y}%` }} title={token.label} onPointerDown={event => startTokenDrag(event, token.id)}>
      {token.meta?.asset ? <img src={String(token.meta.asset)} alt="" draggable={false} /> : <b>{token.label.slice(0, 2)}</b>}
      <span>{token.label.slice(0, 18)}</span>
    </button>)}

    <div className="arenaCaption"><strong>{scene.name}</strong><span>{activeRouteId ? 'Маршрут: кликай по карте, чтобы добавлять точки' : editable ? 'Drag & drop объектов · выделение · перемещение' : 'Режим просмотра'}</span></div>
  </div>;
}
