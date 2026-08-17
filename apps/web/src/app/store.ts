import { useSyncExternalStore } from 'react';
import type { BossId, Difficulty, PageId, RaidruState, RosterMember, SceneToken } from '@raidru/shared-types';
import { bosses, builtInScenes, builtInTimelines } from '../data/content';
import { loadState, saveState } from '../storage/indexedDb';
import { migrateLegacyState } from '../features/legacy-import/migrateV2';

function makeInitialState(): RaidruState {
  return {
    schemaVersion: 3,
    selectedBossId: 'sentinels',
    difficulty: 'heroic',
    activePage: 'raid',
    selectedSceneByBoss: {},
    bosses: Object.fromEntries(bosses.map(boss => [boss.id, {
      favorite: false,
      progress: 0,
      note: '',
      scenes: structuredClone(builtInScenes[boss.id]),
      timeline: structuredClone(builtInTimelines[boss.id])
    }])) as RaidruState['bosses'],
    roster: []
  };
}

class AppStore {
  private state: RaidruState = makeInitialState();
  private listeners = new Set<() => void>();
  private persistTimer: number | undefined;
  hydrated = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private emit() {
    for (const listener of this.listeners) listener();
    window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => void saveState(this.state).catch(console.error), 250);
  }

  async hydrate() {
    try {
      const saved = await loadState();
      if (saved?.schemaVersion === 3) this.state = saved;
    } catch (error) {
      console.warn('RaidRU 3 storage hydration failed', error);
    } finally {
      this.hydrated = true;
      this.emit();
    }
  }

  setPage(page: PageId) { this.state = { ...this.state, activePage: page }; this.emit(); }
  setBoss(bossId: BossId) { this.state = { ...this.state, selectedBossId: bossId }; this.emit(); }
  setDifficulty(difficulty: Difficulty) { this.state = { ...this.state, difficulty }; this.emit(); }
  setProgress(bossId: BossId, progress: number) {
    this.state = { ...this.state, bosses: { ...this.state.bosses, [bossId]: { ...this.state.bosses[bossId], progress } } };
    this.emit();
  }
  toggleFavorite(bossId: BossId) {
    const boss = this.state.bosses[bossId];
    this.state = { ...this.state, bosses: { ...this.state.bosses, [bossId]: { ...boss, favorite: !boss.favorite } } };
    this.emit();
  }
  setNote(bossId: BossId, note: string) {
    this.state = { ...this.state, bosses: { ...this.state.bosses, [bossId]: { ...this.state.bosses[bossId], note } } };
    this.emit();
  }
  setScene(bossId: BossId, sceneIndex: number) {
    this.state = { ...this.state, selectedSceneByBoss: { ...this.state.selectedSceneByBoss, [bossId]: sceneIndex } };
    this.emit();
  }
  moveToken(bossId: BossId, sceneIndex: number, tokenId: string, x: number, y: number) {
    const plan = this.state.bosses[bossId];
    const scenes = plan.scenes.map((scene, index) => index !== sceneIndex ? scene : {
      ...scene,
      tokens: scene.tokens.map(token => token.id === tokenId ? { ...token, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : token)
    });
    this.state = { ...this.state, bosses: { ...this.state.bosses, [bossId]: { ...plan, scenes } } };
    this.emit();
  }
  addRoster(member: Omit<RosterMember, 'id'>) {
    const next: RosterMember = { ...member, id: crypto.randomUUID() };
    this.state = { ...this.state, roster: [...this.state.roster, next] };
    this.emit();
  }
  removeRoster(id: string) { this.state = { ...this.state, roster: this.state.roster.filter(member => member.id !== id) }; this.emit(); }
  replaceRoster(roster: RosterMember[]) { this.state = { ...this.state, roster }; this.emit(); }
  importLegacy() { this.state = migrateLegacyState(this.state); this.emit(); }
  resetBoss(bossId: BossId) {
    this.state = { ...this.state, bosses: { ...this.state.bosses, [bossId]: { favorite: false, progress: 0, note: '', scenes: structuredClone(builtInScenes[bossId]), timeline: structuredClone(builtInTimelines[bossId]) } } };
    this.emit();
  }
  async exportBackup() {
    const blob = new Blob([JSON.stringify({ format: 'raidru-3-backup', version: 1, exportedAt: new Date().toISOString(), state: this.state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `raidru-3-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async importBackup(file: File) {
    const payload = JSON.parse(await file.text()) as { format?: string; state?: RaidruState };
    if (payload.format !== 'raidru-3-backup' || payload.state?.schemaVersion !== 3) throw new Error('Это не резервная копия RaidRU 3');
    this.state = payload.state;
    this.emit();
  }
}

export const appStore = new AppStore();

export function useAppState() {
  return useSyncExternalStore(appStore.subscribe, appStore.getSnapshot, appStore.getSnapshot);
}

export type { SceneToken };
