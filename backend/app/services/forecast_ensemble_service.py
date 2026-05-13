from __future__ import annotations

import pickle
from pathlib import Path
from statistics import mean, pstdev

from app.core.logging import get_logger
from app.services.market_service import get_ohlc
from ml.ensemble_trainer import EnsembleForecaster, MODELS_DIR

logger = get_logger("veltrix.forecast_ensemble")


class ForecastEnsembleService:
    def __init__(self):
        self.models_cache = {}
    
    def _load_or_create_ensemble(self, symbol: str) -> EnsembleForecaster:
        """Load persisted ensemble or create new one."""
        if symbol in self.models_cache:
            return self.models_cache[symbol]
        
        forecaster = EnsembleForecaster(symbol)
        
        # Try to load existing models
        lstm_path = MODELS_DIR / f"lstm_{symbol}.pkl"
        xgb_path = MODELS_DIR / f"xgboost_{symbol}.pkl"
        prophet_path = MODELS_DIR / f"prophet_{symbol}.pkl"
        
        try:
            if lstm_path.exists():
                with open(lstm_path, 'rb') as f:
                    data = pickle.load(f)
                    forecaster.lstm.model = data.get('model')
                    forecaster.lstm.scaler_params = data.get('scaler_params')
                    logger.info(f"Loaded LSTM model for {symbol}")
        except Exception as e:
            logger.warning(f"Failed to load LSTM model for {symbol}: {e}")
        
        try:
            if xgb_path.exists():
                with open(xgb_path, 'rb') as f:
                    data = pickle.load(f)
                    forecaster.xgb.model = data.get('model')
                    forecaster.xgb.feature_names = data.get('feature_names')
                    logger.info(f"Loaded XGBoost model for {symbol}")
        except Exception as e:
            logger.warning(f"Failed to load XGBoost model for {symbol}: {e}")
        
        try:
            if prophet_path.exists():
                with open(prophet_path, 'rb') as f:
                    data = pickle.load(f)
                    forecaster.prophet.model = data.get('model')
                    logger.info(f"Loaded Prophet model for {symbol}")
        except Exception as e:
            logger.warning(f"Failed to load Prophet model for {symbol}: {e}")
        
        self.models_cache[symbol] = forecaster
        return forecaster
    
    async def build_forecast(self, symbol: str, timeframe: str = '1d') -> dict:
        payload = await get_ohlc(symbol, timeframe)
        points = payload.get('points', [])
        closes = [float(point.get('c', 0.0)) for point in points if float(point.get('c', 0.0)) > 0]

        if len(closes) < 10:
            return {
                'symbol': symbol.upper(),
                'timeframe': timeframe,
                'models': {
                    'lstm': {'next_price': 0.0, 'confidence': 0.0},
                    'xgboost': {'next_price': 0.0, 'confidence': 0.0},
                    'prophet': {'next_price': 0.0, 'confidence': 0.0},
                },
                'ensemble': {
                    'expected_price': 0.0,
                    'expected_move_pct': 0.0,
                    'confidence_interval': [0.0, 0.0],
                    'trend_probability': {'up': 0.0, 'down': 0.0, 'sideways': 1.0},
                },
                'volatility_cone': [],
                'support_resistance': {'support': 0.0, 'resistance': 0.0},
            }

        # Load or create ensemble forecaster
        forecaster = self._load_or_create_ensemble(symbol.upper())
        
        # Train if no models exist
        if (forecaster.lstm.model is None and 
            forecaster.xgb.model is None and 
            forecaster.prophet.model is None):
            logger.info(f"Training ensemble for {symbol}")
            forecaster.train_all(closes)
        
        # Generate ensemble forecast
        ensemble_result = forecaster.forecast(closes)
        
        # Calculate volatility cone
        latest = closes[-1]
        vol = pstdev(closes[-20:]) if len(closes) >= 20 else pstdev(closes)
        cone = []
        for horizon in [5, 10, 20, 30, 60]:
            cone.append({
                'horizon_days': horizon,
                'lower': round(latest - (vol * (horizon ** 0.5)), 4),
                'upper': round(latest + (vol * (horizon ** 0.5)), 4),
            })
        
        # Calculate support/resistance
        support = min(closes[-20:]) if len(closes) >= 20 else min(closes)
        resistance = max(closes[-20:]) if len(closes) >= 20 else max(closes)
        
        # Confidence interval (95%)
        ensemble_price = ensemble_result['ensemble_price']
        ci = [ensemble_price - (1.96 * vol), ensemble_price + (1.96 * vol)]

        return {
            'symbol': symbol.upper(),
            'timeframe': timeframe,
            'models': {
                'lstm': {
                    'next_price': round(ensemble_result['models']['lstm']['next_price'], 4),
                    'confidence': round(ensemble_result['models']['lstm']['confidence'], 2)
                },
                'xgboost': {
                    'next_price': round(ensemble_result['models']['xgboost']['next_price'], 4),
                    'confidence': round(ensemble_result['models']['xgboost']['confidence'], 2)
                },
                'prophet': {
                    'next_price': round(ensemble_result['models']['prophet']['next_price'], 4),
                    'confidence': round(ensemble_result['models']['prophet']['confidence'], 2)
                },
            },
            'ensemble': {
                'expected_price': round(ensemble_result['ensemble_price'], 4),
                'expected_move_pct': round(ensemble_result['expected_move_pct'], 4),
                'confidence_interval': [round(ci[0], 4), round(ci[1], 4)],
                'trend_probability': ensemble_result['trend_probability'],
            },
            'volatility_cone': cone,
            'support_resistance': {'support': round(support, 4), 'resistance': round(resistance, 4)},
            'source': payload.get('source', 'unknown'),
            'ensemble_confidence': round(ensemble_result['ensemble_confidence'], 2),
        }
