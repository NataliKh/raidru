import { raidPlanCode } from '@raidru/raidplan-core';

const DEFAULT_RAIDPLAN_API = 'https://raidru-raidplan.raidru-wcl.workers.dev/raidplan';

type RaidruWindow = Window & { RAIDRU_RAIDPLAN_API?: string };

export function raidPlanApiEndpoint(): string {
  if (typeof window === 'undefined') return DEFAULT_RAIDPLAN_API;
  return (window as RaidruWindow).RAIDRU_RAIDPLAN_API || DEFAULT_RAIDPLAN_API;
}

export async function fetchRaidPlan(input: string, signal?: AbortSignal): Promise<unknown> {
  const code = raidPlanCode(input);
  if (!code) throw new Error('Вставь ссылку вида raidplan.io/plan/… или код плана.');
  const endpoint = new URL(raidPlanApiEndpoint());
  endpoint.searchParams.set('code', code);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Не удалось связаться с сервисом импорта RaidPlan.');
  }
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const serverError = body && typeof body === 'object' && 'error' in body ? String((body as { error?: unknown }).error || '') : '';
    if (response.status === 404) throw new Error('План RaidPlan не найден или больше недоступен.');
    if (response.status === 403) throw new Error('Сервис RaidPlan отклонил запрос. Проверь публикацию Worker.');
    throw new Error(serverError ? `RaidPlan: ${serverError}` : `RaidPlan вернул HTTP ${response.status}.`);
  }
  if (!body) throw new Error('RaidPlan вернул пустой или некорректный JSON.');
  return body;
}
