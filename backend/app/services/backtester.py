from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.services.market_providers import provider_orchestrator
from app.services.market_service import get_ohlc


class VectorizedBacktester:
    """Vectorized backtesting engine using Pandas/NumPy.

    Simulates strategy execution (SMA/EMA Crossover), transaction costs,
    and slippage on historical daily datasets.
    """

    def __init__(
        self,
        symbol: str,
        points: List[Dict[str, Any]],
        initial_capital: float = 100000.0,
        transaction_cost: float = 0.0005,  # 5 bps
        slippage: float = 0.0002,           # 2 bps
        risk_free_rate: float = 0.04
    ) -> None:
        self.symbol = symbol.upper()
        self.points = points
        self.initial_capital = initial_capital
        self.tc = transaction_cost
        self.slippage = slippage
        self.risk_free_rate = risk_free_rate

    def run_crossover(
        self,
        fast_window: int = 20,
        slow_window: int = 50,
        ma_type: str = "sma",
        direction_type: str = "long_only"
    ) -> Dict[str, Any]:
        """Runs a Moving Average Crossover strategy backtest."""
        if not self.points or len(self.points) < max(fast_window, slow_window) + 5:
            return self._build_empty_result()

        # Build DataFrame
        df = pd.DataFrame(self.points)
        df['t'] = pd.to_datetime(df['t'])
        df = df.sort_values('t').reset_index(drop=True)
        for col in ['o', 'h', 'l', 'c', 'v']:
            df[col] = pd.to_numeric(df[col], errors='coerce').astype(float)
        df = df.dropna(subset=['c'])

        if len(df) < max(fast_window, slow_window) + 5:
            return self._build_empty_result()

        # Calculate Moving Averages
        if ma_type.lower() == "ema":
            df['fast_ma'] = df['c'].ewm(span=fast_window, adjust=False).mean()
            df['slow_ma'] = df['c'].ewm(span=slow_window, adjust=False).mean()
        else:
            df['fast_ma'] = df['c'].rolling(window=fast_window).mean()
            df['slow_ma'] = df['c'].rolling(window=slow_window).mean()

        # Drop initial rows with NaNs in MAs
        df = df.dropna(subset=['fast_ma', 'slow_ma']).reset_index(drop=True)

        # Generate signals
        # Signal is 1 if Fast MA > Slow MA, else 0 (long-only) or -1 (long-short)
        df['signal'] = np.where(df['fast_ma'] > df['slow_ma'], 1, 0)
        if direction_type.lower() == "long_short":
            df['signal'] = np.where(df['fast_ma'] > df['slow_ma'], 1, -1)

        # Shift signals by 1 day to prevent look-ahead bias (trade at next day open/close)
        df['positions'] = df['signal'].shift(1).fillna(0)

        # Calculate returns
        df['market_returns'] = df['c'].pct_change().fillna(0)
        df['strategy_returns'] = df['positions'] * df['market_returns']

        # Determine trades and apply transaction costs + slippage
        # Trade occurs when position changes
        df['trades'] = df['positions'].diff().abs().fillna(0)
        df['transaction_costs'] = df['trades'] * (self.tc + self.slippage)
        df['net_returns'] = df['strategy_returns'] - df['transaction_costs']

        # Cumulative performance
        df['cum_market_returns'] = (1 + df['market_returns']).cumprod()
        df['cum_strategy_returns'] = (1 + df['net_returns']).cumprod()
        df['portfolio_value'] = df['cum_strategy_returns'] * self.initial_capital

        # Calculate trade-level metrics (wins, losses)
        trade_signals = df[df['trades'] > 0]
        num_trades = int(df['trades'].sum())
        
        # Performance Statistics
        total_market_return = float(df['cum_market_returns'].iloc[-1] - 1.0) if len(df) > 0 else 0.0
        total_strategy_return = float(df['cum_strategy_returns'].iloc[-1] - 1.0) if len(df) > 0 else 0.0

        daily_std = float(df['net_returns'].std())
        daily_mean = float(df['net_returns'].mean())
        annualized_vol = daily_std * math.sqrt(252)
        annualized_return = (1 + total_strategy_return) ** (252 / len(df)) - 1.0 if len(df) > 0 else 0.0

        # Sharpe ratio
        daily_rf = self.risk_free_rate / 252
        excess_returns = df['net_returns'] - daily_rf
        sharpe_ratio = float((excess_returns.mean() / daily_std) * math.sqrt(252)) if daily_std > 1e-9 else 0.0

        # Sortino ratio (downside deviation)
        downside_returns = np.where(df['net_returns'] < daily_rf, df['net_returns'] - daily_rf, 0.0)
        downside_std = float(np.std(downside_returns)) * math.sqrt(252)
        sortino_ratio = float((excess_returns.mean() * 252) / downside_std) if downside_std > 1e-9 else 0.0

        # Max Drawdown
        rolling_max = df['portfolio_value'].cummax()
        drawdowns = (df['portfolio_value'] - rolling_max) / rolling_max
        max_drawdown = float(drawdowns.min())

        # Win Rate calculation
        # We define a trade's return based on positive returns during holding periods
        trade_returns = []
        in_position = False
        entry_price = 0.0
        pos_dir = 0
        for idx, row in df.iterrows():
            pos = row['positions']
            price = row['c']
            if pos != 0 and not in_position:
                entry_price = price
                pos_dir = pos
                in_position = True
            elif pos == 0 and in_position:
                exit_price = price
                trade_ret = (exit_price - entry_price) / entry_price * pos_dir
                trade_returns.append(trade_ret)
                in_position = False
            elif pos != 0 and in_position and pos != pos_dir:
                exit_price = price
                trade_ret = (exit_price - entry_price) / entry_price * pos_dir
                trade_returns.append(trade_ret)
                entry_price = price
                pos_dir = pos

        win_rate = 0.0
        if trade_returns:
            wins = sum(1 for r in trade_returns if r > 0)
            win_rate = float(wins / len(trade_returns))

        # Format equity curve for UI plotting
        equity_curve = [
            {
                "date": row['t'].strftime("%Y-%m-%d"),
                "portfolio_value": round(float(row['portfolio_value']), 2),
                "market_value": round(float(row['cum_market_returns'] * self.initial_capital), 2)
            }
            for _, row in df.iterrows()
        ]

        return {
            "symbol": self.symbol,
            "metrics": {
                "total_return_pct": round(total_strategy_return * 100, 2),
                "market_return_pct": round(total_market_return * 100, 2),
                "annualized_return_pct": round(annualized_return * 100, 2),
                "annualized_volatility_pct": round(annualized_vol * 100, 2),
                "sharpe_ratio": round(sharpe_ratio, 3),
                "sortino_ratio": round(sortino_ratio, 3),
                "max_drawdown_pct": round(max_drawdown * 100, 2),
                "win_rate_pct": round(win_rate * 100, 2),
                "total_trades": num_trades
            },
            "equity_curve": equity_curve
        }

    def _build_empty_result(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "metrics": {
                "total_return_pct": 0.0,
                "market_return_pct": 0.0,
                "annualized_return_pct": 0.0,
                "annualized_volatility_pct": 0.0,
                "sharpe_ratio": 0.0,
                "sortino_ratio": 0.0,
                "max_drawdown_pct": 0.0,
                "win_rate_pct": 0.0,
                "total_trades": 0
            },
            "equity_curve": []
        }


async def run_backtest(
    symbol: str,
    timeframe: str = "1d",
    fast_window: int = 20,
    slow_window: int = 50,
    ma_type: str = "sma",
    direction_type: str = "long_only"
) -> Dict[str, Any]:
    """Helper method to load OHLC and execute backtest."""
    # Fetch historical daily data
    provider_points = await provider_orchestrator.get_ohlc(symbol, timeframe)
    if provider_points:
        points = provider_points
    else:
        fallback = await get_ohlc(symbol, timeframe=timeframe)
        points = fallback.get("points", [])

    backtester = VectorizedBacktester(symbol=symbol, points=points)
    return backtester.run_crossover(
        fast_window=fast_window,
        slow_window=slow_window,
        ma_type=ma_type,
        direction_type=direction_type
    )
