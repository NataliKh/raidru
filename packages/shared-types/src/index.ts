export type BossId = 'nekzali' | 'sentinels' | 'vashnik' | 'explorers' | 'sszorak' | 'fangs' | 'altar' | 'ulatek';
export type Difficulty = 'normal' | 'heroic' | 'mythic';
export type PageId = 'overview' | 'tactics' | 'raid' | 'planner' | 'timeline' | 'roster' | 'notes';
export type Role = 'tank' | 'healer' | 'dps';
export type Range = 'melee' | 'ranged';
export type SceneTokenType = 'boss' | 'tank' | 'healer' | 'melee' | 'ranged' | 'marker' | string;
export type TimelineKind = 'raid' | 'tank' | 'move' | 'adds' | 'burst' | 'heal' | string;

export interface TokenMeta {
  kind?: string;
  rosterId?: string;
  classKey?: string;
  role?: Role;
  range?: Range;
  [key: string]: unknown;
}

export interface SceneToken {
  id: string;
  label: string;
  type: SceneTokenType;
  x: number;
  y: number;
  meta?: TokenMeta;
}

export interface SceneEffect {
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  label?: string;
}

export interface Scene {
  id: string;
  name: string;
  note: string;
  duration: number;
  map: { zoom: number; x: number; y: number; dark: number };
  tokens: SceneToken[];
  effects: SceneEffect[];
  routes: Record<string, Array<{ x: number; y: number }>>;
}

export interface TimelineEvent {
  id: string;
  time: number;
  label: string;
  kind: TimelineKind;
  sceneIndex: number;
}

export interface Mechanic {
  name: string;
  englishName: string;
  description: string;
  roles: string;
  severity: string;
  note?: string;
}

export interface BossPhase {
  name: string;
  description: string;
  mechanics: Mechanic[];
}

export interface BossDefinition {
  id: BossId;
  order: number;
  name: string;
  englishName: string;
  summary: string;
  tags: string[];
  bloodlust: string;
  raidLead: string;
  healing: string;
  phases: BossPhase[];
  mapAsset: string;
}

export interface BossPlanState {
  favorite: boolean;
  progress: number;
  note: string;
  scenes: Scene[];
  timeline: TimelineEvent[];
}

export interface RosterMember {
  id: string;
  name: string;
  role: Role;
  classKey: string;
  range: Range;
}

export interface RaidruState {
  schemaVersion: 3;
  selectedBossId: BossId;
  difficulty: Difficulty;
  activePage: PageId;
  selectedSceneByBoss: Partial<Record<BossId, number>>;
  bosses: Record<BossId, BossPlanState>;
  roster: RosterMember[];
  legacyImportedAt?: string;
}
