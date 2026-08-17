import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BossId, Scene } from '@raidru/shared-types';
import { mapAssetForScene } from '../../data/content';
import { appStore } from '../../app/store';

function tokenClass(type: string) {
  return ['tank','healer','melee','ranged','boss','marker'].includes(type) ? type : 'marker';
}

export function Arena({ bossId, scene, sceneIndex, editable }: { bossId: BossId; scene: Scene; sceneIndex: number; editable: boolean }) {
  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, tokenId: string) {
    if (!editable) return;
    const arena = event.currentTarget.closest('.arena') as HTMLElement | null;
    if (!arena) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (nativeEvent: PointerEvent) => {
      const rect = arena.getBoundingClientRect();
      appStore.moveToken(bossId, sceneIndex, tokenId, ((nativeEvent.clientX - rect.left) / rect.width) * 100, ((nativeEvent.clientY - rect.top) / rect.height) * 100);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return <div className={`arena ${editable ? 'editable' : ''}`}>
    <img className="arenaImage" src={mapAssetForScene(bossId, scene.name)} alt="Карта арены" draggable={false} />
    <div className="arenaShade" style={{ background: `rgba(0,0,0,${Math.max(0, Math.min(0.6, scene.map.dark / 20))})` }} />
    <svg className="effectsLayer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {scene.effects.map((effect, index) => effect.type === 'line' || effect.type === 'arrow' ? <g key={index} transform={`translate(${effect.x} ${effect.y}) rotate(${effect.rot || 0})`}><line x1={-effect.w/2} y1="0" x2={effect.w/2} y2="0" className={effect.type} />{effect.type === 'arrow' && <polygon points={`${effect.w/2},0 ${effect.w/2-3},-2 ${effect.w/2-3},2`} className="arrowHead" />}</g> : <ellipse key={index} cx={effect.x} cy={effect.y} rx={Math.max(1,effect.w/2)} ry={Math.max(1,effect.h/2)} className={`effectShape ${effect.type}`} />)}
    </svg>
    {scene.tokens.map(token => <button key={token.id} className={`mapToken ${tokenClass(token.type)}`} style={{ left: `${token.x}%`, top: `${token.y}%` }} title={token.label} onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => startDrag(event, token.id)}><span>{token.label.slice(0, 10)}</span></button>)}
    <div className="arenaCaption"><strong>{scene.name}</strong><span>{editable ? 'Перетаскивай игроков и объекты прямо на карте' : 'Режим просмотра'}</span></div>
  </div>;
}
