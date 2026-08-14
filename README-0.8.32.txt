RaidRU v0.8.32 — RaidPlan arrow/path fix

Исправление относительно 0.8.31:
- SVG viewBox для RaidPlan Path больше НЕ строится из Fabric pathOffset/width/height.
- Границы считаются по фактическим координатам M/L/Q/C/S/T/H/V/A/Z команд.
- Добавляется padding под толщину stroke, чтобы белая стрелка не обрезалась.
- Поддерживается attr.path / path / data.path / meta.path и d.
- Renderer marker: native-v13-path-command-bounds.
- Cache busting и service worker: 0.8.32.

Заменить:
app.js
index.html
raidplan-importer.js
sw.js

После замены:
git add app.js index.html raidplan-importer.js sw.js
git commit -m "Fix RaidPlan path command bounds"
git push

README.md в репозитории специально не входит в этот архив: старое "RaidRU v0.8.29"
на странице GitHub — это просто содержимое README.md, а не версия развернутого сайта.
