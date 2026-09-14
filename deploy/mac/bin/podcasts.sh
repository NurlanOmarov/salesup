#!/usr/bin/env bash
# Автопрогон фабрики подкастов на Mac mini (агент kz.salesup.podcasts).
#
# Мини за CGNAT, прод до него не достаёт — поэтому ходит сам мини: открывает
# ssh-туннель к PostgreSQL прода и запускает `podcast.ts --queue --ship`. Фабрика
# читает уроки прямо из прод-БД, заливает m4a в медиа-том прода и пишет ход работы
# в PodcastRun/PodcastLessonStatus — его видно в /admin/podcasts.
#
# Пароль БД на мини не хранится: берётся у контейнера на время прогона и живёт
# только в окружении процесса. Параметры доступа (без секретов) —
# ~/srv/salesup/deploy.env, его кладёт deploy/mac/push.sh.
set -uo pipefail

APP="${SALESUP_APP_DIR:-/Users/mac/projects/salesup}"
STATE="${SALESUP_STATE_DIR:-/Users/mac/srv/salesup}"
NODE_BIN="${SALESUP_NODE_BIN:-/opt/homebrew/opt/node@22/bin}"
TUNNEL_PORT="${SALESUP_TUNNEL_PORT:-15432}"

export PATH="$NODE_BIN:/Users/mac/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NOTEBOOKLM_AUTH=refresh

say() { echo "[$(date '+%F %T')] $*"; }

# ── Один прогон за раз ───────────────────────────────────────────────────────
# Агент ходит дважды в сутки, а прогон может длиться часами.
LOCK="$STATE/.podcasts.lock"
mkdir -p "$STATE"
if ! mkdir "$LOCK" 2>/dev/null; then
  if [[ -f "$LOCK/pid" ]] && kill -0 "$(cat "$LOCK/pid")" 2>/dev/null; then
    say "прогон уже идёт (pid $(cat "$LOCK/pid")) — пропуск"
    exit 0
  fi
  say "замок остался от оборвавшегося прогона — снимаю"
  rm -rf "$LOCK"
  mkdir "$LOCK" || exit 1
fi
echo $$ > "$LOCK/pid"

SOCK="$STATE/.tunnel.sock"
cleanup() {
  [[ -S "$SOCK" ]] && ssh -S "$SOCK" -O exit "${DEPLOY_HOST:-salesup-new}" 2>/dev/null
  rm -rf "$LOCK"
}
trap cleanup EXIT

# ── Параметры доступа к проду ────────────────────────────────────────────────
[[ -f "$STATE/deploy.env" ]] || { say "нет $STATE/deploy.env — запустите deploy/mac/push.sh с макбука"; exit 1; }
set -a
# shellcheck source=/dev/null
source "$STATE/deploy.env"
set +a
DB_CONTAINER="${DEPLOY_DB_CONTAINER:-salesup-db-1}"
DB_USER="${DEPLOY_DB_USER:-salesacademy}"
DB_NAME="${DEPLOY_DB_NAME:-salesacademy}"

nc -z -G 10 "$(ssh -G "$DEPLOY_HOST" | awk '/^hostname /{print $2}')" "${DEPLOY_SSH_PORT:-22}" 2>/dev/null \
  || { say "сервер недоступен (нет сети?) — пропуск, повторю по расписанию"; exit 0; }

# ── Туннель к PostgreSQL прода ───────────────────────────────────────────────
# Порт БД наружу не опубликован — стучимся на адрес контейнера в docker-сети
# через ssh. Адрес меняется при пересоздании контейнера, поэтому узнаём его каждый раз.
DB_IP="$(ssh "$DEPLOY_HOST" "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $DB_CONTAINER")" \
  || { say "не удалось узнать адрес БД на сервере"; exit 1; }
DB_PASS="$(ssh "$DEPLOY_HOST" "docker exec $DB_CONTAINER printenv POSTGRES_PASSWORD")" \
  || { say "не удалось получить доступ к БД на сервере"; exit 1; }

ssh -f -N -M -S "$SOCK" \
  -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=4 \
  -L "127.0.0.1:$TUNNEL_PORT:$DB_IP:5432" "$DEPLOY_HOST" \
  || { say "туннель к БД не поднялся"; exit 1; }

DB_PASS_URL="$(DB_PASS="$DB_PASS" python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["DB_PASS"], safe=""))')"
export DATABASE_URL="postgresql://$DB_USER:$DB_PASS_URL@127.0.0.1:$TUNNEL_PORT/$DB_NAME"
unset DB_PASS DB_PASS_URL

# ── Прогон ───────────────────────────────────────────────────────────────────
say "старт очереди подкастов"
cd "$APP" || { say "нет кода в $APP — запустите deploy/mac/push.sh"; exit 1; }
node_modules/.bin/tsx scripts/factory/podcast.ts --queue --ship
code=$?

case "$code" in
  0) say "очередь пройдена" ;;
  75) say "дневная квота NotebookLM исчерпана — продолжу в следующий запуск" ;;
  *) say "прогон завершился с ошибкой (код $code) — подробности выше и в /admin/podcasts" ;;
esac
exit 0
