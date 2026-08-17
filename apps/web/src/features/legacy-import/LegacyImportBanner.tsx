import { useState } from 'react';
import { appStore, useAppState } from '../../app/store';
import { hasLegacyState } from './migrateV2';

export function LegacyImportBanner() {
  const state = useAppState();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || state.legacyImportedAt || !hasLegacyState()) return null;
  return <div className="legacyBanner"><div><strong>Найдены локальные данные RaidRU 2.x</strong><span>Состав, заметки, прогресс, сцены и таймлайн можно перенести в новую модель RaidRU 3.</span></div><div><button onClick={() => appStore.importLegacy()}>Импортировать</button><button className="ghost" onClick={() => setDismissed(true)}>Позже</button></div></div>;
}
