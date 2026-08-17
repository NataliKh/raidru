import type { ChangeEvent } from 'react';
import { bossById } from '../data/content';
import { appStore, useAppState } from '../app/store';

export function NotesPage() {
  const state = useAppState();
  const boss = bossById[state.selectedBossId];
  return <section className="page notesPage"><div><small>ЛИЧНЫЕ ЗАМЕТКИ</small><h2>{boss.name}</h2><p>Заметка хранится в IndexedDB вместе с планом, а не в DOM.</p></div><textarea value={state.bosses[boss.id].note} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => appStore.setNote(boss.id, event.target.value)} placeholder="Например: мой сейв на второй стазис, стою справа…" /></section>;
}
