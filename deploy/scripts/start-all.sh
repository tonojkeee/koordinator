#!/bin/bash
# Запуск всех сервисов КООРДИНАТОР

echo "=== Запуск сервисов ГИС КООРДИНАТОР ==="

sudo systemctl start koordinator-api
echo "✓ API запущен"

sudo systemctl start koordinator-celery
echo "✓ Celery Worker запущен"

sudo systemctl start koordinator-celery-beat
echo "✓ Celery Beat запущен"

echo ""
echo "Все сервисы запущены. Проверка:"
./$(dirname "$0")/status.sh
