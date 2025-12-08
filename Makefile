.PHONY: help build up down dev dev-down logs clean restart shell-backend shell-frontend shell-mongo test

# Default target
help:
	@echo "EasyLife Admin Panel - Docker Commands"
	@echo ""
	@echo "Production Commands:"
	@echo "  make build      - Build all Docker images"
	@echo "  make up         - Start all services (production)"
	@echo "  make down       - Stop all services"
	@echo "  make restart    - Restart all services"
	@echo "  make logs       - View logs from all services"
	@echo ""
	@echo "Development Commands:"
	@echo "  make dev        - Start development environment (with hot reload)"
	@echo "  make dev-down   - Stop development environment"
	@echo "  make dev-logs   - View development logs"
	@echo ""
	@echo "Utility Commands:"
	@echo "  make shell-backend   - Open shell in backend container"
	@echo "  make shell-frontend  - Open shell in frontend container"
	@echo "  make shell-mongo     - Open MongoDB shell"
	@echo "  make clean           - Remove all containers, images, and volumes"
	@echo "  make test            - Run tests"
	@echo ""
	@echo "First Time Setup:"
	@echo "  1. Copy .env.example to .env and update values"
	@echo "  2. Run 'make dev' for development or 'make up' for production"
	@echo "  3. Access the app at http://localhost:3000 (or 5173 for dev)"
	@echo "  4. Default admin: admin@easylife.local (change password!)"

# ===================
# Production Commands
# ===================

build:
	docker-compose build

up:
	docker-compose up -d
	@echo ""
	@echo "Services started!"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:8000"
	@echo "  API Docs: http://localhost:8000/api/v1/docs"

down:
	docker-compose down

restart: down up

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

# ===================
# Development Commands
# ===================

dev:
	docker-compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "Development environment started!"
	@echo "  App (via Nginx):     http://localhost:3000"
	@echo "  Frontend (Vite):     http://localhost:5173"
	@echo "  Backend API:         http://localhost:8000"
	@echo "  API Docs:            http://localhost:8000/api/v1/docs"
	@echo "  MailHog:             http://localhost:8025"
	@echo "  Mongo Express:       http://localhost:8081"
	@echo ""
	@echo "  Recommended: Use http://localhost:3000 for development"
	@echo "  (Nginx handles API proxying correctly)"

dev-down:
	docker-compose -f docker-compose.dev.yml down

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

dev-restart: dev-down dev

# ===================
# Utility Commands
# ===================

shell-backend:
	docker-compose exec backend /bin/sh

shell-frontend:
	docker-compose exec frontend /bin/sh

shell-mongo:
	docker-compose exec mongodb mongosh -u admin -p password123

clean:
	docker-compose down -v --rmi all --remove-orphans
	docker-compose -f docker-compose.dev.yml down -v --rmi all --remove-orphans
	@echo "Cleaned up all containers, images, and volumes"

# ===================
# Testing
# ===================

test:
	docker-compose exec backend pytest -v

test-coverage:
	docker-compose exec backend pytest --cov=easylifeauth --cov-report=html

# ===================
# Database
# ===================

db-backup:
	docker-compose exec mongodb mongodump --uri="mongodb://admin:password123@localhost:27017" --out=/data/backup
	docker cp easylife-mongodb:/data/backup ./backup
	@echo "Database backed up to ./backup"

db-restore:
	docker cp ./backup easylife-mongodb:/data/backup
	docker-compose exec mongodb mongorestore --uri="mongodb://admin:password123@localhost:27017" /data/backup
	@echo "Database restored from ./backup"

# ===================
# Production with dev tools
# ===================

up-with-tools:
	docker-compose --profile dev up -d
	@echo ""
	@echo "Services started with development tools!"
	@echo "  Frontend:      http://localhost:3000"
	@echo "  Backend:       http://localhost:8000"
	@echo "  Mailpit:       http://localhost:8025"
	@echo "  Mongo Express: http://localhost:8081"
