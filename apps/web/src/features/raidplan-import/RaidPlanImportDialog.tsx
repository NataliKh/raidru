import { useEffect, useRef, useState } from 'react';
import type { Difficulty } from '@raidru/shared-types';
import { canonicalRaidPlanUrl, convertRaidPlan, raidPlanCode, type RaidPlanApplyMode, type RaidPlanImportResult } from '@raidru/raidplan-core';
import { appStore, useAppState } from '../../app/store';
import { fetchRaidPlan } from './RaidPlanClient';

type Props = { open: boolean; onClose: () => void };

const difficultyName: Record<Difficulty, string> = { normal: 'Обычный', heroic: 'Героический', mythic: 'Эпохальный' };

function FileButton({ onLoad, disabled }: { onLoad: (raw: unknown, name: string) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <>
    <button type="button" className="raidPlanSecondary" disabled={disabled} onClick={() => inputRef.current?.click()}>Открыть JSON</button>
    <input ref={inputRef} className="srOnly" type="file" accept=".json,application/json" onChange={async event => {
      const file = event.target.files?.[0];
      event.currentTarget.value = '';
      if (!file) return;
      try { onLoad(JSON.parse(await file.text()), file.name); }
      catch { window.alert('Не удалось прочитать JSON-файл RaidPlan.'); }
    }} />
  </>;
}

export function RaidPlanImportDialog({ open, onClose }: Props) {
  const state = useAppState();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<RaidPlanImportResult | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) abortRef.current?.abort();
    return () => abortRef.current?.abort();
  }, [open]);

  if (!open) return null;

  function preview(raw: unknown, label: string, sourceUrl = '') {
    const converted = convertRaidPlan(raw, { currentBoss: state.selectedBossId, sourceUrl });
    setResult(converted);
    setSourceLabel(label);
    setError(converted.ok ? '' : converted.error);
  }

  async function loadUrl() {
    if (!raidPlanCode(input)) { setError('Вставь корректную ссылку RaidPlan или код плана.'); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError(''); setResult(null);
    try {
      const raw = await fetchRaidPlan(input, controller.signal);
      preview(raw, canonicalRaidPlanUrl(input) || input, canonicalRaidPlanUrl(input));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить RaidPlan.');
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }

  function apply(mode: RaidPlanApplyMode) {
    if (!result?.ok) return;
    if (mode === 'replace' && !window.confirm(`Заменить текущий ${difficultyName[state.difficulty].toLowerCase()} план босса импортированными сценами RaidPlan?`)) return;
    appStore.applyExternalPlan(result.bossId, state.difficulty, result.plan, mode);
    onClose();
  }

  const r = result?.ok ? result : null;
  return <div className="modalBackdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="raidPlanDialog" role="dialog" aria-modal="true" aria-labelledby="raidplan-import-title">
      <header>
        <div><small>RAIDPLAN ADAPTER · STRICT VISIBLE IMPORT</small><h3 id="raidplan-import-title">Импорт RaidPlan</h3></div>
        <button className="dialogX" onClick={onClose} aria-label="Закрыть">×</button>
      </header>
      <p className="raidPlanIntro">Импортёр сначала превращает внешний JSON в чистую модель RaidRU. React и DOM в разбор RaidPlan не вмешиваются.</p>
      <div className="raidPlanSourceRow">
        <input value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void loadUrl(); }} placeholder="https://raidplan.io/plan/9v3wssyjja56rttz" autoFocus />
        <button className="raidPlanPrimary" onClick={() => void loadUrl()} disabled={loading}>{loading ? 'Загрузка…' : 'Загрузить'}</button>
        <FileButton disabled={loading} onLoad={(raw, name) => preview(raw, name)} />
      </div>
      {error && <div className="raidPlanError">{error}</div>}
      {!r && !error && <div className="raidPlanEmpty"><strong>Можно импортировать ссылку или raw JSON.</strong><span>По умолчанию безопаснее добавить сцены к текущему плану. Замена требует отдельного подтверждения.</span></div>}
      {r && <>
        <div className="raidPlanPreviewHead"><div><small>ИСТОЧНИК</small><strong>{r.planName}</strong><span>{sourceLabel || r.sourceCode || 'локальный JSON'}{r.sourceRevision != null ? ` · revision ${r.sourceRevision}` : ''}</span></div><div><small>КУДА</small><strong>{r.bossId}</strong><span>{difficultyName[state.difficulty]}</span></div></div>
        <div className="raidPlanStats">
          <span><strong>{r.report.scenes}</strong><small>сцен</small></span>
          <span><strong>{r.report.tokens}</strong><small>токенов</small></span>
          <span><strong>{r.report.effects}</strong><small>векторов / зон</small></span>
          <span><strong>{r.report.hidden + r.report.skipped}</strong><small>отфильтровано</small></span>
          <span><strong>{r.report.nativePaths}</strong><small>freehand path</small></span>
          <span><strong>{r.report.offCanvasVectors}</strong><small>off-canvas</small></span>
        </div>
        <div className="raidPlanTechnical">
          <span>Canvas: {Object.entries(r.report.coordinateModes).map(([key, value]) => `${key} ×${value}`).join(', ') || '—'}</span>
          <span>Map-backed arena скрыто: {r.report.suppressedArenaVisuals}</span>
          <span>Неизвестные: {r.report.unsupported.join(', ') || 'нет'}</span>
        </div>
        {r.warnings.length > 0 && <div className="raidPlanWarnings">{r.warnings.map(warning => <p key={warning}>⚠ {warning}</p>)}</div>}
        <div className="raidPlanScenePreview">{r.plan.scenes.map((scene, index) => <article key={scene.id}><i>{index + 1}</i><span><strong>{scene.name}</strong><small>{scene.tokens.length} токенов · {scene.effects.length} эффектов{scene.map.backgroundUrl ? ' · карта RaidPlan' : ''}</small></span></article>)}</div>
        <footer className="raidPlanActions">
          <button className="raidPlanSecondary" onClick={() => apply('replace')}>Заменить план</button>
          <button className="raidPlanPrimary" onClick={() => apply('append')}>Добавить сцены</button>
        </footer>
      </>}
    </section>
  </div>;
}
