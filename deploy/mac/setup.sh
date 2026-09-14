#!/usr/bin/env bash
# Разовая подготовка Mac mini под фабрику подкастов. Запускать с макбука:
#   ./deploy/mac/setup.sh
# Повторный запуск безопасен: каждый шаг проверяет, не сделан ли он уже.
#
# Что делает:
#   1. Node 22 (как в проде) и notebooklm-py на мини.
#   2. Отдельный ssh-ключ мини для сервера: свой, а не копия ключа макбука, —
#      отозвать можно одной строкой в authorized_keys, не трогая макбук.
#   3. Алиас salesup-new в ~/.ssh/config мини.
# После него: deploy/mac/push.sh, затем разовый вход в NotebookLM (см. README).
set -euo pipefail
cd "$(dirname "$0")/../.."

MINI="${SALESUP_MINI_SSH:-macmini}"
VPS="${SALESUP_VPS_SSH:-salesup-new}"
KEY_NAME="salesup_factory_ed25519"

[[ -f .env.deploy ]] || { echo "Нет .env.deploy — в нём параметры доступа к серверу" >&2; exit 1; }

# Параметры сервера берём у ssh-алиаса макбука — одна точка правды.
VPS_HOST="$(ssh -G "$VPS" | awk '/^hostname /{print $2}')"
VPS_PORT="$(ssh -G "$VPS" | awk '/^port /{print $2}')"
VPS_USER="$(ssh -G "$VPS" | awk '/^user /{print $2}')"

echo "→ Node 22 и notebooklm-py на мини"
ssh "$MINI" 'eval "$(/opt/homebrew/bin/brew shellenv)"
  brew list node@22 >/dev/null 2>&1 || brew install node@22
  [[ -x ~/.local/bin/notebooklm ]] || uv tool install "notebooklm-py[browser,cookies]"
  /opt/homebrew/opt/node@22/bin/node -v; ~/.local/bin/notebooklm --version'

echo "→ ~/.ssh/config мини"
# colima дописала Include без перевода строки, и блок github.com стал глобальным:
# любое ssh-соединение с мини уходило на github.com. Чиним, сохранив копию.
ssh "$MINI" 'f=~/.ssh/config
  if grep -q "ssh_configHost " "$f" 2>/dev/null; then
    cp "$f" "$f.bak-$(date +%Y%m%d%H%M%S)"
    /usr/bin/sed -i "" "s/ssh_configHost /ssh_config\\
\\
Host /" "$f"
    echo "  исправлен склеенный Include"
  fi'

echo "→ ключ мини для сервера"
PUB="$(ssh "$MINI" "[[ -f ~/.ssh/$KEY_NAME ]] || ssh-keygen -q -t ed25519 -N '' -C 'mac-mini salesup factory' -f ~/.ssh/$KEY_NAME; cat ~/.ssh/$KEY_NAME.pub")"
if ssh "$VPS" "grep -qxF '$PUB' ~/.ssh/authorized_keys"; then
  echo "  уже разрешён на сервере"
else
  ssh "$VPS" "umask 077; mkdir -p ~/.ssh; echo '$PUB' >> ~/.ssh/authorized_keys"
  echo "  добавлен в authorized_keys сервера"
fi

ssh "$MINI" "grep -q '^Host $VPS\$' ~/.ssh/config 2>/dev/null || cat >> ~/.ssh/config <<EOF

Host $VPS
  HostName $VPS_HOST
  Port $VPS_PORT
  User $VPS_USER
  IdentityFile ~/.ssh/$KEY_NAME
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF"

echo "→ проверка: мини → сервер"
ssh "$MINI" "ssh -o BatchMode=yes $VPS 'docker ps --format {{.Names}} | grep -c salesup'" >/dev/null \
  && echo "  мини достаёт сервер и видит контейнеры salesup"

echo
echo "Готово. Дальше: ./deploy/mac/push.sh"
