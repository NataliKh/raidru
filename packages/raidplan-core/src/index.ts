export interface RaidPlanImportResult<TPlan = unknown> { ok: boolean; plan?: TPlan; warnings: string[]; error?: string }
export function unsupportedRaidPlanImport(): RaidPlanImportResult {
  return { ok: false, warnings: [], error: 'RaidPlan importer is scheduled for RaidRU 3.0 alpha.2.' };
}
