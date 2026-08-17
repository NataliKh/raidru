import type { BossDefinition, BossId, BossPhase, Scene, SceneEffect, SceneToken, TimelineEvent } from '@raidru/shared-types';
import legacyContent from './legacy-content.json';

type LegacyBoss = {
  id: BossId;
  order: number;
  name: string;
  en: string;
  summary: string;
  tags: string[];
  bl: string;
  rl: string;
  heal: string;
  phases: Array<[string, string, Array<[string, string, string, string, string, string?]>]>;
};

type LegacyToken = [string, string, string, number, number, Record<string, unknown>?];
type LegacyScene = {
  name?: string;
  note?: string;
  duration?: number;
  map?: { zoom?: number; x?: number; y?: number; dark?: number };
  tokens?: LegacyToken[];
  effects?: SceneEffect[];
  routes?: Record<string, Array<{ x: number; y: number }>>;
};
type LegacyTimeline = [number, string, string, number];

type ContentJson = {
  raid: LegacyBoss[];
  presetScenes: Record<BossId, LegacyScene[]>;
  presetTimelines: Record<BossId, LegacyTimeline[]>;
};

const raw = legacyContent as unknown as ContentJson;

const bossMapAssets: Record<BossId, string> = {
  nekzali: './assets/maps/nekzali.webp',
  sentinels: './assets/maps/sentinels.webp',
  vashnik: './assets/maps/vashnik.webp',
  explorers: './assets/maps/explorers.webp',
  sszorak: './assets/maps/sszorak.webp',
  fangs: './assets/maps/fangs.webp',
  altar: './assets/maps/altar.webp',
  ulatek: './assets/maps/ulatek.webp'
};

function normalizeToken(token: LegacyToken): SceneToken {
  return { id: token[0], label: token[1], type: token[2], x: token[3], y: token[4], meta: token[5] };
}

function normalizeScene(scene: LegacyScene, bossId: BossId, index: number): Scene {
  return {
    id: `${bossId}-scene-${index + 1}`,
    name: scene.name || `Сцена ${index + 1}`,
    note: scene.note || '',
    duration: Number(scene.duration || 10),
    map: {
      zoom: Number(scene.map?.zoom || 100),
      x: Number(scene.map?.x || 0),
      y: Number(scene.map?.y || 0),
      dark: Number(scene.map?.dark ?? 4)
    },
    tokens: (scene.tokens || []).map(normalizeToken),
    effects: (scene.effects || []).map(effect => ({ ...effect })),
    routes: structuredClone(scene.routes || {})
  };
}

function normalizePhase(phase: LegacyBoss['phases'][number]): BossPhase {
  return {
    name: phase[0],
    description: phase[1] || '',
    mechanics: (phase[2] || []).map(mechanic => ({
      name: mechanic[0],
      englishName: mechanic[1],
      description: mechanic[2],
      roles: mechanic[3],
      severity: mechanic[4],
      note: mechanic[5]
    }))
  };
}

export const bosses: BossDefinition[] = raw.raid
  .map(boss => ({
    id: boss.id,
    order: boss.order,
    name: boss.name,
    englishName: boss.en,
    summary: boss.summary,
    tags: boss.tags,
    bloodlust: boss.bl,
    raidLead: boss.rl,
    healing: boss.heal,
    phases: boss.phases.map(normalizePhase),
    mapAsset: bossMapAssets[boss.id]
  }))
  .sort((a, b) => a.order - b.order);

export const builtInScenes = Object.fromEntries(
  bosses.map(boss => [boss.id, (raw.presetScenes[boss.id] || []).map((scene, index) => normalizeScene(scene, boss.id, index))])
) as Record<BossId, Scene[]>;

export const builtInTimelines = Object.fromEntries(
  bosses.map(boss => [boss.id, (raw.presetTimelines[boss.id] || []).map((event, index): TimelineEvent => ({
    id: `${boss.id}-event-${index + 1}`,
    time: event[0],
    label: event[1],
    kind: event[2],
    sceneIndex: event[3]
  }))])
) as Record<BossId, TimelineEvent[]>;

export const bossById = Object.fromEntries(bosses.map(boss => [boss.id, boss])) as Record<BossId, BossDefinition>;

export function mapAssetForScene(bossId: BossId, sceneName: string): string {
  if (bossId === 'ulatek' && /фаза 3|p3|финаль/i.test(sceneName)) return './assets/maps/ulatek_p3.webp';
  return bossMapAssets[bossId];
}
