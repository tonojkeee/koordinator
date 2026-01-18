#!/bin/bash
# Быстрый старт Docker
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Запуск ГИС КООРДИНАТОР в Docker ==="

# Check .env
if [ ! -f .env ]; then
    echo "Создание .env из шаблона..."
    cp .env.example .env
    echo "⚠️  Измените SECRET_KEY и пароли в .env!"
fi

# Start services
echo ""
echo "Запуск сервисов..."
docker compose up -d

echo ""
echo "Ожидание запуска..."
sleep 5

# Show status
docker compose ps

echo ""
echo "=== Готово! ==="
echo ""
echo "🌐 Frontend: http://localhost"
echo "🔧 API:      http://localhost:8000"
echo "📊 Metrics:  http://localhost:8000/metrics"
echo "💚 Health:   http://localhost:8000/health"
echo ""
echo "Полезные команды:"
echo "  docker compose logs -f        # Все логи"
echo "  docker compose logs -f api    # Логи API"
echo "  docker compose ps             # Статус"
echo "  docker compose down           # Остановка"
echo "  docker compose down -v        # Остановка + удаление данных"
