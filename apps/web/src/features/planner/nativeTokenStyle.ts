import type { CSSProperties } from 'react';
import type { SceneToken } from '@raidru/shared-types';

/**
 * Number(null) === 0 in JavaScript. That is dangerous for optional visual
 * metadata: RaidPlan marker/mob nodes usually omit opacity, and the adapter
 * intentionally stores that as null. Treat missing metadata as "unset", not 0.
 */
export function optionalFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function nativeTokenStyle(token: SceneToken): CSSProperties {
  const native = token.meta?.source === 'RaidPlan' || token.meta?.kind === 'raidplan';
  const width = optionalFiniteNumber(token.meta?.w);
  const height = optionalFiniteNumber(token.meta?.h);
  const opacity = optionalFiniteNumber(token.meta?.opacity);
  const angle = optionalFiniteNumber(token.meta?.angle);
  const sourceOrder = optionalFiniteNumber(token.meta?.sourceOrder);
  const sourceZ = optionalFiniteNumber(token.meta?.z);

  return {
    left: `${token.x}%`,
    top: `${token.y}%`,
    ...(native && width !== undefined && width > 0 ? { width: `${width}%` } : {}),
    ...(native && height !== undefined && height > 0 ? { height: `${height}%` } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
    transform: `translate(-50%,-50%)${angle ? ` rotate(${angle}deg)` : ''}`,
    ...(native && sourceZ !== undefined
      ? { zIndex: 20 + sourceZ }
      : native && sourceOrder !== undefined
        ? { zIndex: 20 + sourceOrder }
        : {})
  };
}
