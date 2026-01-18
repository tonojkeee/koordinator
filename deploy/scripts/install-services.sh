#!/bin/bash
# Скрипт установки systemd сервисов
# Запускать с sudo: sudo ./install-services.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
SYSTEMD_DIR="$DEPLOY_DIR/systemd"

echo "=== Установка сервисов ГИС КООРДИНАТОР ==="

# Проверка прав
if [[ $EUID -ne 0 ]]; then
   echo "Ошибка: запустите с sudo" 
   exit 1
fi

# Копирование unit файлов
echo "Копирование unit файлов..."
cp "$SYSTEMD_DIR/koordinator-api.service" /etc/systemd/system/
cp "$SYSTEMD_DIR/koordinator-celery.service" /etc/systemd/system/
cp "$SYSTEMD_DIR/koordinator-celery-beat.service" /etc/systemd/system/
cp "$SYSTEMD_DIR/koordinator-smtp.service" /etc/systemd/system/

# Перезагрузка systemd
echo "Перезагрузка systemd..."
systemctl daemon-reload

# Включение автозапуска
echo "Включение автозапуска..."
systemctl enable koordinator-api
systemctl enable koordinator-celery
systemctl enable koordinator-celery-beat
# SMTP опционален, не включаем по умолчанию
# systemctl enable koordinator-smtp

echo ""
echo "=== Установка завершена ==="
echo ""
echo "Команды для запуска:"
echo "  sudo systemctl start koordinator-api"
echo "  sudo systemctl start koordinator-celery"
echo "  sudo systemctl start koordinator-celery-beat"
echo ""
echo "Или используйте: ./scripts/start-all.sh"
