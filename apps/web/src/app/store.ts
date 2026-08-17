import { useSyncExternalStore } from 'react';
import type {
  BossDifficultyPlanState,
  BossId,
  Difficulty,
  DifficultySwitchMode,
  PageId,
  RaidruState,
  RosterMember,
  Scene,
  SceneEffect,
  SceneRoute,
  SceneToken,
  TimelineEvent
} from '@raidru/shared-types';
import { bosses, builtInScenes, builtInTimelines } from '../data/content';
import { loadState, saveState } from '../storage/indexedDb';
import { migrateLegacyState } from '../features/legacy-import/migrateV2';
import {
  addEffect as coreAddEffect,
  addRoute as coreAddRoute,
  addToken as coreAddToken,
  appendRoutePoint as coreAppendRoutePoint,
  clearMapObjects,
  clearScene as coreClearScene,
  insertScene as coreInsertScene,
  moveEffect as coreMoveEffect,
  moveRoutePoint as coreMoveRoutePoint,
  moveToken as coreMoveToken,
  patchEffect as corePatchEffect,
  patchRoute as corePatchRoute,
  patchToken as corePatchToken,
  removeEffect as coreRemoveEffect,
  removeRoute as coreRemoveRoute,
  removeScene as coreRemoveScene,
  removeToken as coreRemoveToken,
  updateScene as coreUpdateScene
} from '@raidru/planner-core';

const difficulties: Difficulty[] = ['normal', 'heroic', 'mythic'];
const HISTORY_LIMIT = 50;

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cloneBuiltInPlan(bossId: BossId): BossDifficultyPlanState {
  return { scenes: structuredClone(builtInScenes[bossId]), timeline: structuredClone(builtInTimelines[bossId]) };
}

function makeInitialState(): RaidruState {
  return {
    schemaVersion: 4,
    selectedBossId: 'sentinels',
    difficulty: 'heroic',
    activePage: 'raid',
    selectedSceneByBoss: {},
    bosses: Object.fromEntries(bosses.map(boss => [boss.id, {
      favorite: false,
      progress: 0,
      note: '',
      difficultyPlans: {
        normal: cloneBuiltInPlan(boss.id),
        heroic: cloneBuiltInPlan(boss.id),
        mythic: cloneBuiltInPlan(boss.id)
      }
    }])) as RaidruState['bosses'],
    roster: []
  };
}

function normalizeScene(scene: Scene, bossId: BossId, sceneIndex: number): Scene {
  const routes = Array.isArray(scene.routes)
    ? scene.routes.map((route, routeIndex) => ({
      id: route.id || `${bossId}-scene-${sceneIndex + 1}-route-${routeIndex + 1}`,
      name: route.name || `Маршрут ${routeIndex + 1}`,
      points: Array.isArray(route.points) ? route.points.map(point => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 })) : []
    }))
    : Object.entries((scene.routes || {}) as unknown as Record<string, Array<{ x: number; y: number }>>).map(([name, points], routeIndex) => ({
      id: `${bossId}-scene-${sceneIndex + 1}-route-${routeIndex + 1}`,
      name,
      points: Array.isArray(points) ? structuredClone(points) : []
    }));
  return {
    ...scene,
    id: scene.id || `${bossId}-scene-${sceneIndex + 1}`,
    tokens: (scene.tokens || []).map((token, index) => ({ ...token, id: token.id || `${bossId}-token-${sceneIndex}-${index}` })),
    effects: (scene.effects || []).map((effect, index) => ({ ...effect, id: effect.id || `${bossId}-effect-${sceneIndex}-${index}` })),
    routes
  };
}

function normalizeDifficultyPlan(plan: BossDifficultyPlanState, bossId: BossId): BossDifficultyPlanState {
  return {
    scenes: (plan.scenes || []).map((scene, index) => normalizeScene(scene, bossId, index)),
    timeline: structuredClone(plan.timeline || [])
  };
}

function upgradeStoredState(value: unknown): RaidruState | null {
  if (!value || typeof value !== 'object') return null;
  const saved = value as Record<string, unknown>;
  if (saved.schemaVersion === 4) {
    const candidate = structuredClone(saved) as unknown as RaidruState;
    for (const boss of bosses) {
      const plan = candidate.bosses?.[boss.id];
      if (!plan?.difficultyPlans) return null;
      for (const difficulty of difficulties) plan.difficultyPlans[difficulty] = normalizeDifficultyPlan(plan.difficultyPlans[difficulty], boss.id);
    }
    return candidate;
  }
  if (saved.schemaVersion !== 3) return null;
  const base = makeInitialState();
  const oldBosses = (saved.bosses || {}) as Record<string, { favorite?: boolean; progress?: number; note?: string; scenes?: Scene[]; timeline?: TimelineEvent[] }>;
  for (const boss of bosses) {
    const old = oldBosses[boss.id];
    if (!old) continue;
    const migrated = normalizeDifficultyPlan({ scenes: old.scenes || builtInScenes[boss.id], timeline: old.timeline || builtInTimelines[boss.id] }, boss.id);
    base.bosses[boss.id] = {
      favorite: Boolean(old.favorite),
      progress: Number(old.progress) || 0,
      note: String(old.note || ''),
      difficultyPlans: {
        normal: structuredClone(migrated),
        heroic: structuredClone(migrated),
        mythic: structuredClone(migrated)
      }
    };
  }
  base.selectedBossId = (saved.selectedBossId as BossId) || base.selectedBossId;
  base.difficulty = (saved.difficulty as Difficulty) || base.difficulty;
  base.activePage = (saved.activePage as PageId) || base.activePage;
  base.roster = Array.isArray(saved.roster) ? structuredClone(saved.roster as RosterMember[]) : [];
  const oldSelected = (saved.selectedSceneByBoss || {}) as Partial<Record<BossId, number>>;
  for (const boss of bosses) {
    const index = Number(oldSelected[boss.id] || 0);
    base.selectedSceneByBoss[boss.id] = { normal: index, heroic: index, mythic: index };
  }
  base.legacyImportedAt = typeof saved.legacyImportedAt === 'string' ? saved.legacyImportedAt : undefined;
  return base;
}

export function difficultyPlan(state: RaidruState, bossId = state.selectedBossId, difficulty = state.difficulty) {
  return state.bosses[bossId].difficultyPlans[difficulty];
}

class AppStore {
  private state: RaidruState = makeInitialState();
  private listeners = new Set<() => void>();
  private persistTimer: number | undefined;
  private historyPast: RaidruState[] = [];
  private historyFuture: RaidruState[] = [];
  private gestureActive = false;
  hydrated = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private emit(persist = true) {
    for (const listener of this.listeners) listener();
    if (!persist) return;
    window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => void saveState(this.state).catch(console.error), 250);
  }

  private pushHistory() {
    this.historyPast.push(structuredClone(this.state));
    if (this.historyPast.length > HISTORY_LIMIT) this.historyPast.shift();
    this.historyFuture = [];
  }

  private plannerCommit(mutator: (state: RaidruState) => RaidruState) {
    if (!this.gestureActive) this.pushHistory();
    this.state = mutator(this.state);
    this.emit();
  }

  private replaceDifficultyPlan(bossId: BossId, difficulty: Difficulty, nextPlan: BossDifficultyPlanState) {
    const boss = this.state.bosses[bossId];
    this.state = {
      ...this.state,
      bosses: {
        ...this.state.bosses,
        [bossId]: { ...boss, difficultyPlans: { ...boss.difficultyPlans, [difficulty]: nextPlan } }
      }
    };
  }

  async hydrate() {
    try {
      const saved = upgradeStoredState(await loadState());
      if (saved) this.state = saved;
    } catch (error) {
      console.warn('RaidRU 3 storage hydration failed', error);
    } finally {
      this.hydrated = true;
      this.emit();
    }
  }

  setPage(page: PageId) { this.state = { ...this.state, activePage: page }; this.emit(); }
  setBoss(bossId: BossId) { this.state = { ...this.state, selectedBossId: bossId }; this.emit(); }
  switchDifficulty(difficulty: Difficulty, mode: DifficultySwitchMode) {
    if (difficulty === this.state.difficulty) return;
    if (mode === 'existing') {
      this.state = { ...this.state, difficulty };
      this.emit();
      return;
    }
    this.pushHistory();
    const bossId = this.state.selectedBossId;
    const current = difficultyPlan(this.state, bossId, this.state.difficulty);
    const target = difficultyPlan(this.state, bossId, difficulty);
    const nextPlan = mode === 'copy-current'
      ? structuredClone(current)
      : clearMapObjects(target);
    this.replaceDifficultyPlan(bossId, difficulty, nextPlan);
    const currentIndex = this.getSceneIndex(bossId, this.state.difficulty);
    this.state = {
      ...this.state,
      difficulty,
      selectedSceneByBoss: {
        ...this.state.selectedSceneByBoss,
        [bossId]: { ...(this.state.selectedSceneByBoss[bossId] || {}), [difficulty]: Math.min(currentIndex, Math.max(0, nextPlan.scenes.length - 1)) }
      }
    };
    this.emit();
  }
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
  getSceneIndex(bossId: BossId, difficulty = this.state.difficulty) {
    return this.state.selectedSceneByBoss[bossId]?.[difficulty] || 0;
  }
  setScene(bossId: BossId, sceneIndex: number, difficulty = this.state.difficulty) {
    this.state = {
      ...this.state,
      selectedSceneByBoss: {
        ...this.state.selectedSceneByBoss,
        [bossId]: { ...(this.state.selectedSceneByBoss[bossId] || {}), [difficulty]: sceneIndex }
      }
    };
    this.emit();
  }

  canUndo() { return this.historyPast.length > 0; }
  canRedo() { return this.historyFuture.length > 0; }
  undo() {
    const previous = this.historyPast.pop();
    if (!previous) return;
    this.historyFuture.push(structuredClone(this.state));
    this.state = previous;
    this.gestureActive = false;
    this.emit();
  }
  redo() {
    const next = this.historyFuture.pop();
    if (!next) return;
    this.historyPast.push(structuredClone(this.state));
    this.state = next;
    this.gestureActive = false;
    this.emit();
  }
  beginPlannerGesture() {
    if (this.gestureActive) return;
    this.pushHistory();
    this.gestureActive = true;
  }
  endPlannerGesture() { this.gestureActive = false; }

  private applyPlan(state: RaidruState, bossId: BossId, difficulty: Difficulty, nextPlan: BossDifficultyPlanState): RaidruState {
    const boss = state.bosses[bossId];
    return { ...state, bosses: { ...state.bosses, [bossId]: { ...boss, difficultyPlans: { ...boss.difficultyPlans, [difficulty]: nextPlan } } } };
  }

  updateScene(bossId: BossId, difficulty: Difficulty, sceneIndex: number, patch: Partial<Pick<Scene, 'name' | 'note' | 'duration' | 'map'>>) {
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, coreUpdateScene(difficultyPlan(state, bossId, difficulty), sceneIndex, patch)));
  }
  addScene(bossId: BossId, difficulty: Difficulty, afterIndex: number) {
    const current = difficultyPlan(this.state, bossId, difficulty);
    const baseScene = current.scenes[Math.max(0, Math.min(afterIndex, current.scenes.length - 1))];
    const scene: Scene = {
      id: uid('scene'),
      name: `Сцена ${current.scenes.length + 1}`,
      note: '',
      duration: 10,
      map: structuredClone(baseScene?.map || { zoom: 100, x: 0, y: 0, dark: 4 }),
      tokens: [], effects: [], routes: []
    };
    this.plannerCommit(state => {
      const result = coreInsertScene(difficultyPlan(state, bossId, difficulty), afterIndex, scene);
      const next = this.applyPlan(state, bossId, difficulty, result.plan);
      return { ...next, selectedSceneByBoss: { ...next.selectedSceneByBoss, [bossId]: { ...(next.selectedSceneByBoss[bossId] || {}), [difficulty]: result.selectedIndex } } };
    });
    return scene.id;
  }
  duplicateScene(bossId: BossId, difficulty: Difficulty, sceneIndex: number) {
    const source = difficultyPlan(this.state, bossId, difficulty).scenes[sceneIndex];
    if (!source) return null;
    const clone: Scene = {
      ...structuredClone(source), id: uid('scene'), name: `${source.name} — копия`,
      tokens: source.tokens.map(token => ({ ...structuredClone(token), id: uid('token') })),
      effects: source.effects.map(effect => ({ ...structuredClone(effect), id: uid('effect') })),
      routes: source.routes.map(route => ({ ...structuredClone(route), id: uid('route') }))
    };
    this.plannerCommit(state => {
      const result = coreInsertScene(difficultyPlan(state, bossId, difficulty), sceneIndex, clone);
      const next = this.applyPlan(state, bossId, difficulty, result.plan);
      return { ...next, selectedSceneByBoss: { ...next.selectedSceneByBoss, [bossId]: { ...(next.selectedSceneByBoss[bossId] || {}), [difficulty]: result.selectedIndex } } };
    });
    return clone.id;
  }
  deleteScene(bossId: BossId, difficulty: Difficulty, sceneIndex: number) {
    const current = difficultyPlan(this.state, bossId, difficulty);
    if (current.scenes.length <= 1) return false;
    this.plannerCommit(state => {
      const result = coreRemoveScene(difficultyPlan(state, bossId, difficulty), sceneIndex);
      const next = this.applyPlan(state, bossId, difficulty, result.plan);
      return { ...next, selectedSceneByBoss: { ...next.selectedSceneByBoss, [bossId]: { ...(next.selectedSceneByBoss[bossId] || {}), [difficulty]: result.selectedIndex } } };
    });
    return true;
  }
  clearScene(bossId: BossId, difficulty: Difficulty, sceneIndex: number) {
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, coreClearScene(difficultyPlan(state, bossId, difficulty), sceneIndex)));
  }

  addToken(bossId: BossId, difficulty: Difficulty, sceneIndex: number, token: Omit<SceneToken, 'id'>) {
    const id = uid('token');
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, coreAddToken(difficultyPlan(state, bossId, difficulty), sceneIndex, { ...token, id })));
    return id;
  }
  updateToken(bossId: BossId, difficulty: Difficulty, sceneIndex: number, tokenId: string, patch: Partial<SceneToken>) {
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, corePatchToken(difficultyPlan(state, bossId, difficulty), sceneIndex, tokenId, patch)));
  }
  moveToken(bossId: BossId, difficulty: Difficulty, sceneIndex: number, tokenId: string, x: number, y: number) {
    const mutate = (state: RaidruState) => this.applyPlan(state, bossId, difficulty, coreMoveToken(difficultyPlan(state, bossId, difficulty), sceneIndex, tokenId, x, y));
    if (this.gestureActive) { this.state = mutate(this.state); this.emit(); } else this.plannerCommit(mutate);
  }
  removeToken(bossId: BossId, difficulty: Difficulty, sceneIndex: number, tokenId: string) {
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, coreRemoveToken(difficultyPlan(state, bossId, difficulty), sceneIndex, tokenId)));
  }

  addEffect(bossId: BossId, difficulty: Difficulty, sceneIndex: number, effect: Omit<SceneEffect, 'id'>) {
    const id = uid('effect');
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, coreAddEffect(difficultyPlan(state, bossId, difficulty), sceneIndex, { ...effect, id })));
    return id;
  }
  updateEffect(bossId: BossId, difficulty: Difficulty, sceneIndex: number, effectId: string, patch: Partial<SceneEffect>) {
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, corePatchEffect(difficultyPlan(state, bossId, difficulty), sceneIndex, effectId, patch)));
  }
  moveEffect(bossId: BossId, difficulty: Difficulty, sceneIndex: number, effectId: string, x: number, y: number) {
    const mutate = (state: RaidruState) => this.applyPlan(state, bossId, difficulty, coreMoveEffect(difficultyPlan(state, bossId, difficulty), sceneIndex, effectId, x, y));
    if (this.gestureActive) { this.state = mutate(this.state); this.emit(); } else this.plannerCommit(mutate);
  }
  removeEffect(bossId: BossId, difficulty: Difficulty, sceneIndex: number, effectId: string) {
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, coreRemoveEffect(difficultyPlan(state, bossId, difficulty), sceneIndex, effectId)));
  }

  createRoute(bossId: BossId, difficulty: Difficulty, sceneIndex: number, name?: string) {
    const id = uid('route');
    const route: SceneRoute = { id, name: name || `Маршрут ${difficultyPlan(this.state, bossId, difficulty).scenes[sceneIndex]?.routes.length + 1 || 1}`, points: [] };
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, coreAddRoute(difficultyPlan(state, bossId, difficulty), sceneIndex, route)));
    return id;
  }
  appendRoutePoint(bossId: BossId, difficulty: Difficulty, sceneIndex: number, routeId: string, x: number, y: number) {
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, coreAppendRoutePoint(difficultyPlan(state, bossId, difficulty), sceneIndex, routeId, x, y)));
  }
  moveRoutePoint(bossId: BossId, difficulty: Difficulty, sceneIndex: number, routeId: string, pointIndex: number, x: number, y: number) {
    const mutate = (state: RaidruState) => this.applyPlan(state, bossId, difficulty, coreMoveRoutePoint(difficultyPlan(state, bossId, difficulty), sceneIndex, routeId, pointIndex, x, y));
    if (this.gestureActive) { this.state = mutate(this.state); this.emit(); } else this.plannerCommit(mutate);
  }
  updateRoute(bossId: BossId, difficulty: Difficulty, sceneIndex: number, routeId: string, patch: Partial<Pick<SceneRoute, 'name'>>) {
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, corePatchRoute(difficultyPlan(state, bossId, difficulty), sceneIndex, routeId, patch)));
  }
  removeRoute(bossId: BossId, difficulty: Difficulty, sceneIndex: number, routeId: string) {
    this.plannerCommit(state => this.applyPlan(state, bossId, difficulty, coreRemoveRoute(difficultyPlan(state, bossId, difficulty), sceneIndex, routeId)));
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
    this.pushHistory();
    this.state = { ...this.state, bosses: { ...this.state.bosses, [bossId]: { favorite: false, progress: 0, note: '', difficultyPlans: { normal: cloneBuiltInPlan(bossId), heroic: cloneBuiltInPlan(bossId), mythic: cloneBuiltInPlan(bossId) } } } };
    this.emit();
  }
  async exportBackup() {
    const blob = new Blob([JSON.stringify({ format: 'raidru-3-backup', version: 2, exportedAt: new Date().toISOString(), state: this.state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `raidru-3-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async importBackup(file: File) {
    const payload = JSON.parse(await file.text()) as { format?: string; state?: unknown };
    const state = upgradeStoredState(payload.state);
    if (payload.format !== 'raidru-3-backup' || !state) throw new Error('Это не совместимая резервная копия RaidRU 3');
    this.pushHistory();
    this.state = state;
    this.emit();
  }
}


export const appStore = new AppStore();

export function useAppState() {
  return useSyncExternalStore(appStore.subscribe, appStore.getSnapshot, appStore.getSnapshot);
}

export type { SceneToken };
