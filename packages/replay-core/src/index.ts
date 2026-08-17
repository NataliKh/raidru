export interface ReplayActor { id: number | string; name: string; type: string; subType?: string }
export interface ReplayPoint { actorId: number | string; time: number; x: number; y: number; mapId?: number }
export interface ReplayModel { fightId: number | string; durationMs: number; actors: ReplayActor[]; points: ReplayPoint[] }

export function validateReplay(replay: ReplayModel): string[] {
  const errors: string[] = [];
  if (!replay.actors.length) errors.push('Replay does not contain actors');
  if (!replay.points.length) errors.push('Replay does not contain coordinate points');
  if (!(replay.durationMs > 0)) errors.push('Replay duration must be positive');
  return errors;
}
