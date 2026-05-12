# TradingAgents Integration

This package is the VELTRIX orchestration bridge for the TradingAgents runtime.

## Goals
- Analyst agent orchestration
- Bullish vs bearish debate trees
- Risk manager gating
- Portfolio manager decision synthesis
- Timeline checkpoints and decision memory

## Local setup
1. Install optional backend dependency group:
   - `pip install -e backend[agents]`
2. Configure backend environment variables:
   - `TRADINGAGENTS_ENABLED=true`
   - `TRADINGAGENTS_CHECKPOINT_DIR=./tradingagents/checkpoints`
3. Use API route:
   - `POST /api/v1/agents/debate`

The current implementation includes a stable adapter boundary and payload contract compatible with frontend debate visualization.
