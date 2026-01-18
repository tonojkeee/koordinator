# 🚀 Развёртывание ГИС «КООРДИНАТОР»

Инструкции по настройке автозапуска всех сервисов.

---

## Структура папки

```
deploy/
├── docker/                   # Docker deployment
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── Dockerfile.celery
│   ├── docker-compose.yml
│   ├── nginx.frontend.conf
│   ├── .env.example
│   ├── build.sh
│   └── start.sh
├── systemd/                  # Systemd unit файлы
│   ├── koordinator-api.service
│   ├── koordinator-celery.service
│   ├── koordinator-celery-beat.service
│   └── koordinator-smtp.service
├── scripts/                  # Скрипты управления
│   ├── start-all.sh
│   ├── stop-all.sh
│   ├── status.sh
│   └── install-services.sh
├── nginx/                    # Конфигурация nginx
│   └── koordinator.conf
└── README.md                 # Эта инструкция
```

---

## 🐳 Docker (рекомендуется)

Самый быстрый способ запуска:

```bash
cd deploy/docker

# 1. Настроить переменные окружения
cp .env.example .env
nano .env  # Изменить SECRET_KEY и пароли!

# 2. Собрать и запустить
./start.sh

# Или вручную:
docker compose up -d
```

### Docker команды

```bash
docker compose ps              # Статус
docker compose logs -f api     # Логи API
docker compose logs -f         # Все логи
docker compose down            # Остановка
docker compose down -v         # Остановка + удаление данных
```

### Endpoints (Docker)

| URL | Описание |
|-----|----------|
| http://localhost | Frontend |
| http://localhost:8000 | API |
| http://localhost:8000/health | Health check |
| http://localhost:8000/metrics | Prometheus |

---
├── scripts/                  # Скрипты управления
│   ├── start-all.sh
│   ├── stop-all.sh
│   ├── status.sh
│   └── install-services.sh
├── nginx/                    # Конфигурация nginx
│   └── koordinator.conf
└── README.md                 # Эта инструкция
```

---

## Быстрый старт

### 1. Установка зависимостей

```bash
# Redis (для multi-worker и Celery)
sudo apt update
sudo apt install redis-server nginx

# Запуск Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 2. Настройка окружения

```bash
cd /home/tonojkeee/projects/main/backend

# Скопировать и настроить .env
cp .env.example .env

# Редактировать .env
nano .env
```

Минимальная конфигурация `.env`:
```bash
SECRET_KEY=your-secure-random-key-here
DEBUG=false
DATABASE_URL=mysql+aiomysql://user:pass@localhost:3306/koordinator
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=https://your-domain.com
```

### 3. Установка сервисов

```bash
cd /home/tonojkeee/projects/main/deploy
chmod +x scripts/*.sh

# Установить systemd сервисы
sudo ./scripts/install-services.sh
```

### 4. Запуск

```bash
# Запустить все сервисы
sudo systemctl start koordinator-api
sudo systemctl start koordinator-celery
sudo systemctl start koordinator-celery-beat

# Или через скрипт
./scripts/start-all.sh
```

---

## Сервисы

| Сервис | Порт | Описание |
|--------|------|----------|
| koordinator-api | 8000 | FastAPI backend |
| koordinator-celery | — | Background worker |
| koordinator-celery-beat | — | Periodic tasks |
| koordinator-smtp | 2525 | SMTP сервер (опционально) |

---

## Управление

```bash
# Статус всех сервисов
./scripts/status.sh

# Логи API
sudo journalctl -u koordinator-api -f

# Логи Celery
sudo journalctl -u koordinator-celery -f

# Перезапуск API
sudo systemctl restart koordinator-api
```

---

## Nginx (reverse proxy)

```bash
# Скопировать конфигурацию
sudo cp nginx/koordinator.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/koordinator.conf /etc/nginx/sites-enabled/

# Проверить и перезагрузить
sudo nginx -t
sudo systemctl reload nginx
```

---

## MySQL

```bash
# Установка
sudo apt install mysql-server

# Создание базы
sudo mysql -e "CREATE DATABASE koordinator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'koordinator'@'localhost' IDENTIFIED BY 'your-password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON koordinator.* TO 'koordinator'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# Миграция с Alembic
cd /home/tonojkeee/projects/main/backend
source venv/bin/activate
alembic upgrade head
```

---

## Мониторинг

| Endpoint | Описание |
|----------|----------|
| `http://localhost:8000/health` | Health check |
| `http://localhost:8000/metrics` | Prometheus метрики |

### Prometheus + Grafana

```yaml
# prometheus.yml - добавить job
scrape_configs:
  - job_name: 'koordinator'
    static_configs:
      - targets: ['localhost:8000']
```

---

## Troubleshooting

### API не запускается
```bash
# Проверить логи
sudo journalctl -u koordinator-api -n 50

# Проверить .env
cat /home/tonojkeee/projects/main/backend/.env
```

### Celery не обрабатывает задачи
```bash
# Проверить Redis
redis-cli ping

# Проверить логи Celery
sudo journalctl -u koordinator-celery -n 50
```

### Ошибки подключения к MySQL
```bash
# Проверить MySQL
sudo systemctl status mysql

# Проверить подключение
mysql -u koordinator -p -e "SELECT 1"
```
