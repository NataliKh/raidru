import { useMemo, useState, type ChangeEvent } from 'react';
import { bosses } from '../data/content';
import { APP_VERSION_LABEL } from '../app/version';
import { appStore, useAppState } from '../app/store';

export function Sidebar() {
  const state = useAppState();
  const [query, setQuery] = useState('');
  const visibleBosses = useMemo(() => bosses.filter(boss => `${boss.name} ${boss.englishName}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return <aside className="sidebar">
    <div className="brand"><div className="brandMark">R</div><div><strong>RaidRU</strong><small>рейдовые тактики по-русски</small></div></div>
    <div className="season"><small>MIDNIGHT · СЕЗОН 2</small><strong>Ядовитая бездна</strong></div>
    <input className="bossSearch" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Найти босса…" />
    <nav className="bossList">
      {visibleBosses.map(boss => <button key={boss.id} className={state.selectedBossId === boss.id ? 'active' : ''} onClick={() => appStore.setBoss(boss.id)}>
        <span className="bossIndex">{boss.order}</span><span><strong>{boss.name}</strong><small>Босс {boss.order}</small></span><em>{state.bosses[boss.id].favorite ? '★' : ''}</em>
      </button>)}
    </nav>
    <div className="appVersion">{APP_VERSION_LABEL}</div>
  </aside>;
}
