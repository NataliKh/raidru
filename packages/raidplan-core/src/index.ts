import type { BossDifficultyPlanState, BossId, Point, Scene, SceneEffect, SceneToken } from '@raidru/shared-types';

export const RAIDPLAN_ADAPTER_VERSION = '3.0.0-alpha.3.1';

export type RaidPlanApplyMode = 'append' | 'replace';

export interface RaidPlanImportReport {
  adapterVersion: string;
  sourceVersion: number | null;
  revision: number | null;
  bossId: BossId;
  scenes: number;
  nodes: number;
  tokens: number;
  effects: number;
  text: number;
  hidden: number;
  skipped: number;
  unsupported: string[];
  degeneratePaths: number;
  nativePaths: number;
  offCanvasVectors: number;
  suppressedArenaVisuals: number;
  suppressedBackdropFills: number;
  coordinateModes: Record<string, number>;
}

export type RaidPlanImportResult =
  | {
      ok: true;
      bossId: BossId;
      planName: string;
      sourceCode: string;
      sourceRevision: number | null;
      plan: BossDifficultyPlanState;
      warnings: string[];
      report: RaidPlanImportReport;
    }
  | {
      ok: false;
      warnings: string[];
      error: string;
      report?: Partial<RaidPlanImportReport>;
    };

export interface RaidPlanConvertOptions {
  currentBoss?: BossId;
  sourceUrl?: string;
}

type UnknownRecord = Record<string, unknown>;
type RaidPlanStep = UnknownRecord & { __raidplanV2?: boolean; index?: number; nodes?: unknown[] };

type Transform = {
  mode: string;
  canvas: { w: number; h: number };
  scaleX: number;
  scaleY: number;
  map: (x: number, y: number) => Point;
};

const STEP_KEYS = ['steps', 'scenes', 'pages', 'slides', 'frames'];
const ITEM_KEYS = ['objects', 'elements', 'items', 'components', 'drawings', 'entities', 'children', 'nodes'];
const ALLOWED_V2 = new Set([
  'arena', 'itext', 'marker', 'mob',
  'circle', 'ellipse', 'rect', 'rectangle', 'square', 'polygon',
  'line', 'path', 'cone', 'wedge', 'sector',
  'player', 'character', 'member', 'assignment', 'slot', 'role', 'class', 'job',
  'icon', 'ability', 'spell', 'status', 'effect', 'aura', 'sticker', 'encountericon', 'encounter_icon', 'encounter-icon', 'tooltip'
]);
const BOSS_ALIASES: Record<BossId, string[]> = {
  nekzali: ['nakzali', 'nekzali', "nek'zali", 'nek’zali', 'soulcoiler', 'заклинательница душ'],
  sentinels: ['entombed sentinels', 'sentinels', 'погребенные часовые', 'погребённые часовые'],
  vashnik: ['vashnik', 'malignant', 'вашник'],
  explorers: ['lost explorers', 'explorers', 'потерянные исследователи'],
  sszorak: ['sszorak', 'сззорак'],
  fangs: ['twin fangs', 'fangs', 'двойные клыки', 'pit of fangs'],
  altar: ['coiled altar', 'altar', 'спиральный алтарь'],
  ulatek: ['ulatek', "ula'tek", 'ula’tek', 'ула’тек', 'улатек']
};

const MARKER_LABEL: Record<string, string> = { star: '★', circle: '●', diamond: '◆', triangle: '▲', moon: '☾', square: '■', cross: '✕', skull: '☠' };

function isObject(value: unknown): value is UnknownRecord { return !!value && typeof value === 'object' && !Array.isArray(value); }
function asArray(value: unknown): unknown[] { return Array.isArray(value) ? value : isObject(value) ? Object.values(value) : []; }
function text(value: unknown): string { return value == null ? '' : String(value); }
function clean(value: unknown): string { return text(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function preserveText(value: unknown): string { return text(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\r\n/g, '\n').trim(); }
function finite(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function deepPick(root: unknown, paths: string[][]): unknown {
  for (const path of paths) {
    let value: unknown = root;
    for (const key of path) value = isObject(value) ? value[key] : undefined;
    if (value != null) return value;
  }
  return null;
}
function first(root: UnknownRecord | undefined, keys: string[]): unknown {
  if (!root) return null;
  for (const key of keys) if (root[key] != null) return root[key];
  return null;
}
function boolTrue(value: unknown): boolean { return value === true || value === 1 || (typeof value === 'string' && /^(1|true|yes|on)$/i.test(value.trim())); }
function boolFalse(value: unknown): boolean { return value === false || value === 0 || (typeof value === 'string' && /^(0|false|no|off)$/i.test(value.trim())); }
function round(value: number, digits = 3): number { const p = 10 ** digits; return Math.round(value * p) / p; }
function cdnAsset(asset: unknown): string {
  const value = text(asset).trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://cdn.raidplan.io/${value.replace(/^\/+/, '')}`;
}

function alphaNumber(value: unknown): number | null {
  const number = finite(value);
  if (number == null) return null;
  return clamp(number > 1 && number <= 100 ? number / 100 : number, 0, 1);
}
function colorEmbeddedAlpha(value: unknown): number | null {
  const color = text(value).trim();
  if (!color) return null;
  const rgba = color.match(/^rgba\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([0-9.]+)\s*\)$/i);
  if (rgba) return alphaNumber(rgba[1]);
  const hex = color.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i);
  if (!hex) return null;
  const raw = hex[1];
  return (raw.length === 4 ? parseInt(raw[3] + raw[3], 16) : parseInt(raw.slice(6, 8), 16)) / 255;
}
function deepAlpha(node: unknown, kind: 'opacity' | 'fill' | 'stroke' = 'opacity'): number | null {
  const object = isObject(node) ? node : {};
  const roots = [object.attr, object.style, object.data, object.meta, object].filter(isObject);
  const keys = kind === 'fill'
    ? ['fillOpacity', 'fillAlpha', 'backgroundOpacity', 'backgroundAlpha']
    : kind === 'stroke'
      ? ['strokeOpacity', 'strokeAlpha', 'borderOpacity', 'borderAlpha']
      : ['opacity', 'alpha', 'globalAlpha'];
  for (const root of roots) for (const key of keys) {
    const number = alphaNumber(root[key]);
    if (number != null) return number;
  }
  if (kind === 'fill') return colorEmbeddedAlpha(deepPick(object, [['attr', 'fill'], ['style', 'fill'], ['fill']]));
  if (kind === 'stroke') return colorEmbeddedAlpha(deepPick(object, [['attr', 'stroke'], ['style', 'stroke'], ['stroke']]));
  return null;
}
function transparentColor(value: unknown): boolean {
  const color = text(value).trim().toLowerCase();
  if (!color || color === 'transparent' || color === 'none') return true;
  if (/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(color)) return true;
  return /^#(?:[0-9a-f]{6}00|[0-9a-f]{3}0)$/.test(color);
}
function visualValue(node: unknown, keys: string[]): unknown {
  const object = isObject(node) ? node : {};
  const roots = [object.attr, object.style, object.data, object.meta, object].filter(isObject);
  for (const root of roots) for (const key of keys) if (root[key] != null) return root[key];
  return null;
}
function nearWhiteColor(value: unknown): boolean {
  const color = text(value).trim().toLowerCase();
  if (/^#fff(?:fff)?$/.test(color)) return true;
  const hex = color.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (hex) {
    const raw = hex[1];
    return parseInt(raw.slice(0, 2), 16) >= 245 && parseInt(raw.slice(2, 4), 16) >= 245 && parseInt(raw.slice(4, 6), 16) >= 245;
  }
  return false;
}

export function raidPlanCode(input: string): string {
  const value = input.trim();
  const match = value.match(/(?:https?:\/\/)?(?:www\.)?raidplan\.io\/plan\/([^/?#]+)/i);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : '';
}
export function canonicalRaidPlanUrl(input: string): string {
  const code = raidPlanCode(input);
  return code ? `https://raidplan.io/plan/${code}` : '';
}

function scoreCandidate(value: unknown): number {
  if (!isObject(value)) return -1;
  let score = 0;
  for (const key of STEP_KEYS) if (Array.isArray(value[key]) || isObject(value[key])) score += 30;
  for (const key of ITEM_KEYS) if (Array.isArray(value[key]) || isObject(value[key])) score += 8;
  if (Array.isArray(value.nodes) && Number.isFinite(Number(value.steps))) score += 80;
  if (value.code && value.version != null && value.revision != null) score += 12;
  return score;
}

export function findRaidPlanRoot(raw: unknown): UnknownRecord | null {
  const root = isObject(raw) ? raw : null;
  const seeds = [root, root?.plan, root?.data, isObject(root?.data) ? root.data.plan : null, root?.payload, isObject(root?.payload) ? root.payload.plan : null, root?.result, isObject(root?.result) ? root.result.plan : null].filter(isObject);
  let best: UnknownRecord | null = null;
  let bestScore = -1;
  const queue: Array<{ value: UnknownRecord; depth: number }> = seeds.map(value => ({ value, depth: 0 }));
  const seen = new WeakSet<object>();
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current.value)) continue;
    seen.add(current.value);
    const score = scoreCandidate(current.value);
    if (score > bestScore) { best = current.value; bestScore = score; }
    if (current.depth >= 5) continue;
    for (const child of Object.values(current.value)) {
      if (isObject(child)) queue.push({ value: child, depth: current.depth + 1 });
      else if (Array.isArray(child)) for (const item of child.slice(0, 80)) if (isObject(item)) queue.push({ value: item, depth: current.depth + 1 });
    }
  }
  return bestScore >= 8 ? best : null;
}

function findSteps(plan: UnknownRecord): RaidPlanStep[] {
  const v2Nodes = plan.nodes;
  if (Array.isArray(v2Nodes) && Number.isFinite(Number(plan.steps))) {
    const count = Math.max(1, Math.floor(Number(plan.steps)));
    return Array.from({ length: count }, (_, index) => ({
      __raidplanV2: true,
      index,
      nodes: v2Nodes.filter((node: unknown) => (finite(deepPick(node, [['meta', 'step']])) ?? 0) === index),
      code: plan.code,
      revision: plan.revision
    }));
  }
  for (const key of STEP_KEYS) {
    const value = plan[key];
    if (Array.isArray(value)) return value.filter(isObject);
    if (isObject(value)) return Object.values(value).filter(isObject);
  }
  if (ITEM_KEYS.some(key => Array.isArray(plan[key]) || isObject(plan[key]))) return [plan];
  return [];
}

function readXY(node: unknown): { x: number | null; y: number | null } {
  return {
    x: finite(deepPick(node, [['x'], ['left'], ['cx'], ['position', 'x'], ['pos', 'x'], ['meta', 'pos', 'x'], ['transform', 'x'], ['point', 'x'], ['coordinates', 'x'], ['location', 'x']])),
    y: finite(deepPick(node, [['y'], ['top'], ['cy'], ['position', 'y'], ['pos', 'y'], ['meta', 'pos', 'y'], ['transform', 'y'], ['point', 'y'], ['coordinates', 'y'], ['location', 'y']]))
  };
}
function nativeScale(node: unknown): { sx: number; sy: number } {
  const scalar = finite(deepPick(node, [['meta', 'scale'], ['attr', 'scale'], ['data', 'scale'], ['scale']]));
  const sx = finite(deepPick(node, [['meta', 'scale', 'x'], ['attr', 'scale', 'x'], ['data', 'scale', 'x'], ['scale', 'x'], ['meta', 'scaleX'], ['attr', 'scaleX'], ['scaleX']])) ?? scalar ?? 1;
  const sy = finite(deepPick(node, [['meta', 'scale', 'y'], ['attr', 'scale', 'y'], ['data', 'scale', 'y'], ['scale', 'y'], ['meta', 'scaleY'], ['attr', 'scaleY'], ['scaleY']])) ?? scalar ?? 1;
  return { sx: Math.abs(sx) || 1, sy: Math.abs(sy) || 1 };
}
function readRotation(node: unknown): number {
  let rotation = finite(deepPick(node, [
    ['attr', 'rotation'], ['attr', 'rot'], ['attr', 'angle'], ['data', 'rotation'], ['data', 'rot'], ['data', 'angle'],
    ['rotation'], ['rot'], ['angle'], ['meta', 'rotation'], ['meta', 'rot'], ['meta', 'angle'], ['degrees'], ['direction']
  ])) ?? 0;
  if (Math.abs(rotation) <= Math.PI * 2 + .02 && Math.abs(rotation) > .001) rotation = rotation * 180 / Math.PI;
  return rotation;
}
function nodeType(node: unknown): string { return text(deepPick(node, [['type'], ['kind'], ['objectType']])).toLowerCase(); }
function objectLabel(node: unknown): string {
  return clean(deepPick(node, [['text'], ['label'], ['name'], ['title'], ['displayName'], ['value'], ['caption'], ['header'], ['attr', 'text'], ['attr', 'lname'], ['attr', 'label'], ['attr', 'name']]) || '');
}
function typeString(node: unknown): string {
  return [nodeType(node), text(deepPick(node, [['role'], ['job'], ['class'], ['attr', 'asset'], ['attr', 'markerStyle']])), objectLabel(node)].join(' ').toLowerCase();
}
function roleType(node: unknown): 'tank' | 'healer' | 'melee' | 'ranged' | '' {
  if (nodeType(node) === 'itext') return '';
  const asset = text(deepPick(node, [['attr', 'asset'], ['asset'], ['icon']])).toLowerCase();
  if (/role\/tank\.svg(?:$|\?)/.test(asset)) return 'tank';
  if (/role\/healer\.svg(?:$|\?)/.test(asset)) return 'healer';
  if (/role\/mdps\.svg(?:$|\?)/.test(asset)) return 'melee';
  if (/role\/rdps\.svg(?:$|\?)/.test(asset)) return 'ranged';
  const raw = `${text(deepPick(node, [['role'], ['job'], ['class']]))} ${text(deepPick(node, [['attr', 'role'], ['attr', 'job'], ['attr', 'class']]))}`.toLowerCase();
  if (/\btank\b|танк/.test(raw)) return 'tank';
  if (/\bhealer\b|\bheal\b|хил|лекарь/.test(raw)) return 'healer';
  if (/\bmdps\b|\bmelee\b|мили/.test(raw)) return 'melee';
  if (/\brdps\b|\branged\b|\brange\b|рдд/.test(raw)) return 'ranged';
  return '';
}
function markerKey(node: unknown): string {
  const asset = text(deepPick(node, [['attr', 'asset'], ['asset'], ['icon']])).toLowerCase();
  if (/game\/wow\/role\//.test(asset)) return '';
  for (const key of Object.keys(MARKER_LABEL)) if (asset.includes(`/raid/${key}.`)) return key;
  const raw = `${nodeType(node)} ${objectLabel(node)} ${text(deepPick(node, [['attr', 'text'], ['attr', 'lname']]))}`.toLowerCase();
  const aliases: Record<string, string[]> = {
    star: ['star', 'звезд', '⭐', '★'], circle: ['circle', 'orange', 'круг', '●'], diamond: ['diamond', 'purple', 'ромб', '◆'], triangle: ['triangle', 'green', 'треуг', '▲'],
    moon: ['moon', 'луна', '☾'], square: ['square', 'blue', 'квадрат', '■'], cross: ['cross', 'крест', '✕'], skull: ['skull', 'череп', '☠', '💀']
  };
  for (const [key, words] of Object.entries(aliases)) if (words.some(word => raw.includes(word))) return key;
  return '';
}
function bossFromRaw(raw: unknown): BossId | '' {
  let probe = '';
  try { probe = JSON.stringify(raw).slice(0, 100000).toLowerCase(); } catch { probe = text(raw).toLowerCase(); }
  for (const [id, aliases] of Object.entries(BOSS_ALIASES) as Array<[BossId, string[]]>) if (aliases.some(alias => probe.includes(alias.toLowerCase()))) return id;
  return '';
}

function helperTextNode(node: unknown): boolean {
  if (nodeType(node) !== 'itext') return false;
  const probe = [
    text(deepPick(node, [['attr','name'], ['attr','id'], ['name'], ['id']])),
    text(deepPick(node, [['meta','type'], ['meta','kind'], ['meta','name'], ['data','type'], ['data','kind']]))
  ].join(' ').toLowerCase();
  return /(?:^|[\s_-])(helper|guide|placeholder|measure|ruler|debug|watermark|selection|hitbox)(?:$|[\s_-])/.test(probe);
}

function hiddenNode(node: unknown): boolean {
  if (helperTextNode(node)) return true;
  const opacity = deepAlpha(node, 'opacity');
  if (opacity != null && opacity <= .0001) return true;
  const scalar = finite(deepPick(node, [['meta', 'scale'], ['scale']]));
  const sx = finite(deepPick(node, [['meta', 'scale', 'x'], ['scale', 'x'], ['meta', 'scaleX'], ['scaleX']]));
  const sy = finite(deepPick(node, [['meta', 'scale', 'y'], ['scale', 'y'], ['meta', 'scaleY'], ['scaleY']]));
  if (scalar === 0 || sx === 0 || sy === 0) return true;
  const object = isObject(node) ? node : {};
  const roots = [object.meta, object.attr, object.data, object].filter(isObject);
  for (const root of roots) {
    if (boolTrue(root.hidden) || boolTrue(root.isHidden) || boolTrue(root.disabled)) return true;
    if (Object.prototype.hasOwnProperty.call(root, 'visible') && boolFalse(root.visible)) return true;
    if (Object.prototype.hasOwnProperty.call(root, 'display') && text(root.display).toLowerCase() === 'none') return true;
  }
  const probe = [nodeType(node), text(deepPick(node, [['meta', 'type'], ['meta', 'kind'], ['attr', 'type'], ['attr', 'kind'], ['attr', 'name']]))].join(' ').toLowerCase();
  return /(?:^|[\s_-])(clip(?:path)?|mask|viewport|hitbox|selection|helper|guide|interaction)(?:$|[\s_-])/.test(probe);
}
function hasVisiblePaint(node: unknown): boolean {
  const fill = visualValue(node, ['fill', 'backgroundColor', 'bgColor']);
  const stroke = visualValue(node, ['stroke', 'borderColor', 'outlineColor']);
  const opacity = deepAlpha(node, 'opacity');
  const fillOpacity = deepAlpha(node, 'fill');
  const strokeOpacity = deepAlpha(node, 'stroke');
  return (fill != null && !transparentColor(fill) && (fillOpacity == null || fillOpacity > 0) && (opacity == null || opacity > 0)) ||
    (stroke != null && !transparentColor(stroke) && (strokeOpacity == null || strokeOpacity > 0) && (opacity == null || opacity > 0));
}
function strictNodeAllowed(node: unknown): boolean {
  const type = nodeType(node);
  if (!ALLOWED_V2.has(type)) return false;
  if (['circle', 'ellipse', 'rect', 'rectangle', 'square', 'polygon', 'cone', 'wedge', 'sector'].includes(type)) return hasVisiblePaint(node) || !!objectLabel(node);
  if (type === 'line' || type === 'path') return hasVisiblePaint(node) || /drawn|arrow/i.test(text(visualValue(node, ['endType'])));
  if (['icon', 'ability', 'spell', 'status', 'effect', 'aura', 'sticker', 'encountericon', 'encounter_icon', 'encounter-icon', 'tooltip'].includes(type)) return !!text(visualValue(node, ['asset', 'assetUrl']));
  return true;
}

function flattenItems(step: RaidPlanStep): unknown[] {
  if (step.__raidplanV2) return asArray(step.nodes).filter(node => nodeType(node) !== 'arena');
  const output: unknown[] = [];
  const seen = new WeakSet<object>();
  const visit = (value: unknown, depth = 0) => {
    if (!isObject(value) || seen.has(value) || depth > 7) return;
    seen.add(value);
    let foundChild = false;
    for (const key of ITEM_KEYS) {
      const children = value[key];
      if (Array.isArray(children) || isObject(children)) {
        foundChild = true;
        for (const child of asArray(children)) visit(child, depth + 1);
      }
    }
    const position = readXY(value);
    const hasPosition = position.x != null && position.y != null;
    const hasType = !!nodeType(value);
    const hasText = !!objectLabel(value);
    if (value !== step && (hasPosition || hasType || hasText) && (!foundChild || hasPosition || hasType)) output.push(value);
  };
  let hadRoot = false;
  for (const key of ITEM_KEYS) if (Array.isArray(step[key]) || isObject(step[key])) {
    hadRoot = true;
    for (const child of asArray(step[key])) visit(child);
  }
  if (!hadRoot) for (const child of Object.values(step)) visit(child);
  return output;
}

function canvasSize(step: RaidPlanStep, plan: UnknownRecord): { w: number; h: number } {
  if (step.__raidplanV2) {
    const arena = asArray(step.nodes).find(node => nodeType(node) === 'arena');
    const explicitW = finite(deepPick(arena, [['meta', 'canvas', 'w'], ['meta', 'canvas', 'width'], ['attr', 'canvasWidth'], ['attr', 'canvas', 'width']]));
    const explicitH = finite(deepPick(arena, [['meta', 'canvas', 'h'], ['meta', 'canvas', 'height'], ['attr', 'canvasHeight'], ['attr', 'canvas', 'height']]));
    if (explicitW && explicitH) return { w: explicitW, h: explicitH };
    const arenaW = finite(deepPick(arena, [['meta', 'size', 'w']]));
    const arenaH = finite(deepPick(arena, [['meta', 'size', 'h']]));
    if (arenaW && arenaH) {
      const ratio = arenaW / arenaH;
      if (ratio >= 1.45 && ratio <= 2.05) return { w: arenaW, h: arenaH };
    }
    return { w: 1200, h: 675 };
  }
  const w = finite(deepPick(step, [['canvasWidth'], ['width'], ['canvas', 'width'], ['background', 'width']])) ?? finite(deepPick(plan, [['canvasWidth'], ['width'], ['canvas', 'width'], ['background', 'width']])) ?? 1200;
  const h = finite(deepPick(step, [['canvasHeight'], ['height'], ['canvas', 'height'], ['background', 'height']])) ?? finite(deepPick(plan, [['canvasHeight'], ['height'], ['canvas', 'height'], ['background', 'height']])) ?? 675;
  return { w, h };
}
function coordinateTransform(items: unknown[], step: RaidPlanStep, plan: UnknownRecord): Transform {
  const canvas = canvasSize(step, plan);
  if (step.__raidplanV2) {
    const scaleX = 100 / canvas.w;
    const scaleY = 100 / canvas.h;
    return { mode: 'raidplan-v2-canvas', canvas, scaleX, scaleY, map: (x, y) => ({ x: x * scaleX, y: y * scaleY }) };
  }
  const points = items.map(readXY).filter((point): point is { x: number; y: number } => point.x != null && point.y != null);
  if (points.length && points.every(point => point.x >= -.05 && point.x <= 1.05 && point.y >= -.05 && point.y <= 1.05)) return { mode: 'unit', canvas, scaleX: 100, scaleY: 100, map: (x, y) => ({ x: x * 100, y: y * 100 }) };
  if (points.length && points.every(point => point.x >= -2 && point.x <= 102 && point.y >= -2 && point.y <= 102)) return { mode: 'percent', canvas, scaleX: 1, scaleY: 1, map: (x, y) => ({ x, y }) };
  const scaleX = 100 / canvas.w;
  const scaleY = 100 / canvas.h;
  return { mode: 'canvas', canvas, scaleX, scaleY, map: (x, y) => ({ x: x * scaleX, y: y * scaleY }) };
}
function nativeSize(node: unknown, transform: Transform): { w: number | null; h: number | null } {
  const isText = nodeType(node) === 'itext';
  const w = finite(deepPick(node, isText
    ? [['attr', 'width'], ['attr', 'w'], ['meta', 'size', 'w'], ['width'], ['w']]
    : [['meta', 'size', 'w'], ['meta', 'size', 'width'], ['attr', 'width'], ['attr', 'w'], ['width'], ['w']]));
  const h = finite(deepPick(node, isText
    ? [['attr', 'height'], ['attr', 'h'], ['meta', 'size', 'h'], ['height'], ['h']]
    : [['meta', 'size', 'h'], ['meta', 'size', 'height'], ['attr', 'height'], ['attr', 'h'], ['height'], ['h']]));
  const scale = nativeScale(node);
  return {
    w: w != null ? Math.max(.02, Math.abs(w * scale.sx * transform.scaleX)) : null,
    h: h != null ? Math.max(.02, Math.abs(h * scale.sy * transform.scaleY)) : null
  };
}
function pointFor(node: unknown, transform: Transform, preserveOffCanvas = false): Point | null {
  const raw = readXY(node);
  if (raw.x == null || raw.y == null) return null;
  const point = transform.map(raw.x, raw.y);
  if (preserveOffCanvas) return point;
  return { x: clamp(point.x, .5, 99.5), y: clamp(point.y, .5, 99.5) };
}
function pointsOf(node: unknown): Point[] {
  const raw = deepPick(node, [['attr', 'points'], ['points'], ['vertices']]);
  if (!Array.isArray(raw)) return [];
  if (raw.length >= 4 && raw.every(value => finite(value) != null)) {
    const output: Point[] = [];
    for (let index = 0; index + 1 < raw.length; index += 2) output.push({ x: Number(raw[index]), y: Number(raw[index + 1]) });
    return output;
  }
  return raw.map(value => Array.isArray(value) ? { x: finite(value[0]), y: finite(value[1]) } : readXY(value)).filter((point): point is { x: number; y: number } => point.x != null && point.y != null);
}
function degeneratePath(node: unknown): boolean {
  const points = pointsOf(node);
  if (!points.length) return false;
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  return Math.max(...xs) - Math.min(...xs) < .01 && Math.max(...ys) - Math.min(...ys) < .01;
}
function mapLocalPointsIntoBox(node: unknown, transform: Transform): Point[] {
  const points = pointsOf(node);
  if (points.length < 2) return [];
  const position = pointFor(node, transform, true);
  const size = nativeSize(node, transform);
  if (!position || size.w == null || size.h == null) return points.map(point => transform.map(point.x, point.y));
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const rawW = Math.max(.0001, maxX - minX), rawH = Math.max(.0001, maxY - minY);
  const originX = text(deepPick(node, [['meta', 'origin', 'x']])).toLowerCase();
  const originY = text(deepPick(node, [['meta', 'origin', 'y']])).toLowerCase();
  const width = size.w;
  const height = size.h;
  const left = originX === 'left' ? position.x : originX === 'right' ? position.x - width : position.x - width / 2;
  const top = originY === 'top' ? position.y : originY === 'bottom' ? position.y - height : position.y - height / 2;
  return points.map(point => ({ x: left + ((point.x - minX) / rawW) * width, y: top + ((point.y - minY) / rawH) * height }));
}
function absoluteFabricLinePoints(node: unknown): boolean {
  const points = pointsOf(node);
  if (points.length < 2) return false;
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const rawW = maxX - minX, rawH = maxY - minY;
  const strokeWidth = Math.max(0, finite(deepPick(node, [['attr', 'strokeWidth']])) ?? 0);
  const mx = finite(deepPick(node, [['meta', 'pos', 'x']]));
  const my = finite(deepPick(node, [['meta', 'pos', 'y']]));
  const mw = finite(deepPick(node, [['meta', 'size', 'w']]));
  const mh = finite(deepPick(node, [['meta', 'size', 'h']]));
  if ([mx, my, mw, mh].some(value => value == null)) return false;
  const positionTolerance = Math.max(1, strokeWidth * .35);
  const sizeToleranceX = Math.max(1, rawW * .015);
  const sizeToleranceY = Math.max(1, rawH * .015);
  return Math.abs(mx! - (minX - strokeWidth / 2)) <= positionTolerance && Math.abs(my! - (minY - strokeWidth / 2)) <= positionTolerance && Math.abs(mw! - rawW) <= sizeToleranceX && Math.abs(mh! - rawH) <= sizeToleranceY;
}

function arenaNode(step: RaidPlanStep): unknown | null { return step.__raidplanV2 ? asArray(step.nodes).find(node => nodeType(node) === 'arena') ?? null : null; }
function arenaShapeKind(arena: unknown): 'circle' | 'ellipse' | 'rect' | '' {
  const probe = ['shape', 'arenaShape', 'kind', 'variant', 'geometry', 'mask', 'clipShape'].map(key => text(visualValue(arena, [key]))).join(' ').toLowerCase();
  if (/circle|round/.test(probe)) return 'circle';
  if (/ellipse|oval/.test(probe)) return 'ellipse';
  if (/rect|square|box/.test(probe)) return 'rect';
  return '';
}
function raidPlanBackground(step: RaidPlanStep): string {
  const arena = arenaNode(step);
  const attr = isObject(arena) && isObject(arena.attr) ? arena.attr : {};
  if (attr.imageUrl) return cdnAsset(attr.imageUrl);
  const raid = text(attr.raid).replace('.midnight.', '.');
  const boss = text(attr.boss);
  const map = text(attr.map).trim();
  const mode = `${text(attr.backgroundType)} ${text(attr.backgroundMode)} ${text(attr.mode)}`.trim().toLowerCase();
  if (/^(?:none|blank|transparent|custom|empty|off)$/i.test(map) || /(?:^|[-_ ])(?:none|blank|custom|empty)(?:$|[-_ ])/.test(mode)) return '';
  if (raid && boss) return `https://cdn.raidplan.io/raid/${raid}/map/${boss}${map && map !== 'default' ? `-${map}` : ''}.jpg`;
  return '';
}
function suppressBackdropFill(node: unknown, w: number, h: number, label: string): boolean {
  if (label || deepAlpha(node, 'fill') != null) return false;
  const fill = visualValue(node, ['fill', 'backgroundColor', 'bgColor']);
  if (!nearWhiteColor(fill) || w < 58 || h < 58) return false;
  if (/danger|damage|safe|soak|stack|aoe|mechanic/.test(typeString(node))) return false;
  const stroke = visualValue(node, ['stroke', 'borderColor']);
  return transparentColor(stroke) || !text(stroke).trim();
}

function tokenId(sceneIndex: number, node: unknown, order: number): string {
  const nid = clean(deepPick(node, [['attr', 'nid'], ['nid'], ['id']])) || String(order + 1);
  return `rp-${sceneIndex + 1}-${nid}`;
}
function effectId(sceneIndex: number, node: unknown, order: number): string {
  const nid = clean(deepPick(node, [['attr', 'nid'], ['nid'], ['id']])) || String(order + 1);
  return `rpfx-${sceneIndex + 1}-${nid}`;
}
function roleAsset(role: string): string { return `assets/palette/roles/${role}.png`; }
function markerAsset(key: string): string { return `assets/palette/markers/${key}.png`; }
function sourceZ(node: unknown, sourceOrder: number): number {
  return finite(deepPick(node, [['meta','zIndex'], ['meta','z'], ['attr','zIndex'], ['zIndex'], ['z']])) ?? sourceOrder;
}
function hasMetaCenterPosition(node: unknown): boolean {
  return finite(deepPick(node, [['meta','pos','x']])) != null && finite(deepPick(node, [['meta','pos','y']])) != null;
}

function baseTokenMeta(node: unknown, transform: Transform, sourceOrder: number): Record<string, unknown> {
  const size = nativeSize(node, transform);
  const fontSize = finite(deepPick(node, [['attr', 'fontSize']]));
  const { sx, sy } = nativeScale(node);
  const originX = text(deepPick(node, [['attr','originX'], ['meta','origin','x'], ['originX']]) || 'center').toLowerCase();
  const originY = text(deepPick(node, [['attr','originY'], ['meta','origin','y'], ['originY']]) || 'center').toLowerCase();
  return {
    kind: 'raidplan', source: 'RaidPlan', sourceType: nodeType(node), sourceOrder, z: sourceZ(node, sourceOrder),
    w: size.w, h: size.h, angle: readRotation(node), opacity: deepAlpha(node, 'opacity'),
    fontSizePct: fontSize != null ? fontSize * (Math.abs(sy) || Math.abs(sx) || 1) * transform.scaleX : null,
    fontFamily: text(deepPick(node, [['attr','fontFamily']]) || ''),
    fontWeight: deepPick(node, [['attr','fontWeight']]) ?? null,
    lineHeight: finite(deepPick(node, [['attr','lineHeight']])),
    charSpacing: finite(deepPick(node, [['attr','charSpacing']])),
    originX, originY,
    positionMode: hasMetaCenterPosition(node) ? 'raidplan-meta-center' : 'fabric-origin'
  };
}
function effectStyle(node: unknown, transform: Transform, fillOverride?: string): SceneEffect['style'] {
  const strokeWidth = finite(visualValue(node, ['strokeWidth', 'borderWidth', 'outlineWidth']));
  return {
    stroke: text(visualValue(node, ['stroke', 'borderColor', 'outlineColor']) || 'transparent'),
    fill: fillOverride ?? text(visualValue(node, ['fill', 'backgroundColor', 'bgColor']) || 'transparent'),
    strokeWidth: strokeWidth != null ? Math.max(.08, strokeWidth * transform.scaleX) : undefined,
    opacity: deepAlpha(node, 'opacity') ?? undefined,
    fillOpacity: deepAlpha(node, 'fill') ?? undefined,
    strokeOpacity: deepAlpha(node, 'stroke') ?? undefined,
    lineCap: text(visualValue(node, ['strokeLineCap', 'lineCap']) || 'round'),
    lineJoin: text(visualValue(node, ['strokeLineJoin', 'lineJoin']) || 'round')
  };
}

function buildTextToken(node: unknown, transform: Transform, sceneIndex: number, order: number): SceneToken | null {
  const point = pointFor(node, transform);
  if (!point) return null;
  const label = preserveText(deepPick(node, [['attr', 'text']]) || objectLabel(node));
  if (!label) return null;
  return {
    id: tokenId(sceneIndex, node, order), label, type: 'text', x: round(point.x), y: round(point.y),
    meta: {
      ...baseTokenMeta(node, transform, order), subtype: 'text', text: label,
      fill: text(deepPick(node, [['attr', 'fill']]) || '#ffffff'),
      backgroundColor: deepPick(node, [['attr', 'backgroundColor']]) || null,
      textAlign: text(deepPick(node, [['attr', 'textAlign']]) || 'left'),
      verticalAlign: text(deepPick(node, [['attr', 'verticalAlign']]) || 'top'),
      styles: deepPick(node, [['attr','styles']]) || null,
      hideLabel: true
    }
  };
}
function buildRoleToken(node: unknown, role: 'tank' | 'healer' | 'melee' | 'ranged', transform: Transform, sceneIndex: number, order: number): SceneToken | null {
  const point = pointFor(node, transform);
  if (!point) return null;
  const label = objectLabel(node) || ({ tank: 'Танк', healer: 'Хилер', melee: 'Мили', ranged: 'РДД' }[role]);
  return {
    id: tokenId(sceneIndex, node, order), label, type: role, x: round(point.x), y: round(point.y),
    meta: { ...baseTokenMeta(node, transform, order), kind: 'role', role: role === 'tank' || role === 'healer' ? role : 'dps', range: role === 'melee' ? 'melee' : 'ranged', sourceAsset: text(deepPick(node, [['attr','asset']])), asset: cdnAsset(deepPick(node, [['attr','asset']])) || roleAsset(role), fallbackAsset: roleAsset(role), hideLabel: !objectLabel(node) }
  };
}
function buildMarkerToken(node: unknown, key: string, transform: Transform, sceneIndex: number, order: number): SceneToken | null {
  const point = pointFor(node, transform);
  if (!point) return null;
  return { id: tokenId(sceneIndex, node, order), label: MARKER_LABEL[key] || key, type: 'marker', x: round(point.x), y: round(point.y), meta: { ...baseTokenMeta(node, transform, order), kind: 'marker', markerKey: key, sourceAsset: text(deepPick(node, [['attr','asset']])), asset: cdnAsset(deepPick(node, [['attr','asset']])) || markerAsset(key), fallbackAsset: markerAsset(key), hideLabel: true } };
}
function buildMobToken(node: unknown, transform: Transform, sceneIndex: number, order: number, bossId: BossId): SceneToken | null {
  const point = pointFor(node, transform);
  if (!point) return null;
  const displayId = text(deepPick(node, [['attr', 'displayId']]));
  const visibleLabel = preserveText(deepPick(node, [['attr', 'text']]));
  const label = visibleLabel || preserveText(deepPick(node, [['attr', 'lname']]) || objectLabel(node)) || 'Существо';
  const isBoss = BOSS_ALIASES[bossId].some(alias => label.toLowerCase().includes(alias.toLowerCase())) || (bossId === 'nekzali' && displayId === '142077');
  return {
    id: tokenId(sceneIndex, node, order), label, type: isBoss ? 'boss' : 'encounter', x: round(point.x), y: round(point.y),
    meta: {
      ...baseTokenMeta(node, transform, order), kind: 'raidplan-mob', displayId,
      asset: displayId ? `https://cdn.raidplan.io/wow/portrait/${displayId}.png` : undefined,
      ringColor: text(deepPick(node, [['attr', 'ringColor']]) || '#d7180b'),
      ringSize: finite(deepPick(node, [['attr', 'ringSize']])),
      ringOffset: finite(deepPick(node, [['attr', 'ringOffset']])),
      face: deepPick(node, [['meta', 'face'], ['attr', 'face']]) ?? null,
      noDir: boolTrue(deepPick(node, [['attr', 'noDir']])),
      hideLabel: !visibleLabel
    }
  };
}
function buildIconToken(node: unknown, transform: Transform, sceneIndex: number, order: number): SceneToken | null {
  const point = pointFor(node, transform);
  const asset = text(visualValue(node, ['asset', 'assetUrl']));
  if (!point || !asset) return null;
  const label = objectLabel(node) || preserveText(deepPick(node, [['attr', 'lname']])) || 'Иконка';
  return { id: tokenId(sceneIndex, node, order), label, type: 'mechanic', x: round(point.x), y: round(point.y), meta: { ...baseTokenMeta(node, transform, order), kind: 'raidplan-icon', asset: cdnAsset(asset), hideLabel: !objectLabel(node) } };
}
function buildPlayerToken(node: unknown, transform: Transform, sceneIndex: number, order: number): SceneToken | null {
  const point = pointFor(node, transform);
  if (!point) return null;
  const role = roleType(node) || 'ranged';
  const label = objectLabel(node) || 'Игрок';
  return { id: tokenId(sceneIndex, node, order), label, type: role, x: round(point.x), y: round(point.y), meta: { ...baseTokenMeta(node, transform, order), kind: 'raidplan-player', role: role === 'tank' || role === 'healer' ? role : 'dps', range: role === 'melee' ? 'melee' : 'ranged' } };
}

function buildPathEffect(node: unknown, transform: Transform, sceneIndex: number, order: number): SceneEffect | null {
  const mapped = mapLocalPointsIntoBox(node, transform);
  if (mapped.length < 2) return null;
  const xs = mapped.map(point => point.x), ys = mapped.map(point => point.y);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2;
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    id: effectId(sceneIndex, node, order), type: 'path', x: round(x), y: round(y), w: round(Math.max(.08, Math.max(...xs) - Math.min(...xs))), h: round(Math.max(.08, Math.max(...ys) - Math.min(...ys))), rot: round(readRotation(node)), label: '',
    points: mapped.map(point => ({ x: round(point.x), y: round(point.y) })),
    style: effectStyle(node, transform, 'none'), meta: { source: 'RaidPlan', sourceType: 'path', sourceOrder: order, z: sourceZ(node, order) }
  };
}
function buildLineEffect(node: unknown, transform: Transform, sceneIndex: number, order: number): SceneEffect | null {
  const rawPoints = pointsOf(node);
  let mapped: Point[] = [];
  if (rawPoints.length >= 2 && absoluteFabricLinePoints(node)) mapped = rawPoints.map(point => transform.map(point.x, point.y));
  else if (rawPoints.length >= 2) mapped = mapLocalPointsIntoBox(node, transform);
  if (mapped.length < 2) {
    const x1 = finite(deepPick(node, [['x1'], ['startX'], ['fromX'], ['attr', 'x1'], ['attr', 'startX'], ['attr', 'fromX']]));
    const y1 = finite(deepPick(node, [['y1'], ['startY'], ['fromY'], ['attr', 'y1'], ['attr', 'startY'], ['attr', 'fromY']]));
    const x2 = finite(deepPick(node, [['x2'], ['endX'], ['toX'], ['attr', 'x2'], ['attr', 'endX'], ['attr', 'toX']]));
    const y2 = finite(deepPick(node, [['y2'], ['endY'], ['toY'], ['attr', 'y2'], ['attr', 'endY'], ['attr', 'toY']]));
    if ([x1, y1, x2, y2].every(value => value != null)) mapped = [transform.map(x1!, y1!), transform.map(x2!, y2!)];
  }
  if (mapped.length < 2) return null;
  const xs = mapped.map(point => point.x), ys = mapped.map(point => point.y);
  const type = /drawn|arrow/i.test(text(visualValue(node, ['endType']))) ? 'arrow' : 'line';
  return {
    id: effectId(sceneIndex, node, order), type, x: round((Math.min(...xs) + Math.max(...xs)) / 2), y: round((Math.min(...ys) + Math.max(...ys)) / 2), w: round(Math.max(.08, Math.max(...xs) - Math.min(...xs))), h: round(Math.max(.08, Math.max(...ys) - Math.min(...ys))), rot: round(readRotation(node)), label: '',
    points: mapped.map(point => ({ x: round(point.x), y: round(point.y) })), style: effectStyle(node, transform, 'none'), meta: { source: 'RaidPlan', sourceType: 'line', sourceOrder: order, z: sourceZ(node, order), startType: text(visualValue(node, ['startType']) || 'none'), endType: text(visualValue(node, ['endType']) || 'none'), absoluteFabricPoints: absoluteFabricLinePoints(node) }
  };
}
function buildShapeEffect(node: unknown, transform: Transform, sceneIndex: number, order: number): SceneEffect | null {
  const point = pointFor(node, transform);
  if (!point) return null;
  const type = nodeType(node);
  const size = nativeSize(node, transform);
  const rawRadius = finite(visualValue(node, ['radius', 'r']));
  let w = size.w ?? (rawRadius != null ? rawRadius * 2 * transform.scaleX : 12);
  let h = size.h ?? (rawRadius != null ? rawRadius * 2 * transform.scaleY : 12);
  w = Math.max(.08, Math.abs(w)); h = Math.max(.08, Math.abs(h));
  const label = objectLabel(node);
  const suppressFill = suppressBackdropFill(node, w, h, label);
  const rawPoints = type === 'polygon' ? pointsOf(node) : [];
  const points = rawPoints.length >= 3 ? mapLocalPointsIntoBox(node, transform) : undefined;
  const shape = type === 'circle' ? 'circle' : type === 'ellipse' ? 'ellipse' : ['rect', 'rectangle', 'square'].includes(type) ? 'rect' : type === 'polygon' ? 'polygon' : ['cone', 'wedge', 'sector'].includes(type) ? 'cone' : 'ellipse';
  return {
    id: effectId(sceneIndex, node, order), type: shape === 'cone' ? 'cone' : 'zone', x: round(point.x), y: round(point.y), w: round(w), h: round(h), rot: round(readRotation(node)), label,
    points: points?.map(p => ({ x: round(p.x), y: round(p.y) })), shape,
    style: effectStyle(node, transform, suppressFill ? 'transparent' : undefined),
    meta: { source: 'RaidPlan', sourceType: type, sourceOrder: order, z: sourceZ(node, order), suppressedBackdropFill: suppressFill }
  };
}
function buildArenaEffect(step: RaidPlanStep, transform: Transform, sceneIndex: number): SceneEffect | null {
  const arena = arenaNode(step);
  if (!arena || hiddenNode(arena) || raidPlanBackground(step)) return null;
  const shape = arenaShapeKind(arena);
  if (!shape || !hasVisiblePaint(arena)) return null;
  const point = pointFor(arena, transform) ?? { x: 50, y: 50 };
  const size = nativeSize(arena, transform);
  if (size.w == null || size.h == null) return null;
  return { id: `rpfx-${sceneIndex + 1}-arena`, type: 'zone', x: round(point.x), y: round(point.y), w: round(size.w), h: round(size.h), rot: round(readRotation(arena)), label: '', shape, style: effectStyle(arena, transform), meta: { source: 'RaidPlan', sourceType: 'arena', sourceOrder: -100, arenaVisual: true } };
}

function stepName(step: RaidPlanStep, index: number): string {
  const explicit = clean(first(step, ['name', 'title', 'label', 'header']));
  if (explicit) return explicit;
  if (step.__raidplanV2) {
    const headings = asArray(step.nodes)
      .filter(node => nodeType(node) === 'itext' && objectLabel(node))
      .sort((a, b) => (finite(deepPick(a, [['meta', 'pos', 'y']])) ?? 9999) - (finite(deepPick(b, [['meta', 'pos', 'y']])) ?? 9999));
    const heading = headings.map(node => preserveText(deepPick(node, [['attr', 'text']])).split(/\r?\n/)[0]?.trim()).find(Boolean);
    if (heading) return heading.length > 64 ? `${heading.slice(0, 61)}…` : heading;
  }
  return `RaidPlan · сцена ${index + 1}`;
}
function stepNote(plan: UnknownRecord, index: number): string {
  const notes = Array.isArray(plan.step_notes_raw) ? plan.step_notes_raw : [];
  return preserveText(notes[index] || '');
}

function convertNode(node: unknown, context: { transform: Transform; bossId: BossId; sceneIndex: number; order: number; strictV2: boolean; report: RaidPlanImportReport }): { token?: SceneToken; effect?: SceneEffect } | null {
  const { transform, bossId, sceneIndex, order, strictV2, report } = context;
  const type = nodeType(node);
  if (type === 'arena') return null;
  if (hiddenNode(node)) { report.hidden++; return null; }
  if (type === 'path' && degeneratePath(node)) { report.hidden++; report.degeneratePaths++; return null; }
  if (strictV2 && !strictNodeAllowed(node)) { report.skipped++; report.unsupported.push(type || 'unknown'); return null; }

  if (type === 'itext') {
    const token = buildTextToken(node, transform, sceneIndex, order);
    if (!token) { report.skipped++; return null; }
    report.tokens++; report.text++; return { token };
  }
  if (type === 'marker') {
    const role = roleType(node);
    if (role) {
      const token = buildRoleToken(node, role, transform, sceneIndex, order);
      if (token) { report.tokens++; return { token }; }
    }
    const key = markerKey(node);
    if (key) {
      const token = buildMarkerToken(node, key, transform, sceneIndex, order);
      if (token) { report.tokens++; return { token }; }
    }
  }
  if (type === 'mob') {
    const token = buildMobToken(node, transform, sceneIndex, order, bossId);
    if (token) { report.tokens++; return { token }; }
  }
  if (['player', 'character', 'member', 'assignment', 'slot', 'role', 'class', 'job'].includes(type) || roleType(node)) {
    const token = buildPlayerToken(node, transform, sceneIndex, order);
    if (token) { report.tokens++; return { token }; }
  }
  if (type === 'path') {
    const effect = buildPathEffect(node, transform, sceneIndex, order);
    if (effect) { report.effects++; report.nativePaths++; if (effect.points?.some(point => point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100)) report.offCanvasVectors++; return { effect }; }
  }
  if (type === 'line') {
    const effect = buildLineEffect(node, transform, sceneIndex, order);
    if (effect) { report.effects++; if (effect.points?.some(point => point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100)) report.offCanvasVectors++; return { effect }; }
  }
  if (['circle', 'ellipse', 'rect', 'rectangle', 'square', 'polygon', 'cone', 'wedge', 'sector'].includes(type)) {
    const effect = buildShapeEffect(node, transform, sceneIndex, order);
    if (effect) { report.effects++; if (effect.meta?.suppressedBackdropFill) report.suppressedBackdropFills++; return { effect }; }
  }
  if (['icon', 'ability', 'spell', 'status', 'effect', 'aura', 'sticker', 'encountericon', 'encounter_icon', 'encounter-icon', 'tooltip'].includes(type)) {
    const token = buildIconToken(node, transform, sceneIndex, order);
    if (token) { report.tokens++; return { token }; }
  }

  // Legacy payload fallback stays deliberately narrow. Unknown nodes never become zones.
  if (!strictV2) {
    const s = typeString(node);
    if (/text|label|note|annotation|caption/.test(s)) {
      const token = buildTextToken(node, transform, sceneIndex, order);
      if (token) { report.tokens++; report.text++; return { token }; }
    }
  }
  report.skipped++; report.unsupported.push(type || 'unknown'); return null;
}

export function convertRaidPlan(raw: unknown, options: RaidPlanConvertOptions = {}): RaidPlanImportResult {
  const root = findRaidPlanRoot(raw);
  if (!root) return { ok: false, warnings: [], error: 'В данных не найден план RaidPlan.' };
  const steps = findSteps(root);
  if (!steps.length) return { ok: false, warnings: [], error: 'В данных RaidPlan не найдены сцены.' };
  const bossId = bossFromRaw(root) || bossFromRaw(raw) || options.currentBoss || 'nekzali';
  const sourceCode = clean(root.code) || raidPlanCode(options.sourceUrl || '');
  const sourceRevision = finite(root.revision);
  const report: RaidPlanImportReport = {
    adapterVersion: RAIDPLAN_ADAPTER_VERSION,
    sourceVersion: finite(root.version), revision: finite(root.revision), bossId, scenes: steps.length, nodes: 0,
    tokens: 0, effects: 0, text: 0, hidden: 0, skipped: 0, unsupported: [], degeneratePaths: 0, nativePaths: 0,
    offCanvasVectors: 0, suppressedArenaVisuals: 0, suppressedBackdropFills: 0, coordinateModes: {}
  };
  const scenes: Scene[] = steps.map((step, sceneIndex) => {
    const items = flattenItems(step);
    report.nodes += items.length;
    const transform = coordinateTransform(items, step, root);
    report.coordinateModes[transform.mode] = (report.coordinateModes[transform.mode] || 0) + 1;
    const backgroundUrl = raidPlanBackground(step);
    const scene: Scene = {
      id: `raidplan-${clean(root.code) || 'import'}-scene-${sceneIndex + 1}`,
      name: stepName(step, sceneIndex), note: stepNote(root, sceneIndex), duration: 8,
      map: { zoom: 100, x: 0, y: 0, dark: 0, backgroundUrl: backgroundUrl || undefined, sourceWidth: transform.canvas.w, sourceHeight: transform.canvas.h, source: 'raidplan', raidPlan: { sourceCode, sourceUrl: options.sourceUrl || (sourceCode ? `https://raidplan.io/plan/${sourceCode}` : ''), revision: sourceRevision, sceneIndex: sceneIndex + 1 } },
      tokens: [], effects: [], routes: []
    };
    const arena = buildArenaEffect(step, transform, sceneIndex);
    if (arena) { scene.effects.push(arena); report.effects++; } else if (arenaNode(step) && backgroundUrl) report.suppressedArenaVisuals++;
    items.forEach((node, order) => {
      const converted = convertNode(node, { transform, bossId, sceneIndex, order, strictV2: !!step.__raidplanV2, report });
      if (converted?.token) scene.tokens.push(converted.token);
      if (converted?.effect) scene.effects.push(converted.effect);
    });
    const textSeen: SceneToken[] = [];
    scene.tokens = scene.tokens.filter(token => {
      if (token.type !== 'text') return true;
      const normalized = preserveText(token.meta?.text || token.label).replace(/\s+/g,' ').trim().toLowerCase();
      const duplicate = textSeen.some(prev => preserveText(prev.meta?.text || prev.label).replace(/\s+/g,' ').trim().toLowerCase() === normalized && Math.hypot(prev.x-token.x, prev.y-token.y) < .6);
      if (duplicate) { report.hidden++; report.tokens = Math.max(0, report.tokens - 1); report.text = Math.max(0, report.text - 1); return false; }
      textSeen.push(token); return true;
    });
    return scene;
  });
  report.unsupported = [...new Set(report.unsupported.filter(Boolean))].slice(0, 30);
  const warnings: string[] = [];
  if (report.unsupported.length) warnings.push(`Пропущены неподдерживаемые типы: ${report.unsupported.join(', ')}`);
  if (report.skipped) warnings.push(`Пропущено объектов: ${report.skipped}. Strict visible import не рисует неизвестные служебные nodes.`);
  if (report.suppressedBackdropFills) warnings.push(`Подавлено больших фоновых заливок: ${report.suppressedBackdropFills}.`);
  return {
    ok: true,
    bossId,
    planName: clean(first(root, ['name', 'title', 'planName'])) || (sourceCode ? `RaidPlan ${sourceCode}` : 'RaidPlan import'),
    sourceCode,
    sourceRevision,
    plan: { scenes, timeline: [] },
    warnings,
    report
  };
}
