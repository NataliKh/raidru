export interface RawCombatEvent { timestamp: number; type: string; abilityId?: number; sourceId?: number; targetId?: number }
export interface NormalizedMechanic { timestamp: number; kind: string; abilityId?: number; sourceId?: number; targetId?: number }
export function normalizeCombatEvent(event: RawCombatEvent): NormalizedMechanic {
  return { timestamp: event.timestamp, kind: event.type, abilityId: event.abilityId, sourceId: event.sourceId, targetId: event.targetId };
}
