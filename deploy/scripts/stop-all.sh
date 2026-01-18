#!/bin/bash
# Остановка всех сервисов КООРДИНАТОР

echo "=== Остановка сервисов ГИС КООРДИНАТОР ==="

sudo systemctl stop koordinator-celery-beat
echo "✓ Celery Beat остановлен"

sudo systemctl stop koordinator-celery
echo "✓ Celery Worker остановлен"

sudo systemctl stop koordinator-api
echo "✓ API остановлен"

echo ""
echo "Все сервисы остановлены."
