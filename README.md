# 🦅 VELTRIX: Algorithmic Trading Dashboard & Backtesting Platform

VELTRIX is an interactive, full-stack quantitative research and algorithmic strategy backtesting platform. It integrates a responsive, high-fidelity **Next.js (TypeScript) Dashboard** with a high-performance **FastAPI (Python) Backend** to compute portfolio allocations, generate technical trading signals, and run backtest simulations.

---

## 🚀 Key Platform Capabilities

*   **Portfolio Optimization Solver**: Computes Markowitz Mean-Variance Frontiers and maximizes Sharpe ratios using SciPy mathematical solvers based on historical daily covariance matrices.
*   **Rule-Based Signal Engines**: Evaluates rule-based technical indicators (Simple/Exponential Moving Averages, RSI momentum crossovers) on historical daily OHLCV datasets.
*   **Autonomous Agent Loop**: Contains modular agent adapters (`tradingagents/adapter.py`) with programmatic audit hooks, SQLite/PostgreSQL database logging, and transaction audits.
*   **Real-time WebSocket Telemetry**: Stream price metrics, execution logs, and active agent statuses using full-duplex WebSocket channels.
*   **Containerized Multi-Service Stack**: Docker orchestrations mapping the Next.js client, FastAPI server, PostgreSQL ledger, and Redis pubsub event cache.

---

## 📊 Detailed System Architecture

The following diagram illustrates the data flow, endpoints, and subsystem interactions across the VELTRIX environment:

```mermaid
graph TD
    %% Styling
    classDef client fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef server fill:#0f172a,stroke:#0d9488,stroke-width:2px,color:#f8fafc;
    classDef agent fill:#0f172a,stroke:#f59e0b,stroke-width:2px,color:#f8fafc;
    classDef db fill:#0f172a,stroke:#6366f1,stroke-width:2px,color:#f8fafc;
    classDef math fill:#0f172a,stroke:#ec4899,stroke-width:2px,color:#f8fafc;

    subgraph ClientLayer ["Frontend Client (Port: 3001)"]
        UI["React Dashboard (Recharts UI)"]
        WSClient["WebSocket Client (Real-Time Streams)"]
    end
    
    subgraph ServerLayer ["FastAPI Service (Port: 8000)"]
        Router["FastAPI Router / Swagger Docs"]
        WSServer["WebSocket Server Router"]
        Loader["Data Loader (Pandas DataFrames)"]
    end

    subgraph OptimizationLayer ["Quantitative Mechanics"]
        SciPy["SciPy SLSQP Optimizer"]
        Stats["Covariance & Expected Returns"]
    end

    subgraph AgentLayer ["Autonomous Agent Subsystem"]
        Loop["tradingagents/adapter.py Loop"]
        Audit["Programmatic Audit Hooks"]
    end

    subgraph StorageLayer ["Data & Cache Services"]
        SQL["Relational Ledgers (SQLite/PostgreSQL)"]
        Redis["Message Cache & Event Queue (Redis)"]
    end

    %% Relations
    UI -->|HTTP Requests| Router
    WSClient <-->|Full-Duplex WebSockets| WSServer
    
    Router --> Loader
    Loader -->|OHLCV historical data| SciPy
    SciPy --> Stats
    
    Router --> SQL
    Loop --> SQL
    WSServer <--> Redis
    
    Loop --> Audit
    Router --> Loop
    
    %% Apply Styling
    class UI,WSClient ClientLayer;
    class Router,WSServer,Loader ServerLayer;
    class Loop,Audit AgentLayer;
    class SQL,Redis StorageLayer;
    class SciPy,Stats OptimizationLayer;
```

### Subsystems Breakdown

| Component | Directory / File | Description | Tech Stack |
|---|---|---|---|
| **Frontend** | `app/` | Dashboard interface, stock chart views, optimization parameters. | Next.js, TS, Tailwind CSS |
| **Backend** | `backend/app/` | API routing, DB models, WebSocket connections. | FastAPI, Python, SQLAlchemy |
| **Quant Engine** | `backend/ml/` | Mathematical solvers, covariance computations, features. | SciPy, NumPy, Pandas |
| **Execution Loop**| `tradingagents/` | Agent transaction loops and event generators. | Python, JSON logging |
| **Infrastructure** | `docker/` | Service orchestration grids and database configurations. | Docker Compose, Redis, PG |

---

## 🛠️ Local Development Quick Start

Get the VELTRIX workspace running locally in under five minutes.

### 1. Start Python Backend Service
Navigate to the backend directory, configure dependencies, seed data, and boot the ASGI web server:
```bash
cd backend
python -m venv venv
source venv/Scripts/activate     # Use venv\Scripts\activate on Windows
python -m pip install -r requirements-dev.txt
python bootstrap.py              # Asserts configuration and seeds sqlite DB
python -m uvicorn app.main:app --reload --port 8000
```
*   **Swagger Documentation**: Interact with API endpoints at `http://localhost:8000/docs`

### 2. Start Next.js Frontend Client
Install node modules and start the local development server:
```bash
# Run from root directory
npm install
npm run dev
```
*   **Live Dashboard**: Open `http://localhost:3001` in your browser.

### 🔐 Seeding & Test Accounts
The `bootstrap.py` checks your local environments and automatically seeds these credentials for quick interface verification:

| User Role | Username / Email | Password | Database |
|---|---|---|---|
| **System Administrator** | `admin@veltrix.ai` | `Admin123!` | SQLite / PostgreSQL |
| **Standard Trader** | `demo@veltrix.ai` | `Demo123!` | SQLite / PostgreSQL |

---

## 📈 Quantitative & Optimization Mechanics

VELTRIX runs mathematical solvers to optimize portfolio allocation weights. Given a historical Daily Price Returns Matrix, the platform computes:

1.  **Expected Assets Returns Vector ($\mu_i$):**
    $$\mu_i = \frac{1}{N} \sum_{t=1}^{N} R_{i, t}$$
2.  **Portfolio Variance ($\sigma_p^2$):**
    $$\sigma_p^2 = w^T \Sigma w$$
    Where $w$ is the portfolio weights vector and $\Sigma$ is the covariance matrix of daily asset returns.
3.  **Sharpe Ratio Maximization:**
    $$\max_{w} \frac{w^T \mu - R_f}{\sqrt{w^T \Sigma w}} \quad \text{subject to} \quad \sum_{i} w_i = 1, \quad 0 \le w_i \le 1$$
    *Portfolio minimization parameters (maximizing negative Sharpe ratio) are solved using Sequential Least Squares Programming (SLSQP) constraints inside SciPy.*

---

## 🐋 Production Deployment (Docker Grid)

The workspace is pre-configured to run on a multi-container Docker compose grid. This spawns the FastAPI backend, Next.js client, PostgreSQL database, and Redis cache/event bus in harmony:

```bash
# Build and start the service containers
docker-compose -f docker/docker-compose.yml up --build
```
*   **PostgreSQL**: Handles persistent ledger tables, position audits, and signal history.
*   **Redis**: Powers WebSocket channel publishing and model query caching.
