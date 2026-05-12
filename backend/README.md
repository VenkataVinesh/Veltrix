# Veltrix Backend

FastAPI service with modular domains, SQLite/PostgreSQL persistence, optional Redis pub/sub, JWT auth, and websocket market streaming.

## Quick start for local development

1. Copy `backend/.env.example` to `backend/.env`
2. Install dependencies with `pip install -r requirements-dev.txt`
3. Start the API with `python -m uvicorn app.main:app --reload --port 8000`
4. API docs: `http://localhost:8000/docs`

The backend now boots with SQLite by default, creates tables automatically, and seeds default users on first startup.

## Default local credentials

- Admin: `admin@veltrix.ai` / `Admin123!`
- Demo: `demo@veltrix.ai` / `Demo123!`

## Optional infrastructure

- Redis: optional for cache/pubsub
- PostgreSQL: optional for production
- Celery: optional for background workers

## Structure

- `app/api`: Route modules by domain
- `app/core`: Config, security, shared dependencies
- `app/db`: SQLAlchemy models/session and migration-ready metadata
- `app/services`: Business services (signals, market stream, copilot)
- `app/ws`: WebSocket connection manager and channels
- `ml`: Training + inference service contracts for production pipelines
