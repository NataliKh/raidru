# RaidRU 2.0.1 — WCL transport fix

Исправляет `TypeError: Failed to fetch` при прямом WCL URL Import.

- Service Worker больше не перехватывает cross-origin запросы к Cloudflare Worker.
- WCL client явно использует CORS и показывает сетевую ошибку вместо необработанного Promise rejection.
- `/wcl/ping` проверяет браузер -> Worker без обращения к Warcraft Logs и без расхода WCL quota.
- Запрещённый Origin теперь возвращает читаемый `403 origin_not_allowed`, а не скрытую CORS ошибку.
- WCL quota guard, page cache и resume checkpoint не изменены.
