#!/bin/bash
# Перезапуск всех сервисов КООРДИНАТОР

echo "=== Перезапуск сервисов ГИС КООРДИНАТОР ==="

sudo systemctl restart koordinator-api
echo "✓ API перезапущен"

sudo systemctl restart koordinator-celery
echo "✓ Celery Worker перезапущен"

sudo systemctl restart koordinator-celery-beat
echo "✓ Celery Beat перезапущен"

echo ""
echo "Перезапуск завершён."
./$(dirname "$0")/status.sh
