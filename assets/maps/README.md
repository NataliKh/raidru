# Arena backgrounds — RaidRU 0.8.10

RaidRU хранит карты локально, чтобы Planner работал на GitHub Pages без сетевой зависимости.

## Архитектура

Источник карты выбирается по `mapID` конкретного Heroic Warcraft Logs Replay, а нужная игровая площадка задаётся отдельным `viewport` босса в `bossMaps`.

- `2606-map.webp` — Nek’zali. В 0.8.10 сохранён ранее проверенный локальный crop 2606, чтобы не ломать готовую тактику.
- `2607-map.webp` — The Twin Fangs / Pit of Fangs.
- `2608-map.webp` — Entombed Sentinels и Vashnik.
- `2609-map.webp` — The Lost Explorers и Sszorak, с разными viewport.

`The Coiled Altar` и `Ula’tek` пока продолжают использовать прежние локальные assets: новый `mapID` для них не назначается без Heroic Replay.

Оригинальные карты Warcraft Logs / RPGLogs имеют вид:
`https://assets.rpglogs.com/img/warcraft/maps/<mapID>-map.png?v=2`.
