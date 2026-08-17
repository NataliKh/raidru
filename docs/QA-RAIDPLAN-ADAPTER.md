# QA — RaidRU 3.0.0-alpha.3.1 RaidPlan Adapter

## Автоматически

```bash
npm test
```

Обязательные regression cases:

1. `scene3-paths.json`
   - 1 degenerate path skip;
   - 4 валидные path pieces;
   - `fill = none`;
   - points не потеряны;
   - fixed v2 canvas.

2. `scene4-lines.json`
   - 3 drawn lines;
   - Fabric endpoint signature определён;
   - отрицательные/off-canvas coordinates сохранены;
   - boss около центра `(50%, 51%)`.

3. synthetic strict-visible fixture
   - opacity 0 отсутствует;
   - unknown v2 type отсутствует;
   - mapped arena не становится effect.

## Ручная проверка URL

На локальном Vite:

```bash
npm run dev
```

Открыть Planner → `⇩ RaidPlan` → вставить:

```text
https://raidplan.io/plan/9v3wssyjja56rttz
```

Проверить preview до применения. Затем **Добавить сцены**.

### Scene 3

- freehand стрелки не превращаются в белые капсулы/круги;
- relative geometry частей совпадает;
- нет большой arena mask поверх карты.

### Scene 4

- Nek'zali около центра;
- видимая часть drawn arrow корректно clipping-ится границей canvas;
- линия не прижимается автоматически к краю.

## Повторный импорт

Импортировать тот же план второй раз через **Добавить сцены**.

Ожидание: сцены добавятся повторно, но React keys / object IDs не конфликтуют.

## Difficulty

Импортировать в Heroic, затем переключиться на Mythic.

Ожидание: Heroic import не появляется в Mythic сам по себе. Импорт всегда применяется к сложности, активной в момент Apply.

## Replace

Нажать **Заменить план**.

Ожидание: появляется confirm. После подтверждения текущие сцены сложности заменяются только импортированными сценами. Undo возвращает предыдущее состояние.

## Ошибки

- некорректная ссылка → понятная ошибка;
- HTTP 404 → «план не найден»;
- invalid JSON file → файл не применяется;
- unsupported nodes → warning/report, но не случайная отрисовка.
