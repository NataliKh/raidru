# RaidRU WCL Bridge 2.2.0

Локальное Chrome/Chromium-расширение для получения **координат Replay** непосредственно в браузерной сессии Warcraft Logs.

## Почему оно нужно

Публичный WCL GraphQL API подходит для состава и механик, но на реальном тестовом отчёте `v3Qdp9M24hxy1bRg` завершает полный `events(includeResources:true)` без координат. При этом экран Replay WCL в браузере получает десятки тысяч координат через `/reports/replaysegment/...`.

Cloudflare Worker не должен обращаться к этому внутреннему web-route: серверный запрос может получить HTML/challenge вместо JSON. Bridge выполняет тот же запрос **same-origin внутри вкладки Warcraft Logs** и передаёт RaidRU только компактные координаты выбранных `friendlyPlayers`.

## Установка для разработки

1. Открой `chrome://extensions/`.
2. Включи **Режим разработчика**.
3. Нажми **Загрузить распакованное расширение**.
4. Выбери папку `wcl-bridge-extension`.
5. Открой/перезагрузи RaidRU.

После этого обычная кнопка «Загрузить бой» сама откроет (или переиспользует) фоновую вкладку Warcraft Logs Replay и получит координаты. JSON вручную экспортировать не нужно.

## Доступы

Расширение запускается только на:

- `https://*.warcraftlogs.com/reports/*`;
- `https://natalikh.github.io/raidru/*`;
- localhost/127.0.0.1 для локальной разработки.

Worker/OAuth по-прежнему используется для metadata и Mechanics Pack. Cookies Warcraft Logs не передаются RaidRU или Worker.
