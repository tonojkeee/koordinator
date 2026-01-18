#!/bin/bash
# Статус всех сервисов КООРДИНАТОР

echo "=== Статус сервисов ГИС КООРДИНАТОР ==="
echo ""

services=("koordinator-api" "koordinator-celery" "koordinator-celery-beat" "koordinator-smtp")

for service in "${services[@]}"; do
    status=$(systemctl is-active "$service" 2>/dev/null)
    enabled=$(systemctl is-enabled "$service" 2>/dev/null)
    
    if [ "$status" = "active" ]; then
        icon="✅"
    elif [ "$status" = "inactive" ]; then
        icon="⭕"
    else
        icon="❌"
    fi
    
    printf "%-30s %s %-10s (autostart: %s)\n" "$service" "$icon" "$status" "$enabled"
done

echo ""
echo "=== Зависимости ==="

for dep in "redis" "mysql" "nginx"; do
    status=$(systemctl is-active "$dep" 2>/dev/null || systemctl is-active "${dep}-server" 2>/dev/null || echo "not found")
    if [ "$status" = "active" ]; then
        icon="✅"
    else
        icon="⭕"
    fi
    printf "%-30s %s %s\n" "$dep" "$icon" "$status"
done

echo ""
echo "=== Быстрые команды ==="
echo "  Логи API:    sudo journalctl -u koordinator-api -f"
echo "  Логи Celery: sudo journalctl -u koordinator-celery -f"
echo "  Restart:     sudo systemctl restart koordinator-api"
