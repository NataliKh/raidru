import type { BossDifficultyPlanState, Scene, SceneEffect, SceneRoute, SceneToken } from '@raidru/shared-types';

export function clampPercent(value: number) { return Math.max(0, Math.min(100, value)); }

export function clearMapObjects(plan: BossDifficultyPlanState): BossDifficultyPlanState {
  return { ...structuredClone(plan), scenes: plan.scenes.map(scene => ({ ...structuredClone(scene), tokens: [], effects: [], routes: [] })) };
}

export function mapScene(plan: BossDifficultyPlanState, sceneIndex: number, updater: (scene: Scene) => Scene): BossDifficultyPlanState {
  return { ...plan, scenes: plan.scenes.map((scene, index) => index === sceneIndex ? updater(scene) : scene) };
}

export function updateScene(plan: BossDifficultyPlanState, sceneIndex: number, patch: Partial<Pick<Scene, 'name' | 'note' | 'duration' | 'map'>>): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, ...patch }));
}

export function insertScene(plan: BossDifficultyPlanState, afterIndex: number, scene: Scene) {
  const insertAt = Math.min(plan.scenes.length, Math.max(0, afterIndex + 1));
  return {
    selectedIndex: insertAt,
    plan: {
      scenes: [...plan.scenes.slice(0, insertAt), scene, ...plan.scenes.slice(insertAt)],
      timeline: plan.timeline.map(event => event.sceneIndex >= insertAt ? { ...event, sceneIndex: event.sceneIndex + 1 } : event)
    }
  };
}

export function removeScene(plan: BossDifficultyPlanState, sceneIndex: number) {
  if (plan.scenes.length <= 1) return { selectedIndex: 0, plan };
  const scenes = plan.scenes.filter((_, index) => index !== sceneIndex);
  const timeline = plan.timeline.map(event => ({ ...event, sceneIndex: event.sceneIndex > sceneIndex ? event.sceneIndex - 1 : event.sceneIndex === sceneIndex ? Math.max(0, sceneIndex - 1) : event.sceneIndex }));
  return { selectedIndex: Math.min(Math.max(0, sceneIndex - 1), scenes.length - 1), plan: { scenes, timeline } };
}

export function clearScene(plan: BossDifficultyPlanState, sceneIndex: number): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, tokens: [], effects: [], routes: [] }));
}

export function addToken(plan: BossDifficultyPlanState, sceneIndex: number, token: SceneToken): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, tokens: [...scene.tokens, token] }));
}
export function patchToken(plan: BossDifficultyPlanState, sceneIndex: number, tokenId: string, patch: Partial<SceneToken>): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, tokens: scene.tokens.map(token => token.id === tokenId ? { ...token, ...patch } : token) }));
}
export function moveToken(plan: BossDifficultyPlanState, sceneIndex: number, tokenId: string, x: number, y: number): BossDifficultyPlanState {
  return patchToken(plan, sceneIndex, tokenId, { x: clampPercent(x), y: clampPercent(y) });
}
export function removeToken(plan: BossDifficultyPlanState, sceneIndex: number, tokenId: string): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, tokens: scene.tokens.filter(token => token.id !== tokenId) }));
}

export function addEffect(plan: BossDifficultyPlanState, sceneIndex: number, effect: SceneEffect): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, effects: [...scene.effects, effect] }));
}
export function patchEffect(plan: BossDifficultyPlanState, sceneIndex: number, effectId: string, patch: Partial<SceneEffect>): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, effects: scene.effects.map(effect => effect.id === effectId ? { ...effect, ...patch } : effect) }));
}
export function moveEffect(plan: BossDifficultyPlanState, sceneIndex: number, effectId: string, x: number, y: number): BossDifficultyPlanState {
  return patchEffect(plan, sceneIndex, effectId, { x: clampPercent(x), y: clampPercent(y) });
}
export function removeEffect(plan: BossDifficultyPlanState, sceneIndex: number, effectId: string): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, effects: scene.effects.filter(effect => effect.id !== effectId) }));
}

export function addRoute(plan: BossDifficultyPlanState, sceneIndex: number, route: SceneRoute): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, routes: [...scene.routes, route] }));
}
export function appendRoutePoint(plan: BossDifficultyPlanState, sceneIndex: number, routeId: string, x: number, y: number): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, routes: scene.routes.map(route => route.id === routeId ? { ...route, points: [...route.points, { x: clampPercent(x), y: clampPercent(y) }] } : route) }));
}
export function moveRoutePoint(plan: BossDifficultyPlanState, sceneIndex: number, routeId: string, pointIndex: number, x: number, y: number): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, routes: scene.routes.map(route => route.id !== routeId ? route : { ...route, points: route.points.map((point, index) => index === pointIndex ? { x: clampPercent(x), y: clampPercent(y) } : point) }) }));
}
export function patchRoute(plan: BossDifficultyPlanState, sceneIndex: number, routeId: string, patch: Partial<Pick<SceneRoute, 'name'>>): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, routes: scene.routes.map(route => route.id === routeId ? { ...route, ...patch } : route) }));
}
export function removeRoute(plan: BossDifficultyPlanState, sceneIndex: number, routeId: string): BossDifficultyPlanState {
  return mapScene(plan, sceneIndex, scene => ({ ...scene, routes: scene.routes.filter(route => route.id !== routeId) }));
}
