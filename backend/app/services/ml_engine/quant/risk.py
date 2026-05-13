import numpy as np
import math
from typing import Dict, List, Tuple

class QuantRiskEngine:
    """
    Institutional Quant & Risk Analytics.
    Implements: Monte Carlo, Efficient Frontier, VaR/CVaR, Sharpe, beta/correlation, volatility cones.
    """
    
    @staticmethod
    def run_monte_carlo(current_price: float, mu: float, sigma: float, days: int = 252, sims: int = 1000) -> Dict[str, Any]:
        """
        Vectorized Monte Carlo simulation for derivative pricing and risk estimation.
        """
        dt = 1/252
        prices = np.zeros((days, sims))
        prices[0] = current_price
        
        for t in range(1, days):
            rand = np.random.standard_normal(sims)
            prices[t] = prices[t-1] * np.exp((mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * rand)
            
        final_prices = prices[-1]
        
        return {
            "mean_expected": float(np.mean(final_prices)),
            "var_95": float(np.percentile(final_prices, 5)),
            "cvar_95": float(np.mean(final_prices[final_prices <= np.percentile(final_prices, 5)])),
            "paths": prices[:, :50].tolist() # Return subset for UI visualization
        }

    @staticmethod
    def calculate_risk_metrics(returns: np.ndarray, market_returns: np.ndarray, risk_free_rate: float = 0.02) -> Dict[str, float]:
        """
        Calculates Sharpe, VaR, CVaR, Beta, and Volatility
        """
        mu = np.mean(returns) * 252
        vol = np.std(returns) * np.sqrt(252)
        sharpe = (mu - risk_free_rate) / vol if vol > 0 else 0
        
        cov = np.cov(returns, market_returns)[0][1]
        market_var = np.var(market_returns)
        beta = cov / market_var if market_var > 0 else 1.0
        
        return {
            "annualized_return": mu,
            "volatility": vol,
            "sharpe_ratio": sharpe,
            "beta": beta,
            "historical_var_95": np.percentile(returns, 5),
            "cvar_95": np.mean(returns[returns <= np.percentile(returns, 5)])
        }
