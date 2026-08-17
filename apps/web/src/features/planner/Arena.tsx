import type { CSSProperties, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { BossId, Difficulty, PlannerSelection, Point, Scene, SceneEffect, SceneToken } from '@raidru/shared-types';
import { mapAssetForScene } from '../../data/content';
import { appStore } from '../../app/store';
import { publicAsset } from '../../shared/publicAsset';
import { nativeTokenStyle } from './nativeTokenStyle';

function tokenClass(type: string, role?: string, range?: string) {
  if (['tank','healer','melee','ranged','boss','encounter','mechanic','marker'].includes(type)) return type;
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

function pointsString(points: Point[] | undefined) {
  return (points || []).map(point => `${point.x},${point.y}`).join(' ');
}

function svgPaint(effect: SceneEffect): CSSProperties {
  const style = effect.style || {};
  return {
    stroke: style.stroke || undefined,
    fill: style.fill || undefined,
    strokeWidth: style.strokeWidth,
    opacity: style.opacity,
    fillOpacity: style.fillOpacity,
    strokeOpacity: style.strokeOpacity,
    strokeLinecap: (style.lineCap || 'round') as CSSProperties['strokeLinecap'],
    strokeLinejoin: (style.lineJoin || 'round') as CSSProperties['strokeLinejoin'],
    vectorEffect: effect.meta?.source === 'RaidPlan' ? undefined : 'non-scaling-stroke'
  };
}

function arrowHead(points: Point[]): string {
  if (points.length < 2) return '';
  const end = points[points.length - 1];
  let prev = points[points.length - 2];
  for (let index = points.length - 2; index >= 0; index--) {
    if (Math.hypot(end.x - points[index].x, end.y - points[index].y) > .15) { prev = points[index]; break; }
  }
  const dx = end.x - prev.x, dy = end.y - prev.y;
  const len = Math.max(.001, Math.hypot(dx, dy));
  const ux = dx / len, uy = dy / len;
  const size = 2.2;
  const bx = end.x - ux * size, by = end.y - uy * size;
  const px = -uy * size * .62, py = ux * size * .62;
  return `${end.x},${end.y} ${bx + px},${by + py} ${bx - px},${by - py}`;
}

function renderEffect(effect: SceneEffect, selected: boolean): ReactNode {
  const selectedClass = selected ? 'selectedEffectSvg' : '';
  const paint = svgPaint(effect);
  if (effect.points && effect.points.length >= 2) {
    const polygon = effect.shape === 'polygon' && effect.points.length >= 3;
    if (polygon) return <polygon key={effect.id} points={pointsString(effect.points)} transform={effect.rot ? `rotate(${effect.rot} ${effect.x} ${effect.y})` : undefined} className={`nativeRaidPlanEffect ${selectedClass}`} style={paint} />;
    return <g key={effect.id} className={selectedClass} transform={effect.rot ? `rotate(${effect.rot} ${effect.x} ${effect.y})` : undefined}>
      <polyline points={pointsString(effect.points)} className="nativeRaidPlanEffect" style={{ ...paint, fill: effect.type === 'path' || effect.type === 'line' || effect.type === 'arrow' ? 'none' : paint.fill }} />
      {effect.type === 'arrow' && <polygon points={arrowHead(effect.points)} className="nativeRaidPlanArrowHead" style={{ fill: effect.style?.stroke || '#69db95', opacity: effect.style?.opacity }} />}
    </g>;
  }
  if (effect.type === 'line' || effect.type === 'arrow') {
    return <g key={effect.id} className={selectedClass} transform={`translate(${effect.x} ${effect.y}) rotate(${effect.rot || 0})`}>
      <line x1={-effect.w/2} y1="0" x2={effect.w/2} y2="0" className={effect.type} style={paint} />
      {effect.type === 'arrow' && <polygon points={`${effect.w/2},0 ${effect.w/2-3},-2 ${effect.w/2-3},2`} className="arrowHead" style={{ fill: effect.style?.stroke }} />}
    </g>;
  }
  if (effect.shape === 'rect') return <rect key={effect.id} x={effect.x-effect.w/2} y={effect.y-effect.h/2} width={effect.w} height={effect.h} transform={effect.rot ? `rotate(${effect.rot} ${effect.x} ${effect.y})` : undefined} className={`effectShape nativeRaidPlanEffect ${effect.type} ${selectedClass}`} style={paint} />;
  if (effect.shape === 'cone') {
    const points = `${effect.x},${effect.y-effect.h/2} ${effect.x-effect.w/2},${effect.y+effect.h/2} ${effect.x+effect.w/2},${effect.y+effect.h/2}`;
    return <polygon key={effect.id} points={points} transform={effect.rot ? `rotate(${effect.rot} ${effect.x} ${effect.y})` : undefined} className={`effectShape nativeRaidPlanEffect ${effect.type} ${selectedClass}`} style={paint} />;
  }
  return <ellipse key={effect.id} cx={effect.x} cy={effect.y} rx={Math.max(.01,effect.w/2)} ry={Math.max(.01,effect.h/2)} transform={effect.rot ? `rotate(${effect.rot} ${effect.x} ${effect.y})` : undefined} className={`effectShape ${effect.meta?.source === 'RaidPlan' ? 'nativeRaidPlanEffect' : ''} ${effect.type} ${selectedClass}`} style={paint} />;
}

function TextToken({ token, editable, selected, onPointerDown }: { token: SceneToken; editable: boolean; selected: boolean; onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void }) {
  const width = Number(token.meta?.w);
  const fontSizePct = Number(token.meta?.fontSizePct);
  const fill = String(token.meta?.fill || '#ffffff');
  const backgroundColor = token.meta?.backgroundColor ? String(token.meta.backgroundColor) : 'transparent';
  const textAlign = String(token.meta?.textAlign || 'left') as CSSProperties['textAlign'];
  const lineHeight = Number(token.meta?.lineHeight);
  const charSpacing = Number(token.meta?.charSpacing);
  const fontWeight = token.meta?.fontWeight as CSSProperties['fontWeight'];
  const fontFamily = String(token.meta?.fontFamily || '').trim();
  const sourceOrder = Number(token.meta?.sourceOrder);
  const sourceZ = Number(token.meta?.z);
  const positionMode = String(token.meta?.positionMode || 'raidplan-meta-center');
  const originX = String(token.meta?.originX || 'center').toLowerCase();
  const originY = String(token.meta?.originY || 'center').toLowerCase();
  const anchorX = positionMode === 'fabric-origin' ? (originX === 'left' ? '0%' : originX === 'right' ? '-100%' : '-50%') : '-50%';
  const anchorY = positionMode === 'fabric-origin' ? (originY === 'top' ? '0%' : originY === 'bottom' ? '-100%' : '-50%') : '-50%';
  const angle = Number(token.meta?.angle);
  return <button
    className={`mapTextToken ${selected ? 'selected' : ''}`}
    style={{
      left:`${token.x}%`, top:`${token.y}%`,
      width: Number.isFinite(width) && width > 0 ? `${Math.max(.5,width)}%` : 'auto',
      color: fill, background: backgroundColor,
      textAlign,
      fontSize: Number.isFinite(fontSizePct) && fontSizePct > 0 ? `${fontSizePct}cqw` : undefined,
      lineHeight: Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 1.16,
      letterSpacing: Number.isFinite(charSpacing) ? `${charSpacing / 1000}em` : undefined,
      fontWeight: fontWeight || undefined,
      fontFamily: fontFamily || undefined,
      transform: `translate(${anchorX},${anchorY})${Number.isFinite(angle) && angle ? ` rotate(${angle}deg)` : ''}`,
      cursor: editable ? 'grab' : 'default',
      ...(Number.isFinite(sourceZ) ? { zIndex: 20 + sourceZ } : Number.isFinite(sourceOrder) ? { zIndex: 20 + sourceOrder } : {})
    }}
    onPointerDown={onPointerDown}
  >{String(token.meta?.text || token.label)}</button>;
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

  const background = publicAsset(scene.map.backgroundUrl || mapAssetForScene(bossId, scene.name));
  const aspectRatio = scene.map.sourceWidth && scene.map.sourceHeight ? `${scene.map.sourceWidth}/${scene.map.sourceHeight}` : undefined;

  return <div
    className={`arena ${editable ? 'editable' : ''} ${activeRouteId ? 'routeDrawing' : ''} ${scene.map.source === 'raidplan' ? 'raidPlanArena' : ''}`}
    style={{ aspectRatio }}
    onPointerDown={handleArenaClick}
    onDragOver={event => { if (editable) event.preventDefault(); }}
    onDrop={handleDrop}
  >
    <img className="arenaImage" src={background} alt="Карта арены" draggable={false} />
    <div className="arenaShade" style={{ background: `rgba(0,0,0,${Math.max(0, Math.min(0.6, scene.map.dark / 20))})` }} />
    <svg className="effectsLayer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {scene.effects.filter(effect => effect.meta?.source !== 'RaidPlan').map(effect => renderEffect(effect, selection?.kind === 'effect' && selection.id === effect.id))}
      {scene.routes.map(route => route.points.length > 1 && <polyline key={route.id} points={route.points.map(point => `${point.x},${point.y}`).join(' ')} className={`routePath ${selection?.kind === 'route' && selection.id === route.id ? 'selected' : ''}`} />)}
    </svg>
    {scene.effects.filter(effect => effect.meta?.source === 'RaidPlan').map(effect => {
      const sourceOrder = Number(effect.meta?.sourceOrder);
      const sourceZ = Number(effect.meta?.z);
      return <svg key={`native-${effect.id}`} className="nativeEffectOverlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ zIndex: Number.isFinite(sourceZ) ? 20 + sourceZ : Number.isFinite(sourceOrder) ? 20 + sourceOrder : 20 }}>
        {renderEffect(effect, selection?.kind === 'effect' && selection.id === effect.id)}
      </svg>;
    })}

    {scene.effects.map(effect => editable && <button key={`handle-${effect.id}`} className={`effectAnchor ${selection?.kind === 'effect' && selection.id === effect.id ? 'selected' : ''}`} style={{ left:`${effect.x}%`, top:`${effect.y}%` }} title={effect.label || effect.type} onPointerDown={event => startEffectDrag(event, effect.id)}>◆</button>)}

    {scene.routes.map(route => <div key={`route-ui-${route.id}`} className="routeUi">
      {route.points[0] && <button className={`routeLabel ${selection?.kind === 'route' && selection.id === route.id ? 'selected' : ''}`} style={{ left:`${route.points[0].x}%`, top:`${route.points[0].y}%` }} onPointerDown={event => { event.stopPropagation(); onSelect({ kind:'route', id:route.id }); }}>{route.name}</button>}
      {editable && ((selection?.kind === 'route' && selection.id === route.id) || activeRouteId === route.id) && route.points.map((point, index) => <button key={`${route.id}-${index}`} className="routePoint" style={{ left:`${point.x}%`, top:`${point.y}%` }} onPointerDown={event => startRoutePointDrag(event, route.id, index)} title={`Точка ${index + 1}`} />)}
    </div>)}

    {scene.tokens.map(token => token.type === 'text'
      ? <TextToken key={token.id} token={token} editable={editable} selected={selection?.kind === 'token' && selection.id === token.id} onPointerDown={event => startTokenDrag(event, token.id)} />
      : <button key={token.id} className={`mapToken ${token.meta?.source === 'RaidPlan' ? 'nativeToken' : ''} ${tokenClass(token.type, token.meta?.role as string | undefined, token.meta?.range as string | undefined)} ${selection?.kind === 'token' && selection.id === token.id ? 'selected' : ''}`} style={nativeTokenStyle(token)} title={token.label} onPointerDown={event => startTokenDrag(event, token.id)}>
        {token.meta?.asset ? <img src={publicAsset(String(token.meta.asset))} alt="" draggable={false} onError={event => { const fallback = publicAsset(String(token.meta?.fallbackAsset || '')); if (fallback && event.currentTarget.src !== new URL(fallback, window.location.href).href) event.currentTarget.src = fallback; }} /> : <b>{token.label.slice(0, 2)}</b>}
        {!token.meta?.hideLabel && <span>{token.label.slice(0, 28)}</span>}
      </button>)}

    <div className="arenaCaption"><strong>{scene.name}</strong><span>{scene.map.source === 'raidplan' ? 'RaidPlan · native canvas geometry' : activeRouteId ? 'Маршрут: кликай по карте, чтобы добавлять точки' : editable ? 'Drag & drop объектов · выделение · перемещение' : 'Режим просмотра'}</span></div>
  </div>;
}
