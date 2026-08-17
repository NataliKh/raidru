/** Resolve files from Vite's public/ directory against the configured app base.
 *
 * RaidRU is deployed under /raidru/ on GitHub Pages, while developers often
 * open Vite from /. Relative ./assets URLs therefore depended on the current
 * browser pathname and were the reason palette icons intermittently broke.
 */
export function publicAsset(input: string | undefined | null): string {
  const value = String(input || '').trim();
  if (!value) return '';
  if (/^(?:https?:|data:|blob:|chrome-extension:)/i.test(value)) return value;

  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/');
  let path = value.replace(/^\.\//, '').replace(/^\//, '');
  const basePath = base.replace(/^\//, '').replace(/\/$/, '');
  if (basePath && path.startsWith(`${basePath}/`)) path = path.slice(basePath.length + 1);
  return `${base}${path}`;
}
