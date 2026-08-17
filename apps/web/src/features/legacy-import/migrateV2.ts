import type { BossDifficultyPlanState, BossId, Difficulty, RaidruState, RosterMember, Scene, SceneRoute, TimelineEvent } from '@raidru/shared-types';
import { bosses, builtInScenes, builtInTimelines } from '../../data/content';

export const LEGACY_STORAGE_KEY = 'raidru-standalone';
const difficulties: Difficulty[] = ['normal', 'heroic', 'mythic'];

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRoster(value: unknown): RosterMember[] {
  if (!Array.isArray(value)) return [];
  return value.map((member, index) => {
    const source = (member && typeof member === 'object' ? member : {}) as Record<string, unknown>;
    const role = source.role === 'tank' || source.role === 'healer' ? source.role : 'dps';
    const range = source.range === 'melee' ? 'melee' : 'ranged';
    return {
      id: String(source.id || `legacy-roster-${index + 1}`),
      name: String(source.name || `Игрок ${index + 1}`).slice(0, 50),
      role,
      classKey: String(source.classKey || ''),
      range
    };
  });
}

function normalizeRoutes(value: unknown, sceneIndex: number): SceneRoute[] {
  if (Array.isArray(value)) return value.map((route, routeIndex) => {
    const source = route && typeof route === 'object' ? route as Record<string, unknown> : {};
    const points = Array.isArray(source.points) ? source.points : [];
    return {
      id: String(source.id || `legacy-route-${sceneIndex}-${routeIndex}`),
      name: String(source.name || `Маршрут ${routeIndex + 1}`),
      points: points.map(point => {
        const p = point && typeof point === 'object' ? point as Record<string, unknown> : {};
        return { x: safeNumber(p.x), y: safeNumber(p.y) };
      })
    };
  });
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).map(([name, rawPoints], routeIndex) => ({
    id: `legacy-route-${sceneIndex}-${routeIndex}`,
    name,
    points: Array.isArray(rawPoints) ? rawPoints.map(point => {
      const p = point && typeof point === 'object' ? point as Record<string, unknown> : {};
      return { x: safeNumber(p.x), y: safeNumber(p.y) };
    }) : []
  }));
}

function normalizeLegacyScenes(value: unknown, fallback: Scene[]): Scene[] {
  if (!Array.isArray(value) || !value.length) return structuredClone(fallback);
  return value.map((scene, index) => {
    const source = (scene && typeof scene === 'object' ? scene : {}) as Record<string, unknown>;
    const tokens = Array.isArray(source.tokens) ? source.tokens : [];
    const effects = Array.isArray(source.effects) ? source.effects : [];
    return {
      id: String(source.id || `legacy-scene-${index + 1}`),
      name: String(source.name || `Сцена ${index + 1}`),
      note: String(source.note || ''),
      duration: safeNumber(source.duration, 10),
      map: { zoom: 100, x: 0, y: 0, dark: 4, ...((source.map && typeof source.map === 'object') ? source.map as object : {}) },
      tokens: tokens.map((token, tokenIndex) => {
        if (Array.isArray(token)) return { id: String(token[0] || `legacy-token-${tokenIndex}`), label: String(token[1] || ''), type: String(token[2] || 'marker'), x: safeNumber(token[3], 50), y: safeNumber(token[4], 50), meta: token[5] && typeof token[5] === 'object' ? token[5] : undefined };
        const item = token && typeof token === 'object' ? token as Record<string, unknown> : {};
        return { id: String(item.id || `legacy-token-${tokenIndex}`), label: String(item.label || 'Объект'), type: String(item.type || 'marker'), x: safeNumber(item.x, 50), y: safeNumber(item.y, 50), meta: item.meta && typeof item.meta === 'object' ? item.meta as Record<string, unknown> : undefined };
      }),
      effects: effects.map((effect, effectIndex) => {
        const item = effect && typeof effect === 'object' ? effect as Record<string, unknown> : {};
        return { id: String(item.id || `legacy-effect-${index}-${effectIndex}`), type: String(item.type || 'danger'), x: safeNumber(item.x, 50), y: safeNumber(item.y, 50), w: safeNumber(item.w, 20), h: safeNumber(item.h, 20), rot: safeNumber(item.rot), label: item.label ? String(item.label) : undefined };
      }),
      routes: normalizeRoutes(source.routes, index)
    };
  });
}

function normalizeTimeline(value: unknown, fallback: TimelineEvent[], bossId: BossId): TimelineEvent[] {
  if (!Array.isArray(value) || !value.length) return structuredClone(fallback);
  return value.map((entry, index) => {
    if (Array.isArray(entry)) return { id: `legacy-${bossId}-event-${index}`, time: safeNumber(entry[0]), label: String(entry[1] || ''), kind: String(entry[2] || 'raid'), sceneIndex: safeNumber(entry[3]) };
    const source = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    return { id: String(source.id || `legacy-${bossId}-event-${index}`), time: safeNumber(source.time), label: String(source.label || ''), kind: String(source.type || source.kind || 'raid'), sceneIndex: safeNumber(source.scene || source.sceneIndex) };
  });
}

function normalizeDifficultyPlan(value: unknown, bossId: BossId): BossDifficultyPlanState {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    scenes: normalizeLegacyScenes(source.scenes, builtInScenes[bossId]),
    timeline: normalizeTimeline(source.timelineV3 || source.timeline, builtInTimelines[bossId], bossId)
  };
}

export function readLegacyState(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function hasLegacyState(): boolean { return Boolean(readLegacyState()); }

export function migrateLegacyState(base: RaidruState): RaidruState {
  const legacy = readLegacyState();
  if (!legacy) return base;
  const next = structuredClone(base);

  for (const boss of bosses) {
    const oldBoss = legacy[boss.id];
    if (!oldBoss || typeof oldBoss !== 'object') continue;
    const source = oldBoss as Record<string, unknown>;
    const rawDifficultyPlans = source.difficultyPlans && typeof source.difficultyPlans === 'object' ? source.difficultyPlans as Record<string, unknown> : null;
    const fallbackPlan = normalizeDifficultyPlan(source, boss.id);
    const difficultyPlans = Object.fromEntries(difficulties.map(difficulty => [difficulty, rawDifficultyPlans?.[difficulty] ? normalizeDifficultyPlan(rawDifficultyPlans[difficulty], boss.id) : structuredClone(fallbackPlan)])) as RaidruState['bosses'][BossId]['difficultyPlans'];
    next.bosses[boss.id] = {
      favorite: Boolean(source.favorite),
      progress: Math.max(0, Math.min(100, safeNumber(source.progress))),
      note: String(source.note || ''),
      difficultyPlans
    };
  }

  next.roster = normalizeRoster(legacy.roster);
  next.legacyImportedAt = new Date().toISOString();
  return next;
}
