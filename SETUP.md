# VELTRIX Local Development Setup Guide

**Institutional AI Trading Platform**

This guide helps you set up the VELTRIX platform locally for development and testing.

## Prerequisites

- **Python 3.11+** (download from [python.org](https://www.python.org))
- **Node.js 18+** (download from [nodejs.org](https://www.nodejs.org))
- **npm** (comes with Node.js)
- **Git**

## Quick Start (5 minutes)

### Backend

```bash
cd backend
python -m pip install -r requirements-dev.txt
python bootstrap.py  # Verify setup
python -m uvicorn app.main:app --reload --port 8000
```

✅ Backend runs on: http://localhost:8000  
📚 API docs: http://localhost:8000/docs

### Frontend

```bash
npm install
npm run dev
```

✅ Frontend runs on: http://localhost:3001

## Default Test Accounts

After starting the backend, these accounts are automatically seeded:

| Email | Password | Role |
|-------|----------|------|
| `admin@veltrix.ai` | `Admin123!` | Admin |
| `demo@veltrix.ai` | `Demo123!` | Trader |

Use these credentials to log in at http://localhost:3001/login

## Environment Setup

### Backend (.env file)

Located at: `backend/.env`

```
FRONTEND_URL=http://localhost:3001
DATABASE_URL=sqlite:///./veltrix.db
JWT_SECRET=your-secret-key-change-in-production
REDIS_URL=redis://localhost:6379  # Optional - leave blank to skip
```

### Frontend (.env file)

Located at: `.env`

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000/api/v1/stream
```

## Common Tasks

### Run Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
npm test
```

### Start with Fresh Database

```bash
# Delete SQLite database (will be recreated on startup)
rm backend/veltrix.db

# Restart backend
cd backend
python -m uvicorn app.main:app --reload
```

### Access PostgreSQL (if available)

Update `backend/.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/veltrix
```

### Enable Redis Locally

```bash
# Install Redis locally or run Docker:
docker run -d -p 6379:6379 redis:latest

# Update backend/.env:
REDIS_URL=redis://localhost:6379

# Restart backend
```

### Enable Celery Workers

```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

## Troubleshooting

### Port Already in Use

```bash
# Change backend port:
python -m uvicorn app.main:app --reload --port 8001

# Change frontend port:
PORT=3002 npm run dev
```

### Module Not Found

```bash
# Reinstall dependencies
pip install -e .
```

### CORS Errors

Check that `FRONTEND_URL` in `backend/.env` matches your frontend URL:
- Dev: `http://localhost:3001`
- Production: Your actual domain

### Redis Connection Error

Redis is optional. If not available, the system logs a warning and continues.

## Architecture Overview

```
Frontend (Next.js/React)        Backend (FastAPI)
localhost:3001                  localhost:8000
├─ Authentication               ├─ Auth endpoints
├─ Dashboard & Views            ├─ Market data
├─ Real-time updates (WebSocket)├─ Signals engine
└─ Portfolio Management         └─ AI Copilot

        ↔ REST API + WebSocket
        
SQLite Database (local dev)
- Users
- Portfolios & Positions
- Signals & Predictions
- Chat history
```

## Database Schema

The following tables are automatically created on startup:

- `users` - User accounts and authentication
- `portfolios` - User portfolios
- `positions` - Stock positions
- `watchlists` - Watched symbols
- `ai_signals` - Trading signals
- `predictions` - Price predictions
- `ai_conversations` - Chat history
- `notifications` - User notifications
- And more...

## Performance Tips

1. **Use Redis** for caching and WebSocket pubsub (3-5x faster)
2. **Use PostgreSQL** instead of SQLite for production
3. **Enable Celery** for background tasks
4. **Monitor logs** for any warnings or errors

## Getting Help

- Check logs: Both services log to console and can be written to files
- Run bootstrap: `python backend/bootstrap.py` verifies all systems
- Review API docs: http://localhost:8000/docs (auto-generated from code)

## Next Steps

- [x] Setup complete
- [ ] Login with test account
- [ ] Explore dashboard
- [ ] Test WebSocket connections
- [ ] Review API endpoints
- [ ] Start development

---

**Questions?** Check the code comments or review the architecture documentation.
