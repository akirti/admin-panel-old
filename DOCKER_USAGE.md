# Docker Usage Guide

## Quick Start

### Start all services (production)
```bash
docker-compose up -d
```

### Start with dev tools (Mailpit + Mongo Express)
```bash
docker-compose --profile dev up -d
```

### Build and start (after code changes)
```bash
docker-compose up -d --build
```

## Service Management

### View logs
```bash
docker-compose logs -f              # All services
docker-compose logs -f backend      # Backend only
docker-compose logs -f frontend     # Frontend only
docker-compose logs -f mongodb      # MongoDB only
```

### Check service status
```bash
docker-compose ps
```

### Restart a specific service
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Stop all services
```bash
docker-compose down
```

### Stop and remove volumes (clean reset)
```bash
docker-compose down -v
```

## Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | React admin panel |
| Backend API | http://localhost:8000 | FastAPI backend |
| API Docs | http://localhost:8000/docs | Swagger UI |
| Mongo Express | http://localhost:8081 | Database UI (dev profile) |
| Mailpit UI | http://localhost:8025 | Email testing UI (dev profile) |

## Environment Variables

You can customize the setup by creating a `.env` file in the project root:

```env
# MongoDB
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=password123
MONGO_DATABASE=easylife_auth
MONGO_PORT=27017

# Backend
BACKEND_PORT=8000
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production
TOKEN_TIMEOUT=30

# Frontend
FRONTEND_PORT=3000

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Mongo Express (dev)
MONGO_EXPRESS_USERNAME=admin
MONGO_EXPRESS_PASSWORD=admin123
MONGO_EXPRESS_PORT=8081

# Mailpit (dev)
MAILPIT_SMTP_PORT=1025
MAILPIT_WEB_PORT=8025
```

## Services Overview

| Service | Container Name | Image |
|---------|---------------|-------|
| MongoDB | easylife-mongodb | mongo:7.0 |
| Backend | easylife-backend | Custom (FastAPI) |
| Frontend | easylife-frontend | Custom (React + Nginx) |
| Mailpit | easylife-mailpit | axllent/mailpit (dev) |
| Mongo Express | easylife-mongo-express | mongo-express (dev) |

## Troubleshooting

### Check if services are healthy
```bash
docker-compose ps
```

### View container resource usage
```bash
docker stats
```

### Access MongoDB shell
```bash
docker exec -it easylife-mongodb mongosh -u admin -p password123
```

### Access backend container shell
```bash
docker exec -it easylife-backend /bin/bash
```

### Rebuild a specific service
```bash
docker-compose build backend
docker-compose up -d backend
```

### Clear Docker cache and rebuild
```bash
docker-compose build --no-cache
docker-compose up -d
```

## Data Persistence

MongoDB data is persisted in a Docker volume named `mongodb_data`. To backup:

```bash
docker exec easylife-mongodb mongodump --uri="mongodb://admin:password123@localhost:27017" --out=/dump
docker cp easylife-mongodb:/dump ./backup
```

To restore:
```bash
docker cp ./backup easylife-mongodb:/dump
docker exec easylife-mongodb mongorestore --uri="mongodb://admin:password123@localhost:27017" /dump
```
