# Фабрика подкастов на Mac mini

AI-подкасты уроков (NotebookLM Audio Overview) генерирует домашний Mac mini — он не
выключается, в отличие от макбука. Ход работы видно в админке: **/admin/podcasts**.

Общие правила мини (раскладка, имена агентов, порты) — `~/srv/PORTS.md` на самом мини,
доступ и железо — справочник `MACMINI_REMOTE.md`.

## Как устроено

```
Mac mini ──ssh-туннель──▶ PostgreSQL прода   читает уроки, пишет podcastKey и статусы
         ──rsync + docker cp──▶ медиа-том прода   кладёт podcast.m4a
         ──NotebookLM (Google)                    генерирует аудио
```

Прод до мини достучаться не может (мини за CGNAT, виден только в tailnet), поэтому
всё инициирует мини. Локальной БД и локальных копий медиа нет: фабрика работает прямо
с продом (`podcast.ts --queue --ship`), так что id уроков разойтись не с чем.

Пароль БД на мини не хранится — раннер берёт его у контейнера на время прогона.
На сервер мини ходит своим ключом `~/.ssh/salesup_factory_ed25519` (отзыв — удалить
строку `mac-mini salesup factory` из `authorized_keys` сервера).

## Раскладка на мини

```
~/projects/salesup/                   код фабрики; заливается push.sh, сносится безболезненно
~/srv/salesup/deploy.env              параметры доступа к серверу (копия .env.deploy, без секретов)
~/.notebooklm/                        сессия Google для NotebookLM
~/Library/Logs/salesup-podcasts.log   журнал прогонов
~/Library/Logs/salesup-notebooklm.log журнал освежения сессии
```

## Агенты launchd

Пользовательские (`~/Library/LaunchAgents`), как у find2gis: sudo не нужен, GUI-сеанс
на мини есть всегда благодаря автовходу.

| Агент | Что делает | Когда |
|---|---|---|
| `kz.salesup.podcasts` | очередь подкастов: туннель → генерация → на прод | 9:17 и 21:17 |
| `kz.salesup.notebooklm` | `notebooklm auth refresh` — держит сессию Google живой | каждые 15 минут |

Квота Google — около трёх подкастов в сутки. Прогон идёт по курсам в порядке
`QUEUE_ORDER` (`scripts/factory/podcast.ts`), пока не упрётся в квоту; сбойный урок
не держит очередь. Аудио, которое сгенерировалось, но не скачалось, не теряется:
ноутбук остаётся, и следующий прогон докачивает его без траты квоты.

## Работа с макбука

```bash
./deploy/mac/setup.sh   # разовая подготовка мини (повторять безопасно)
./deploy/mac/push.sh    # выложить новую версию фабрики и перечитать агенты
```

```bash
ssh macmini 'launchctl kickstart gui/$(id -u)/kz.salesup.podcasts'   # прогнать сейчас
ssh macmini 'tail -f ~/Library/Logs/salesup-podcasts.log'            # журнал
```

Схема БД на мини берётся из выложенного кода, а таблицы — на проде. Если меняли
`prisma/schema.prisma`, сначала деплой прода (миграция), потом `push.sh`.

## Вход в Google

Нужен один раз, и ещё когда админка покажет «сессия Google недействительна».
Открыть окно входа на экране мини:

```bash
ssh macmini 'open -a Terminal ~/projects/salesup/deploy/mac/bin/notebooklm-login.command'
```

Затем Finder → ⌘K → `vnc://100.90.206.127`, войти в Google аккаунтом, в котором
работает NotebookLM. Сессия мини отдельная от Chrome на макбуке и ему не мешает.
