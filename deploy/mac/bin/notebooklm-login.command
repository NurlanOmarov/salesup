#!/usr/bin/env bash
# Вход NotebookLM на мини — разово и когда админка скажет, что сессия Google истекла.
#
# Двойной клик на мини (через Screen Sharing) или с макбука:
#   ssh macmini 'open -a Terminal ~/projects/salesup/deploy/mac/bin/notebooklm-login.command'
#
# Открывает Chrome, вы входите в Google — сессия сохраняется в ~/.notebooklm.
# Дальше её каждые 15 минут освежает агент kz.salesup.notebooklm, так что вход
# живёт сам. Сессия отдельная от Chrome на макбуке и ему не мешает.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"

LOG="$HOME/Library/Logs/salesup-notebooklm-login.log"

{
  echo "[$(date '+%F %T')] вход NotebookLM"
  echo "Войдите в Google аккаунтом, в котором работает NotebookLM (omarov.nb@gmail.com)."
  echo "Окно ждёт час — можно спокойно подключиться к экрану мини."
  echo
  # По умолчанию ждёт 5 минут: через Screen Sharing не всегда успеть.
  notebooklm login --browser chrome --browser-timeout 3600
  echo
  notebooklm auth check --test
  echo
  echo "Готово — окно можно закрыть."
} 2>&1 | tee -a "$LOG"
