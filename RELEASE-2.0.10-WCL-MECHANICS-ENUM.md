# RaidRU 2.0.10 — WCL Mechanics Enum Fix

Исправлена GraphQL-валидация Mechanics Pack.

Warcraft Logs объявляет `hostilityType` как `HostilityType` (enum). В 2.0.9 в запросе были числовые литералы `0`/`1`, из-за чего GraphQL отклонял запрос до выполнения.

Теперь используются enum-литералы:

- `Enemies` — касты босса и призывы;
- `Friendlies` — дебаффы на рейде.

Изменение только серверное: UI и формат Mechanics Pack не менялись.
