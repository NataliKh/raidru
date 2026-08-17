# Regression: RaidPlan v2 off-canvas line geometry

Эталон: `https://raidplan.io/plan/9v3wssyjja56rttz#4`.

Фактическая структура scene 4:
- RaidPlan v2 canvas: `1200×675`;
- три белых объекта имеют `type: line`;
- `attr.points` лежат вокруг `(0,0)`;
- `meta.pos` отрицательный и соответствует bounding box линии;
- эти линии не должны участвовать в вычислении transform всей сцены.

Критические проверки:
1. Босс `Nek'zali` с `meta.pos ≈ (600,344)` остаётся около центра карты,
   а не уезжает к ~70% X.
2. Три `line` не затаскиваются внутрь карты.
3. Видим только естественно обрезанный фрагмент у верхнего левого края,
   как в RaidPlan.
4. Scene 3 по-прежнему сохраняет две freehand-стрелки из `path.attr.points`.
