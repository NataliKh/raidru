# RaidRU 2.0.2 — WCL Map Priority Fix

Исправляет карту в режиме Warcraft Logs Replay.

## Что изменено

- `normalizeReplayPayload()` больше не выбрасывает `mapIDs` и `position.mapID` из WCL Replay.
- Replay определяет основной `mapID` по данным самого WCL боя.
- Для известных `2606/2607/2608/2609` используется локальная копия RPGLogs/WCL map asset из `assets/maps/<mapID>-map.webp`.
- Если текущий босс имеет отдельный viewport на этой WCL-карте, Replay использует именно его.
- Карта босса/RaidPlan-подобный arena asset используется только как fallback, когда WCL не передал известный `mapID`.
- На карте Replay теперь виден `mapID`, чтобы источник можно было проверить глазами.
- WCL-черновик очищает `raidPlan.background` у сгенерированных сцен и помечается `mapSource='wcl'`.
- JSON diagnostic import использует ту же логику, что и URL import.
- Для Replay, уже сохранённого старой 2.0.1 без `mapIDs`, есть миграционный fallback на известный WCL mapID текущего босса; после повторной загрузки боя используется реальный mapID из ответа Worker.

## Приоритет карты

`WCL mapID -> WCL local map asset -> fallback boss arena`.

Worker API и quota guard не изменялись — для этого фикса повторный deploy Worker не требуется.
