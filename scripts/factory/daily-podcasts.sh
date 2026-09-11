#!/bin/bash
# Ежедневный автопрогон фабрики подкастов: взять следующий курс, где не хватает
# подкастов, сгенерировать сколько пустит дневная квота NotebookLM, выложить на
# прод и удалить локальные m4a (на маке мало места, прод — мастер медиа).
#
# Запускается launchd-агентом ~/Library/LaunchAgents/by.activesales.podcasts.daily.plist
# (два раза в сутки — квота Google сбрасывается по скользящему окну, попадаем не
# всегда с первого раза). Лог: logs/daily-podcasts.log в корне проекта.
#
# Ничего не делает молча-разрушительного: при выключенном Docker/девБД просто
# пишет причину в лог и выходит с нулём.
set -uo pipefail

PROJECT=/Users/nurlan/Documents/projects/salesup
export PATH="/Users/nurlan/.nvm/versions/node/v20.20.0/bin:/Users/nurlan/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

LOG="$PROJECT/logs/daily-podcasts.log"
mkdir -p "$(dirname "$LOG")"
say() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

cd "$PROJECT" || exit 0

# ── Один прогон за раз ───────────────────────────────────────────────────────
# Агент ходит дважды в сутки, а прогон может длиться часами: без замка второй
# запуск полез бы в тот же NotebookLM и ту же базу.
LOCK="$PROJECT/logs/.daily-podcasts.lock"
mkdir "$LOCK" 2>/dev/null || {
  if [ -f "$LOCK/pid" ] && kill -0 "$(cat "$LOCK/pid")" 2>/dev/null; then
    say "Прогон уже идёт (pid $(cat "$LOCK/pid")) — пропуск"
    exit 0
  fi
  say "Замок остался от упавшего прогона — снимаю"
  rm -rf "$LOCK"; mkdir "$LOCK" || exit 0
}
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT

# ── Предусловия ──────────────────────────────────────────────────────────────
docker info >/dev/null 2>&1 || { say "Docker не запущен — пропуск"; exit 0; }
docker ps --format '{{.Names}}' | grep -qx salesup-devdb || { say "Контейнер salesup-devdb не поднят — пропуск"; exit 0; }
command -v notebooklm >/dev/null || { say "notebooklm не найден — пропуск"; exit 0; }

psql_local() { docker exec salesup-devdb psql -U salesacademy -d salesacademy -t -A -c "$1"; }

# ── Какой курс делаем сегодня ────────────────────────────────────────────────
# Порядок: сначала добить начатое (realty), потом от коротких курсов к длинным,
# чтобы курсы закрывались целиком, а не все сразу наполовину.
# time-management не берём: у его уроков нет ни конспектов, ни транскриптов.
SLUG=$(psql_local "
  SELECT c.slug
  FROM \"Course\" c
  JOIN \"Module\" m ON m.\"courseId\" = c.id
  JOIN \"Lesson\" l ON l.\"moduleId\" = m.id
  LEFT JOIN LATERAL (
    SELECT 1 FROM \"AiArtifact\" a
    WHERE a.\"lessonId\" = l.id AND a.type = 'SUMMARY' AND a.validation = 'VALIDATED' LIMIT 1
  ) s ON true
  LEFT JOIN \"Transcript\" t ON t.\"lessonId\" = l.id
  WHERE l.\"podcastKey\" IS NULL
    AND (s IS NOT NULL OR (t.\"cleanText\" IS NOT NULL AND t.status = 'CLEANED'))
  GROUP BY c.slug
  ORDER BY array_position(
    ARRAY['sales-realty','sales-diy','sales-shoes','sales-spin','sales-tourism','sales-b2b','sales-kitchens'],
    c.slug
  ) NULLS LAST
  LIMIT 1;" | tr -d '[:space:]')

if [ -z "$SLUG" ]; then
  say "Все курсы с подкастами — работы нет"
  exit 0
fi

BEFORE=$(psql_local "SELECT count(*) FROM \"Lesson\" WHERE \"podcastKey\" IS NOT NULL;" | tr -d '[:space:]')
say "Курс $SLUG: старт (подкастов в базе: $BEFORE)"

# ── Генерация (сама выйдет, когда упрётся в дневную квоту) ───────────────────
pnpm factory:podcast --course "$SLUG" >> "$LOG" 2>&1

AFTER=$(psql_local "SELECT count(*) FROM \"Lesson\" WHERE \"podcastKey\" IS NOT NULL;" | tr -d '[:space:]')
NEW=$(( AFTER - BEFORE ))

if [ "$NEW" -le 0 ]; then
  say "Курс $SLUG: новых подкастов нет (скорее всего квота) — публикацию пропускаю"
  exit 0
fi

say "Курс $SLUG: сгенерировано $NEW — публикую на прод"
pnpm factory:publish --course "$SLUG" >> "$LOG" 2>&1
PUB=$?

if [ "$PUB" -ne 0 ]; then
  say "ОШИБКА публикации курса $SLUG (код $PUB) — локальные m4a НЕ удаляю, повторить вручную"
  exit 1
fi

# ── Освобождаем место: прод уже держит копию ────────────────────────────────
FREED=$(find media -name 'podcast.m4a' -type f -exec du -ck {} + 2>/dev/null | tail -1 | cut -f1)
find media -name 'podcast.m4a' -type f -delete
say "Курс $SLUG: опубликовано, локальные m4a удалены (${FREED:-0} КБ). Свободно: $(df -h / | awk 'NR==2{print $4}')"

# Лог не растим бесконечно.
tail -n 3000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
