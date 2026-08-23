#!/usr/bin/env bash
#
# Деплой WayCar на сервер: обновление с GitHub, пересборка, перезапуск.
# Запуск на сервере:  ./deploy.sh [ветка]
#
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${1:-main}"
PM2_APP="waycar-backend"

cd "$PROJECT_DIR"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }

log "Проверка рабочей копии"
if [ -n "$(git status --porcelain -- . ':!dist')" ]; then
  echo "В рабочей копии есть незакоммиченные изменения:"
  git status --short -- . ':!dist'
  echo
  echo "Деплой остановлен, чтобы ничего не затереть."
  echo "Разберитесь с изменениями вручную и запустите скрипт снова."
  exit 1
fi

log "Обновление кода (ветка: $BRANCH)"
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "Коммит: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# npm ci ставит строго по package-lock.json и, в отличие от npm install,
# никогда его не переписывает — иначе локфайл вечно «грязный» из-за
# разницы версий npm между машиной разработчика и сервером.
log "Сборка backend"
(cd backend && npm ci --no-audit --loglevel=error && npm run build)

log "Сборка frontend"
npm ci --no-audit --loglevel=error
npm run build

# service-worker.js лежит в public/, поэтому Vite копирует его в dist сам.
if [ ! -f dist/service-worker.js ]; then
  echo "ОШИБКА: dist/service-worker.js отсутствует — офлайн-режим не будет работать." >&2
  exit 1
fi

log "Права доступа"
chown -R root:www-data dist
chmod -R 755 dist

log "Перезапуск backend"
pm2 restart "$PM2_APP" --update-env
pm2 save

log "Готово"
echo "Коммит:  $(git rev-parse --short HEAD)"
echo "Сборка:  $(du -sh dist | cut -f1)"
