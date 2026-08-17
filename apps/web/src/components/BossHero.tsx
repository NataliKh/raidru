import type { ChangeEvent } from 'react';
import { bossById } from '../data/content';
import { appStore, useAppState } from '../app/store';

export function BossHero() {
  const state = useAppState();
  const boss = bossById[state.selectedBossId];
  const plan = state.bosses[boss.id];
  return <section className="bossHero">
    <div className="heroCopy"><small>MIDNIGHT / ЯДОВИТАЯ БЕЗДНА / БОСС {boss.order}</small><div className="titleRow"><h1>{boss.name}</h1><button className="star" onClick={() => appStore.toggleFavorite(boss.id)}>{plan.favorite ? '★' : '☆'}</button></div><p>{boss.summary}</p></div>
    <div className="heroControls">
      <div className="difficulty">{(['normal','heroic','mythic'] as const).map(diff => <button key={diff} className={state.difficulty === diff ? 'active' : ''} onClick={() => appStore.setDifficulty(diff)}>{diff === 'normal' ? 'Обычный' : diff === 'heroic' ? 'Героический' : 'Эпохальный'}</button>)}</div>
      <label className="progressControl"><span>Освоение <strong>{plan.progress}%</strong></span><input type="range" min="0" max="100" step="10" value={plan.progress} onChange={(event: ChangeEvent<HTMLInputElement>) => appStore.setProgress(boss.id, Number(event.target.value))} /></label>
    </div>
  </section>;
}
