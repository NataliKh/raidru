import type { ChangeEvent } from 'react';
import type { PageId } from '@raidru/shared-types';
import { appStore, useAppState } from '../app/store';

const pages: Array<[PageId, string]> = [
  ['overview', 'Обзор'], ['tactics', 'Тактика'], ['raid', 'Рейд'], ['planner', 'Планировщик'], ['timeline', 'Таймлайн'], ['roster', 'Состав'], ['notes', 'Заметки']
];

export function TopNav() {
  const state = useAppState();
  return <header className="topNav">
    <nav>{pages.map(([id, label]) => <button key={id} className={state.activePage === id ? 'active' : ''} onClick={() => appStore.setPage(id)}>{label}</button>)}</nav>
    <div className="topActions">
      <button onClick={() => void appStore.exportBackup()}>⇩ Экспорт</button>
      <label className="fileButton">⇧ Импорт<input type="file" accept="application/json,.json" onChange={async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; if (!file) return;
        try { await appStore.importBackup(file); } catch (error) { alert(error instanceof Error ? error.message : String(error)); }
        event.target.value = '';
      }} /></label>
    </div>
  </header>;
}
