import { useState, type ChangeEvent } from 'react';
import type { Difficulty } from '@raidru/shared-types';
import { bossById } from '../data/content';
import { appStore, difficultyPlan, useAppState } from '../app/store';

const labels: Record<Difficulty, string> = { normal:'Обычный', heroic:'Героический', mythic:'Эпохальный' };

export function BossHero() {
  const state = useAppState();
  const boss = bossById[state.selectedBossId];
  const bossState = state.bosses[boss.id];
  const currentPlan = difficultyPlan(state, boss.id, state.difficulty);
  const [pendingDifficulty, setPendingDifficulty] = useState<Difficulty | null>(null);
  const targetPlan = pendingDifficulty ? difficultyPlan(state, boss.id, pendingDifficulty) : null;

  return <>
    <section className="bossHero">
      <div className="heroCopy"><small>MIDNIGHT / ЯДОВИТАЯ БЕЗДНА / БОСС {boss.order}</small><div className="titleRow"><h1>{boss.name}</h1><button className="star" onClick={() => appStore.toggleFavorite(boss.id)}>{bossState.favorite ? '★' : '☆'}</button></div><p>{boss.summary}</p></div>
      <div className="heroControls">
        <div className="difficulty">{(['normal','heroic','mythic'] as const).map(diff => <button key={diff} className={state.difficulty === diff ? 'active' : ''} onClick={() => diff !== state.difficulty && setPendingDifficulty(diff)}>{labels[diff]}</button>)}</div>
        <label className="progressControl"><span>Освоение <strong>{bossState.progress}%</strong></span><input type="range" min="0" max="100" step="10" value={bossState.progress} onChange={(event: ChangeEvent<HTMLInputElement>) => appStore.setProgress(boss.id, Number(event.target.value))} /></label>
        <small className="difficultyMeta">{labels[state.difficulty]} · {currentPlan.scenes.length} сцен</small>
      </div>
    </section>
    {pendingDifficulty && targetPlan && <div className="modalBackdrop" onMouseDown={() => setPendingDifficulty(null)}><div className="difficultyDialog" onMouseDown={event => event.stopPropagation()}>
      <small>ПЕРЕКЛЮЧЕНИЕ СЛОЖНОСТИ</small><h3>{labels[state.difficulty]} → {labels[pendingDifficulty]}</h3><p>Планы сложностей теперь независимы. Выбери, что сделать с картой при переходе.</p>
      <button className="dialogChoice" onClick={() => { appStore.switchDifficulty(pendingDifficulty, 'existing'); setPendingDifficulty(null); }}><strong>Открыть существующий план</strong><span>{targetPlan.scenes.length} сцен · ничего не перезаписывать</span></button>
      <button className="dialogChoice" onClick={() => { appStore.switchDifficulty(pendingDifficulty, 'copy-current'); setPendingDifficulty(null); }}><strong>Скопировать текущую карту</strong><span>Перенести сцены, объекты, зоны и маршруты в {labels[pendingDifficulty].toLowerCase()}</span></button>
      <button className="dialogChoice dangerChoice" onClick={() => { appStore.switchDifficulty(pendingDifficulty, 'clear-target'); setPendingDifficulty(null); }}><strong>Очистить карту этой сложности</strong><span>Сохранить сцены и таймлайн, удалить объекты, зоны и маршруты</span></button>
      <button className="dialogCancel" onClick={() => setPendingDifficulty(null)}>Отмена</button>
    </div></div>}
  </>;
}
