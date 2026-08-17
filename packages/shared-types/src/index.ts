export type BossId = 'nekzali' | 'sentinels' | 'vashnik' | 'explorers' | 'sszorak' | 'fangs' | 'altar' | 'ulatek';
export type Difficulty = 'normal' | 'heroic' | 'mythic';
export type PageId = 'overview' | 'tactics' | 'raid' | 'planner' | 'timeline' | 'roster' | 'notes';
export type Role = 'tank' | 'healer' | 'dps';
export type Range = 'melee' | 'ranged';
export type SceneTokenType = 'boss' | 'tank' | 'healer' | 'melee' | 'ranged' | 'marker' | 'class' | 'mechanic' | string;
export type TimelineKind = 'raid' | 'tank' | 'move' | 'adds' | 'burst' | 'heal' | string;
export type DifficultySwitchMode = 'existing' | 'copy-current' | 'clear-target';
export type PlannerSelection =
  | { kind: 'token'; id: string }
  | { kind: 'effect'; id: string }
  | { kind: 'route'; id: string }
  | null;

export interface Point { x: number; y: number; }

export interface TokenMeta {
  kind?: string;
  rosterId?: string;
  classKey?: string;
  role?: Role;
  range?: Range;
  asset?: string;
  paletteId?: string;
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

export interface SceneEffectStyle {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  lineCap?: string;
  lineJoin?: string;
}

export interface SceneEffect {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  label?: string;
  points?: Point[];
  shape?: 'circle' | 'ellipse' | 'rect' | 'polygon' | 'cone' | string;
  style?: SceneEffectStyle;
  meta?: Record<string, unknown>;
}

export interface SceneRoute {
  id: string;
  name: string;
  points: Point[];
}

export interface Scene {
  id: string;
  name: string;
  note: string;
  duration: number;
  map: { zoom: number; x: number; y: number; dark: number; backgroundUrl?: string; sourceWidth?: number; sourceHeight?: number; source?: 'builtin' | 'raidplan' | string; raidPlan?: { sourceCode?: string; sourceUrl?: string; revision?: number | null; sceneIndex?: number } };
  tokens: SceneToken[];
  effects: SceneEffect[];
  routes: SceneRoute[];
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

export interface BossDifficultyPlanState {
  scenes: Scene[];
  timeline: TimelineEvent[];
}

export interface BossPlanState {
  favorite: boolean;
  progress: number;
  note: string;
  difficultyPlans: Record<Difficulty, BossDifficultyPlanState>;
}

export interface RosterMember {
  id: string;
  name: string;
  role: Role;
  classKey: string;
  range: Range;
}

export interface RaidruState {
  schemaVersion: 4;
  selectedBossId: BossId;
  difficulty: Difficulty;
  activePage: PageId;
  selectedSceneByBoss: Partial<Record<BossId, Partial<Record<Difficulty, number>>>>;
  bosses: Record<BossId, BossPlanState>;
  roster: RosterMember[];
  legacyImportedAt?: string;
}
