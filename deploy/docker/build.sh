#!/bin/bash
# Сборка и запуск Docker контейнеров
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Сборка Docker образов ГИС КООРДИНАТОР ==="

# Check .env
if [ ! -f .env ]; then
    echo "Копирование .env.example -> .env"
    cp .env.example .env
    echo "⚠️  Отредактируйте .env перед продолжением!"
    echo "   nano .env"
    exit 1
fi

# Build all images
echo ""
echo "1. Сборка backend..."
docker compose build api

echo ""
echo "2. Сборка celery..."
docker compose build celery-worker

echo ""
echo "3. Сборка frontend..."
docker compose build frontend

echo ""
echo "=== Сборка завершена ==="
echo ""
echo "Команды запуска:"
echo "  docker compose up -d          # Запуск всех сервисов"
echo "  docker compose ps             # Статус"
echo "  docker compose logs -f api    # Логи API"
echo "  docker compose down           # Остановка"
