# RaidRU 0.9.5 — Raid Workspace

Крупный релиз, который переводит RaidRU от одной текущей карты к библиотеке полноценных рейдовых планов.

## Главное

- **Мои планы** — несколько независимых вариантов тактики для одного босса и сложности.
- **Автосохранение и история** — контрольные точки перед опасными операциями и периодические snapshots.
- **Состав внутри плана** — Workspace-проект хранит собственный roster вместе со сценами, таймлайном и назначениями.
- **Полноэкранный показ** — режим объяснения тактики без редакторского интерфейса.
- **Визуальный таймлайн** — ключевые события боя на одной шкале с переходом в соответствующий кадр.
- **Назначения / рейдовые КД** — игрок, событие, тип назначения, способность и комментарий.
- **WCL → черновик** — Browser Replay JSON превращается в отдельный редактируемый Workspace-план.
- **Импорт/экспорт Workspace** — один план или вся библиотека.

## WCL Draft

Для формата `raidru-wcl-replay-browser` версия 0.9.5:

- определяет босса по `source.bossId`, когда есть профиль RaidRU/NSRT;
- отделяет устойчивые треки игроков от питомцев и призывов;
- использует заполненный состав RaidRU для имён и ролей;
- фильтрует melee и близкие дубли cast/begincast;
- распознаёт ключевые spell ID из NSRT Heroic профилей;
- создаёт до 12 ключевых сцен;
- сохраняет WCL-черновик **новым планом**, не перезаписывая исходный.

Проверено на текущих regression replay:

- Sszorak: 11 player tracks, 12 draft scenes;
- The Twin Fangs: 16 player tracks, 12 draft scenes.

## RaidPlan

Геометрия стабилизированного renderer `native-v18-v2-canvas-line-endpoints` в этом релизе **не менялась**. Исправления 0.8.37 для Fabric transforms, path, line endpoints и off-canvas clipping сохранены.

## Проверка перед публикацией

```powershell
node --check app.js
node --check workspace-095.js
node --check raidplan-importer.js
node --check sw.js
node test-workspace-095.js
```

При наличии Browser Replay JSON:

```powershell
node test-workspace-095.js .\sszorak.raidru-replay.json .\twin-fangs.raidru-replay.json
```

## Публикация GitHub Pages

```powershell
git add app.js workspace-095.js test-workspace-095.js styles.css index.html manifest.webmanifest raidplan-importer.js sw.js README.md RELEASE-0.9.5.md
git commit -m "Release RaidRU 0.9.5 Raid Workspace"
git push
```

Cloudflare Worker в 0.9.5 не менялся, поэтому `deploy.ps1` / Wrangler для этого релиза не требуется.

После публикации сделать `Ctrl + F5`. Если браузер продолжает показывать старую сборку, очистить старый Service Worker и Cache Storage в DevTools → Application.
