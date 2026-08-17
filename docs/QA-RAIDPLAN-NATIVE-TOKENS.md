# QA — RaidPlan Native Tokens / Planner UX 3.0.0-alpha.3.3

Эталон: `https://raidplan.io/plan/9v3wssyjja56rttz`, Heroic, Scene 1.

После чистого повторного импорта должны быть видны не только текст и белая стрелка, но и native tokens оригинала:

- Tank role marker слева сверху;
- ★ raid marker;
- Nek'zali portrait;
- ● raid marker;
- melee и ranged role markers;
- ◆ и ▲ raid markers;
- Latent Cultist portrait у конца стрелки.

Проверить:

1. Переключателя `Оригинал / RaidRU` в toolbar больше нет; импортированная сцена сразу открывается в обычном редактируемом режиме RaidRU.
2. Ни один marker/mob без `attr.opacity` не становится прозрачным.
3. Локальный asset fallback работает, если CDN icon не загрузился.
4. Внутренние `lname` мобов не создают лишние подписи, если `attr.text` пуст.
5. Scene 3 freehand path и Scene 4 off-canvas line не регрессировали.
6. `npm run typecheck`, `npm test`, `npm run build` локально проходят.

Для этого релиза Worker не менялся.
