import type { BossId, BossPlanState, RaidruState, RosterMember, Scene, TimelineEvent } from '@raidru/shared-types';
import { bosses, builtInScenes, builtInTimelines } from '../../data/content';

export const LEGACY_STORAGE_KEY = 'raidru-standalone';

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

function normalizeLegacyScenes(value: unknown, fallback: Scene[]): Scene[] {
  if (!Array.isArray(value) || !value.length) return structuredClone(fallback);
  return value.map((scene, index) => {
    const source = (scene && typeof scene === 'object' ? scene : {}) as Record<string, unknown>;
    const tokens = Array.isArray(source.tokens) ? source.tokens : [];
    const effects = Array.isArray(source.effects) ? source.effects : [];
    return {
      id: `legacy-scene-${index + 1}`,
      name: String(source.name || `Сцена ${index + 1}`),
      note: String(source.note || ''),
      duration: safeNumber(source.duration, 10),
      map: { zoom: 100, x: 0, y: 0, dark: 4, ...((source.map && typeof source.map === 'object') ? source.map as object : {}) },
      tokens: tokens.map((token, tokenIndex) => {
        if (!Array.isArray(token)) return { id: `legacy-token-${tokenIndex}`, label: 'Объект', type: 'marker', x: 50, y: 50 };
        return { id: String(token[0] || `legacy-token-${tokenIndex}`), label: String(token[1] || ''), type: String(token[2] || 'marker'), x: safeNumber(token[3], 50), y: safeNumber(token[4], 50), meta: token[5] && typeof token[5] === 'object' ? token[5] : undefined };
      }),
      effects: effects.filter(Boolean) as Scene['effects'],
      routes: source.routes && typeof source.routes === 'object' ? structuredClone(source.routes as Scene['routes']) : {}
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

export function readLegacyState(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function hasLegacyState(): boolean {
  return Boolean(readLegacyState());
}

export function migrateLegacyState(base: RaidruState): RaidruState {
  const legacy = readLegacyState();
  if (!legacy) return base;
  const next = structuredClone(base);

  for (const boss of bosses) {
    const oldBoss = legacy[boss.id];
    if (!oldBoss || typeof oldBoss !== 'object') continue;
    const source = oldBoss as Record<string, unknown>;
    const difficultyPlans = source.difficultyPlans && typeof source.difficultyPlans === 'object'
      ? source.difficultyPlans as Record<string, unknown>
      : null;
    const selectedPlan = difficultyPlans?.[next.difficulty];
    const planSource = selectedPlan && typeof selectedPlan === 'object' ? selectedPlan as Record<string, unknown> : source;

    const merged: BossPlanState = {
      favorite: Boolean(source.favorite),
      progress: Math.max(0, Math.min(100, safeNumber(source.progress))),
      note: String(source.note || ''),
      scenes: normalizeLegacyScenes(planSource.scenes, builtInScenes[boss.id]),
      timeline: normalizeTimeline(planSource.timelineV3 || source.timelineV3, builtInTimelines[boss.id], boss.id)
    };
    next.bosses[boss.id] = merged;
  }

  next.roster = normalizeRoster(legacy.roster);
  next.legacyImportedAt = new Date().toISOString();
  return next;
}
