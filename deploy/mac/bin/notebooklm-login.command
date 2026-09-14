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

echo "Войдите в Google аккаунтом, в котором работает NotebookLM (omarov.nb@gmail.com)."
echo
notebooklm login --browser chrome
echo
notebooklm auth check --test
echo
echo "Готово — окно можно закрыть."
