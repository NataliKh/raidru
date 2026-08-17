# QA — RaidPlan Visual Fidelity 3.0.0-alpha.3.1

1. Открыть Planner и убедиться, что иконки Танк/Хилер/Мили/РДД загружаются без broken-image placeholders.
2. Импортировать `https://raidplan.io/plan/9v3wssyjja56rttz` в Heroic.
3. Scene 1: заголовок заметно крупнее body text, два body-блока сохраняют ширину и переносы, role/raid markers имеют исходные размеры.
4. Убедиться, что отдельного переключателя `Оригинал / RaidRU` больше нет; для сверки используется ссылка `↗ RaidPlan`.
5. Нажать `↗ RaidPlan`: открывается исходный plan и текущий номер сцены.
6. Scene 3: freehand strokes остаются stroke-only и не схлопываются.
7. Scene 4: стрелки у верхнего левого края не clamp-ятся внутрь canvas; boss остаётся около центра.
8. Переключить все 6 сцен: fidelity strip показывает canvas, tokens/text/vectors/off-canvas и revision.
9. Вернуться в `RaidRU`: drag/drop, selection, undo/redo работают как в alpha.2.
10. `npm run typecheck`, `npm test`, `npm run build` должны завершиться без ошибок.
