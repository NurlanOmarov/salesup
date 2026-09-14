#!/usr/bin/env bash
# Выкладка фабрики подкастов на Mac mini. Запускать с макбука:
#   ./deploy/mac/push.sh
#
# На мини едет не весь репозиторий, а то, что нужно фабрике: src (lib/db и
# алиасы), prisma, scripts, deploy/mac и манифесты пакетов. Без git-remote,
# обычным rsync через Tailscale — как find2gis. Идущий прогон не обрывается:
# код подменяется, агенты перечитываются, текущий процесс доработает на старом.
set -euo pipefail
cd "$(dirname "$0")/../.."

MINI="${SALESUP_MINI_SSH:-macmini}"
REMOTE="/Users/mac/projects/salesup"
STATE="/Users/mac/srv/salesup"
NODE_BIN="/opt/homebrew/opt/node@22/bin"

echo "→ копирую код на $MINI:$REMOTE"
ssh "$MINI" "mkdir -p '$REMOTE' '$STATE'"
rsync -a --delete --relative \
  --exclude '*.test.ts' \
  ./src ./prisma ./scripts ./deploy/mac \
  ./package.json ./pnpm-lock.yaml ./tsconfig.json \
  "$MINI:$REMOTE/"

echo "→ параметры доступа к серверу (без секретов)"
scp -q .env.deploy "$MINI:$STATE/deploy.env"
ssh "$MINI" "chmod 600 '$STATE/deploy.env'"

echo "→ зависимости и Prisma Client"
ssh "$MINI" "cd '$REMOTE' && export PATH='$NODE_BIN:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin' COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  && corepack pnpm install --frozen-lockfile --prod=false --reporter=silent \
  && node_modules/.bin/prisma generate >/dev/null && echo '  готово'"

echo "→ агенты launchd"
ssh "$MINI" 'set -e
  uid=$(id -u)
  for plist in ~/projects/salesup/deploy/mac/launchd/*.plist; do
    label=$(basename "$plist" .plist)
    cp "$plist" ~/Library/LaunchAgents/
    launchctl bootout "gui/$uid/$label" 2>/dev/null || true
    launchctl bootstrap "gui/$uid" ~/Library/LaunchAgents/"$label".plist
    echo "  $label загружен"
  done'

echo
echo "Готово. Прогнать очередь сейчас, не дожидаясь расписания:"
echo "  ssh $MINI 'launchctl kickstart gui/\$(id -u)/kz.salesup.podcasts'"
echo "Журнал: ssh $MINI 'tail -f ~/Library/Logs/salesup-podcasts.log'"
