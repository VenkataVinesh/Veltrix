# 🦅 VELTRIX: Institutional AI Trading & Portfolio Optimization Platform

VELTRIX is an advanced, multi-tier quantitative research and automated trading execution platform. It integrates a responsive, high-fidelity **Next.js (TypeScript) Dashboard** with a high-performance **FastAPI (Python) Backend** to solve portfolio allocations, track machine learning price forecasts, and execute trades through autonomous agent adapters.

---

## 🚀 Platform Capabilities

*   **Portfolio Optimization Engines**: Solves Markowitz Mean-Variance Frontiers and maximizes Sharpe ratios using SciPy mathematical solvers based on historical covariance matrices.
*   **Deep Time-Series Forecasting**: Machine learning models designed to forecast directional assets and rolling volatility regimes.
*   **Autonomous Trading Agents**: Multi-agent trading adapter loops (`tradingagents/adapter.py`) with programmatic audit hooks, database storage transactions, and execution logging.
*   **Real-time Telemetry & WebSockets**: Structured WebSockets channels for streaming live asset price metrics, order books, and active agent statuses.
*   **Full-Stack TypeScript & Python**: Dual-workspace orchestration utilizing a Next.js App Router client and a FastAPI API service.

---

## 📂 System Architecture
```
Veltrix/
├── app/                  # Next.js (TypeScript) Dashboard Pages (App Router)
│   ├── dashboard/        # Performance, charts, and allocator dashboard
│   ├── stocks/           # OHLC asset views and ML predictions
│   └── globals.css       # Tailwind stylesheet
├── backend/              # FastAPI Python Web Services & ML Engine
│   ├── app/              # API endpoints, routers, database schemas, and websockets
│   ├── ml/               # Quantitative forecasting models and training pipelines
│   ├── migrations/       # Alembic relational DB migration schemas
│   └── bootstrap.py      # System check and database seeding routine
├── tradingagents/        # Autonomous Trade Execution Agents
│   ├── adapter.py        # Core agent execution loops, transaction logic, and logs
│   └── README.md         # Agent behavior details
├── docker/               # Multi-container service orchestrations
├── public/               # UI static assets and icons
├── tsconfig.json         # TypeScript configurations
└── package.json          # Next.js dependencies
```

---

## 🛠️ Quick Start Setup

For complete configurations, environment setups, and troubleshooting, refer to **[SETUP.md](SETUP.md)**.

### 1. Python Backend Setup
Initialize your virtual environment, install dev dependencies, and seed your local database:
```bash
cd backend
python -m pip install -r requirements-dev.txt
python bootstrap.py            # Checks configuration and seeds demo users
python -m uvicorn app.main:app --reload --port 8000
```
*   **Interactive Swagger API Docs**: Open `http://localhost:8000/docs`

### 2. Next.js Frontend Setup
Install frontend dependencies and launch the hot-reloading development server:
```bash
# From root directory
npm install
npm run dev
```
*   **Live Dashboard**: Open `http://localhost:3001`

### 🔐 Seeded Test Accounts
The `bootstrap.py` script automatically seeds the local SQLite/PostgreSQL database with standard testing credentials:

| Role | Username / Email | Password |
|---|---|---|
| **System Administrator** | `admin@veltrix.ai` | `Admin123!` |
| **Trader Account** | `demo@veltrix.ai` | `Demo123!` |

---

## 📊 Quantitative Mechanics
The portfolio optimization service leverages daily asset prices to calculate the expected return vector $\mu$ and covariance matrix $\Sigma$:

1.  **Expected Return**:
    $$\mu_i = \mathbb{E}[R_i]$$
2.  **Portfolio Variance**:
    $$\sigma_p^2 = w^T \Sigma w$$
3.  **Sharpe Ratio Maximization**:
    $$\max_{w} \frac{w^T \mu - R_f}{\sqrt{w^T \Sigma w}} \quad \text{subject to} \quad \sum w_i = 1, \quad w_i \ge 0$$
    *Optimization parameters are solved using Sequential Least Squares Programming (SLSQP) constraints inside SciPy.*

---

## 🐋 Production Deployment
The workspace is configured for multi-container Docker deployments. You can run the database, caching layer, trading agent engine, backend service, and frontend client in harmony:
```bash
# Deploy local multi-service container grid
docker-compose -f docker/docker-compose.yml up --build
```
The production configurations support:
*   **PostgreSQL** as the core relational ledger database.
*   **Redis** for message caching and event queues.
*   **Nginx** for reverse proxy load balancing.
