RaidRU v0.8.31 — RaidPlan path fidelity fix

Что исправлено:
- map-backed arena из v0.8.30 по-прежнему не рисуется поверх карты;
- скрытые opacity=0 / scale=0 объекты по-прежнему отбрасываются;
- RaidPlan Path больше не превращается в белый круг/капсулу по bounding box;
- Fabric/SVG path импортируется как настоящий SVG path с исходными stroke/fill/linecap/linejoin;
- renderer marker обновлён до native-v12-svg-path-safe;
- service worker/cache-busting обновлены до 0.8.31.

Заменить в репозитории:
app.js
index.html
raidplan-importer.js
sw.js

После замены:
git add app.js index.html raidplan-importer.js sw.js
git commit -m "Fix RaidPlan freehand paths and arrows"
git push
