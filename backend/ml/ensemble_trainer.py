"""
Ensemble ML model trainer combining LSTM, XGBoost, and Prophet forecasting models.
Trains and persists models for real-time market prediction.
"""

from __future__ import annotations

import json
import pickle
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np

from app.core.logging import get_logger

logger = get_logger("veltrix.ml.ensemble")

MODELS_DIR = Path(__file__).parent / "artifacts"
MODELS_DIR.mkdir(exist_ok=True)


class LSTMModel:
    """LSTM model for sequence forecasting."""
    
    def __init__(self, symbol: str, lookback: int = 20):
        self.symbol = symbol
        self.lookback = lookback
        self.model = None
        self.scaler_params = None
        self.version = datetime.utcnow().isoformat()
        
    def train(self, prices: list[float]) -> dict:
        """Train LSTM model on historical prices."""
        try:
            import tensorflow as tf
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import LSTM, Dense, Dropout
            from tensorflow.keras.optimizers import Adam
            
            if len(prices) < self.lookback + 5:
                return {"status": "insufficient_data", "samples": len(prices)}
            
            # Normalize prices
            prices_array = np.array(prices, dtype=np.float32)
            min_price, max_price = prices_array.min(), prices_array.max()
            self.scaler_params = {"min": float(min_price), "max": float(max_price)}
            normalized = (prices_array - min_price) / (max_price - min_price + 1e-6)
            
            # Build sequences
            X, y = [], []
            for i in range(len(normalized) - self.lookback):
                X.append(normalized[i:i+self.lookback])
                y.append(normalized[i+self.lookback])
            
            if len(X) < 5:
                return {"status": "insufficient_sequences", "sequences": len(X)}
            
            X_train = np.array(X).reshape(-1, self.lookback, 1)
            y_train = np.array(y)
            
            # Build model
            self.model = Sequential([
                LSTM(32, activation='relu', input_shape=(self.lookback, 1)),
                Dropout(0.2),
                Dense(16, activation='relu'),
                Dropout(0.2),
                Dense(1, activation='sigmoid')
            ])
            
            self.model.compile(optimizer=Adam(learning_rate=0.001), loss='mse')
            history = self.model.fit(X_train, y_train, epochs=20, batch_size=4, verbose=0)
            
            return {
                "status": "trained",
                "samples": len(X),
                "loss": float(history.history['loss'][-1]),
                "epochs": 20
            }
        except ImportError:
            logger.warning("TensorFlow not available; using deterministic LSTM fallback")
            return {"status": "fallback", "reason": "tensorflow_unavailable"}
    
    def predict(self, recent_prices: list[float], steps: int = 1) -> dict:
        """Predict next price(s)."""
        if self.model is None or self.scaler_params is None:
            # Fallback: use mean + trend
            if len(recent_prices) >= 2:
                trend = (recent_prices[-1] - recent_prices[-2]) / recent_prices[-2]
                next_price = recent_prices[-1] * (1 + trend * 0.5)
                return {"next_price": float(next_price), "confidence": 0.55, "method": "fallback_trend"}
            return {"next_price": float(recent_prices[-1]), "confidence": 0.4, "method": "fallback_last"}
        
        try:
            prices_array = np.array(recent_prices[-self.lookback:], dtype=np.float32)
            min_p, max_p = self.scaler_params["min"], self.scaler_params["max"]
            normalized = (prices_array - min_p) / (max_p - min_p + 1e-6)
            
            if len(normalized) < self.lookback:
                normalized = np.pad(normalized, (self.lookback - len(normalized), 0), 'edge')
            
            X_pred = normalized[-self.lookback:].reshape(1, self.lookback, 1)
            pred_norm = self.model.predict(X_pred, verbose=0)[0, 0]
            pred_price = pred_norm * (max_p - min_p) + min_p
            
            return {
                "next_price": float(pred_price),
                "confidence": 0.63,
                "method": "lstm"
            }
        except Exception as e:
            logger.warning(f"LSTM prediction failed: {e}")
            next_price = recent_prices[-1] * 1.002
            return {"next_price": float(next_price), "confidence": 0.5, "method": "fallback_lstm_error"}
    
    def save(self, path: Path = None) -> str:
        """Save model to disk."""
        path = path or MODELS_DIR / f"lstm_{self.symbol}.pkl"
        path.parent.mkdir(exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'scaler_params': self.scaler_params,
                'version': self.version,
                'symbol': self.symbol
            }, f)
        logger.info(f"LSTM model saved to {path}")
        return str(path)


class XGBoostModel:
    """XGBoost model for market prediction."""
    
    def __init__(self, symbol: str):
        self.symbol = symbol
        self.model = None
        self.feature_names = None
        self.version = datetime.utcnow().isoformat()
    
    def train(self, prices: list[float]) -> dict:
        """Train XGBoost model."""
        try:
            import xgboost as xgb
            
            if len(prices) < 30:
                return {"status": "insufficient_data", "samples": len(prices)}
            
            # Build features: momentum, volatility, trend
            features = []
            targets = []
            
            for i in range(10, len(prices) - 1):
                momentum = (prices[i] - prices[i-5]) / prices[i-5]
                volatility = np.std(prices[i-10:i])
                trend = (prices[i] - prices[i-10]) / prices[i-10]
                rsi = self._calculate_rsi(prices[:i+1])
                
                features.append([momentum, volatility, trend, rsi])
                targets.append(1.0 if prices[i+1] > prices[i] else 0.0)
            
            if len(features) < 5:
                return {"status": "insufficient_features", "count": len(features)}
            
            X = np.array(features)
            y = np.array(targets)
            
            self.feature_names = ["momentum", "volatility", "trend", "rsi"]
            self.model = xgb.XGBClassifier(n_estimators=50, max_depth=4, learning_rate=0.1, random_state=42)
            self.model.fit(X, y)
            
            return {
                "status": "trained",
                "samples": len(features),
                "score": float(self.model.score(X, y))
            }
        except ImportError:
            logger.warning("XGBoost not available; using fallback")
            return {"status": "fallback", "reason": "xgboost_unavailable"}
    
    def predict(self, recent_prices: list[float]) -> dict:
        """Predict price direction."""
        if self.model is None:
            return {"next_price": float(recent_prices[-1] * 1.001), "confidence": 0.5, "method": "fallback_xgb"}
        
        try:
            momentum = (recent_prices[-1] - recent_prices[-6]) / recent_prices[-6]
            volatility = np.std(recent_prices[-10:])
            trend = (recent_prices[-1] - recent_prices[-10]) / recent_prices[-10]
            rsi = self._calculate_rsi(recent_prices)
            
            X_pred = np.array([[momentum, volatility, trend, rsi]])
            prob_up = self.model.predict_proba(X_pred)[0, 1]
            
            # Translate probability to price move
            price_move = (prob_up - 0.5) * 0.02  # Max 2% move
            next_price = recent_prices[-1] * (1 + price_move)
            
            return {
                "next_price": float(next_price),
                "confidence": float(max(prob_up, 1 - prob_up)),
                "method": "xgboost"
            }
        except Exception as e:
            logger.warning(f"XGBoost prediction failed: {e}")
            return {"next_price": float(recent_prices[-1] * 1.001), "confidence": 0.5, "method": "fallback_xgb_error"}
    
    @staticmethod
    def _calculate_rsi(prices: list[float], period: int = 14) -> float:
        """Calculate RSI indicator."""
        if len(prices) < period:
            return 50.0
        
        changes = np.diff(prices[-period-1:])
        gains = np.mean(np.maximum(changes, 0))
        losses = np.mean(np.abs(np.minimum(changes, 0)))
        
        if losses == 0:
            return 100.0 if gains > 0 else 50.0
        
        rs = gains / losses
        rsi = 100 - (100 / (1 + rs))
        return float(rsi)
    
    def save(self, path: Path = None) -> str:
        """Save model to disk."""
        path = path or MODELS_DIR / f"xgboost_{self.symbol}.pkl"
        path.parent.mkdir(exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'feature_names': self.feature_names,
                'version': self.version,
                'symbol': self.symbol
            }, f)
        logger.info(f"XGBoost model saved to {path}")
        return str(path)


class ProphetModel:
    """Prophet model for time series forecasting."""
    
    def __init__(self, symbol: str):
        self.symbol = symbol
        self.model = None
        self.version = datetime.utcnow().isoformat()
    
    def train(self, prices: list[float], dates: list[datetime] = None) -> dict:
        """Train Prophet model."""
        try:
            from prophet import Prophet
            
            if len(prices) < 30:
                return {"status": "insufficient_data", "samples": len(prices)}
            
            if dates is None:
                dates = [datetime.utcnow() - timedelta(days=len(prices)-i-1) for i in range(len(prices))]
            
            # Prepare dataframe
            df_data = [{
                'ds': d,
                'y': float(p)
            } for d, p in zip(dates[-90:], prices[-90:])]
            
            import pandas as pd
            df = pd.DataFrame(df_data)
            
            self.model = Prophet(yearly_seasonality=False, daily_seasonality=False, interval_width=0.95)
            self.model.fit(df)
            
            return {
                "status": "trained",
                "samples": len(df),
                "method": "prophet"
            }
        except ImportError:
            logger.warning("Prophet not available; using fallback")
            return {"status": "fallback", "reason": "prophet_unavailable"}
    
    def predict(self, recent_prices: list[float]) -> dict:
        """Predict next price."""
        if self.model is None:
            avg_return = np.mean(np.diff(recent_prices) / recent_prices[:-1])
            next_price = recent_prices[-1] * (1 + avg_return)
            return {"next_price": float(next_price), "confidence": 0.58, "method": "fallback_prophet"}
        
        try:
            future = self.model.make_future_dataframe(periods=1)
            forecast = self.model.predict(future)
            
            next_price = float(forecast.iloc[-1]['yhat'])
            return {
                "next_price": next_price,
                "confidence": 0.58,
                "method": "prophet"
            }
        except Exception as e:
            logger.warning(f"Prophet prediction failed: {e}")
            return {"next_price": float(recent_prices[-1] * 1.001), "confidence": 0.5, "method": "fallback_prophet_error"}
    
    def save(self, path: Path = None) -> str:
        """Save model to disk."""
        path = path or MODELS_DIR / f"prophet_{self.symbol}.pkl"
        path.parent.mkdir(exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'version': self.version,
                'symbol': self.symbol
            }, f)
        logger.info(f"Prophet model saved to {path}")
        return str(path)


class EnsembleForecaster:
    """Combines LSTM, XGBoost, and Prophet for robust forecasts."""
    
    def __init__(self, symbol: str):
        self.symbol = symbol
        self.lstm = LSTMModel(symbol)
        self.xgb = XGBoostModel(symbol)
        self.prophet = ProphetModel(symbol)
        self.version = datetime.utcnow().isoformat()
    
    def train_all(self, prices: list[float]) -> dict:
        """Train all three models."""
        if len(prices) < 30:
            logger.warning(f"Insufficient data for {self.symbol}: {len(prices)} points")
            return {
                "symbol": self.symbol,
                "status": "insufficient_data",
                "prices_count": len(prices)
            }
        
        logger.info(f"Training ensemble for {self.symbol} with {len(prices)} price points")
        
        lstm_result = self.lstm.train(prices)
        xgb_result = self.xgb.train(prices)
        prophet_result = self.prophet.train(prices)
        
        return {
            "symbol": self.symbol,
            "status": "trained",
            "lstm": lstm_result,
            "xgboost": xgb_result,
            "prophet": prophet_result,
            "version": self.version
        }
    
    def forecast(self, recent_prices: list[float]) -> dict:
        """Generate ensemble forecast."""
        lstm_pred = self.lstm.predict(recent_prices)
        xgb_pred = self.xgb.predict(recent_prices)
        prophet_pred = self.prophet.predict(recent_prices)
        
        # Weighted ensemble average
        predictions = [
            lstm_pred["next_price"],
            xgb_pred["next_price"],
            prophet_pred["next_price"]
        ]
        
        # Use confidence as weights
        confidences = [
            lstm_pred["confidence"],
            xgb_pred["confidence"],
            prophet_pred["confidence"]
        ]
        
        total_conf = sum(confidences)
        ensemble_price = sum(p * c for p, c in zip(predictions, confidences)) / total_conf if total_conf > 0 else np.mean(predictions)
        ensemble_confidence = np.mean(confidences)
        
        # Calculate ensemble trend
        current_price = recent_prices[-1]
        move_pct = ((ensemble_price / current_price) - 1.0) * 100 if current_price > 0 else 0.0
        
        # Trend probability
        if move_pct > 0.5:
            up_prob = 0.65
            down_prob = 0.25
        elif move_pct < -0.5:
            up_prob = 0.25
            down_prob = 0.65
        else:
            up_prob = 0.40
            down_prob = 0.40
        
        sideways_prob = max(0.0, 1.0 - up_prob - down_prob)
        
        return {
            "symbol": self.symbol,
            "ensemble_price": float(ensemble_price),
            "expected_move_pct": float(move_pct),
            "ensemble_confidence": float(ensemble_confidence),
            "models": {
                "lstm": lstm_pred,
                "xgboost": xgb_pred,
                "prophet": prophet_pred
            },
            "trend_probability": {
                "up": float(up_prob),
                "down": float(down_prob),
                "sideways": float(sideways_prob)
            }
        }
    
    def save_all(self, base_path: Path = None) -> dict:
        """Save all models."""
        base_path = base_path or MODELS_DIR
        base_path.mkdir(exist_ok=True)
        
        return {
            "lstm": self.lstm.save(base_path / f"lstm_{self.symbol}.pkl"),
            "xgboost": self.xgb.save(base_path / f"xgboost_{self.symbol}.pkl"),
            "prophet": self.prophet.save(base_path / f"prophet_{self.symbol}.pkl"),
        }


def train_ensemble(symbol: str, prices: list[float]) -> dict:
    """Convenience function to train ensemble and save models."""
    forecaster = EnsembleForecaster(symbol)
    result = forecaster.train_all(prices)
    
    if result["status"] == "trained":
        saved_paths = forecaster.save_all()
        result["saved_paths"] = saved_paths
    
    return result
