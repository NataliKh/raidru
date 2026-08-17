# RaidPlan Adapter architecture

## Инвариант

`packages/raidplan-core` — pure module. Он не знает о React, DOM, IndexedDB, dialogs, fetch или Cloudflare Worker.

Его контракт:

```ts
convertRaidPlan(raw, options) -> RaidPlanImportResult
```

Успешный результат содержит обычный `BossDifficultyPlanState`. После этого RaidPlan как внешний формат заканчивается.

## Почему так

RaidPlan не является стабильным публичным API. Поэтому нестабильность внешней схемы должна быть локализована в adapter boundary, а не распространяться по Planner.

UI отвечает только за transport/preview/apply:

- `RaidPlanClient.ts` — GET `/raidplan`;
- `RaidPlanImportDialog.tsx` — input/file/preview;
- `AppStore.applyExternalPlan()` — одна транзакция состояния;
- `Arena.tsx` — рисует универсальные `SceneToken` / `SceneEffect`.

## Visible-first

Правило импорта: воспроизводить видимый план, а не каждую внутреннюю запись JSON.

Для v2 действует whitelist. Неизвестная запись получает `skip` и попадает в report. Нельзя использовать generic fallback `unknown → zone`.

## Coordinates

Для v2 используется реальный canvas RaidPlan. Основной подтверждённый размер — `1200×675`.

```text
RaidPlan x / canvasWidth  * 100 -> RaidRU x%
RaidPlan y / canvasHeight * 100 -> RaidRU y%
```

Это не fit-to-content. Off-canvas линии могут иметь x/y меньше 0 или больше 100 и должны оставаться такими до SVG clipping.

### Freehand Path

`path.attr.points` — локальная brush geometry. Она восстанавливается внутри Fabric `meta.pos / meta.size / meta.origin`, после чего переводится в проценты canvas.

### Fabric Line

Для некоторых drawn line `attr.points` уже являются canvas endpoints около `(0,0)`. Adapter проверяет signature: `meta.pos` примерно равен bbox-minус-половина-stroke и `meta.size` соответствует bbox. При совпадении points переводятся как абсолютные canvas coordinates и не clamp-ятся.

## Source order / z-order

Adapter сохраняет `sourceOrder` из RaidPlan. В Arena native RaidPlan vectors получают отдельные SVG overlay layers, а tokens/text — соответствующий z-index. Это позволяет не сваливать все внешние эффекты безусловно под все markers.

## Arena

Если arena даёт реальную карту (`imageUrl` либо raid/boss/map), arena geometry не становится mechanic/effect. Карта хранится в `Scene.map.backgroundUrl`.

Blank/custom arena может быть импортирована как визуальная shape, если у неё есть подтверждённая paint geometry.

## Apply boundary

Adapter не меняет Store. `AppStore.applyExternalPlan()`:

1. создаёт undo snapshot;
2. re-key scenes/tokens/effects/routes;
3. append либо replace;
4. применяет к текущей difficulty;
5. переключает выбранного босса на detected boss;
6. открывает первую импортированную сцену.

Таким образом повторный импорт того же RaidPlan не создаёт ID collisions.
