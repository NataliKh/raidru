# RaidRU 0.8.1 — Planner-first / Vashnik Heroic

Главная цель версии 0.8 — вернуть фокус на визуальный планировщик тактики.

## Vashnik the Malignant

Vashnik полностью пересобран на базе:
- полного Heroic PTR WCL-референса `CKxQHX49TNAqBkfm`, fight 40 (8:08);
- оригинальной карты Warcraft Logs/RPGLogs `mapID 2608`;
- актуальной механики Heroic (Imbibe, Living Venoms, Plague Froth, Malignant Catalyst/Catalytic Bile, Adaptive Infection, Toxic Vapor).

### Новые сцены
1. Пулл — подготовка Тень + Пламя
2. Plague Froth — назначенные выносы
3. Imbibe #1 — Тень + Пламя
4. Malignant Catalyst — Catalytic Bile soaks
5. Adaptive Infection — развод по типу
6. Imbibe #2 — Кровь + Пламя
7. Imbibe #3 — Кровь + Тень
8. Поздние циклы — повтор треугольника

Полный встроенный timeline использует референсные cast-times всего PTR-килла: 18 Plague Froth, 6 Imbibe, 11 Malignant Catalyst и 16 Adaptive Infection.

## Карта

`assets/maps/vashnik.webp` теперь является crop оригинальной карты `2608-map` с правильной геометрией трёх источников:
- Кровь — слева;
- Тень — справа;
- Пламя — снизу;
- Malignant Cavity — в центре.

Hard arena mask перекалибрована под новую подложку.


## Миграция

При первом открытии 0.8 встроенные Vashnik-сцены и таймлайн обновляются автоматически. Пользовательские отдельные сцены и roster/class tokens стараемся сохранить; старая калибровка карты Vashnik не переносится, потому что подложка изменилась.


## 0.8.1 hotfix

- Исправлен startup crash `Cannot access 'encounterLibrary' before initialization`.
- Миграции localStorage теперь выполняются после инициализации encounter-палитры.
- WCL Proxy по-прежнему отсутствует в публичном интерфейсе.
