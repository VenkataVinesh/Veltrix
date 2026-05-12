from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable
import json
import math
import statistics

import numpy as np
import pandas as pd

MODEL_ARTIFACT_DIR = Path(__file__).resolve().parent / 'artifacts'
MODEL_ARTIFACT_PATH = MODEL_ARTIFACT_DIR / 'signal_model.json'
DEFAULT_FEATURE_COLUMNS = [
    'return_1',
    'return_3',
    'return_5',
    'return_10',
    'log_return_1',
    'range_pct',
    'body_pct',
    'upper_wick_pct',
    'lower_wick_pct',
    'volume_z_10',
    'volume_z_20',
    'volatility_5',
    'volatility_10',
    'volatility_20',
    'momentum_5',
    'momentum_10',
    'trend_slope_10',
    'trend_slope_20',
    'sma_5_gap',
    'sma_20_gap',
    'ema_12_gap',
    'ema_20_gap',
    'macd_line',
    'macd_signal',
    'macd_histogram',
    'rsi_14',
    'bollinger_bandwidth',
    'atr_14_pct',
    'drawdown_20',
    'price_to_high_20',
    'price_to_low_20',
    'avg_range_10',
    'avg_range_20',
]

HORIZON_TO_STEPS = {
    '1d': 1,
    '7d': 5,
    '30d': 20,
}


@dataclass
class TrainingDataset:
    features: np.ndarray
    labels: np.ndarray
    targets: np.ndarray
    feature_names: list[str]
    symbols: list[str]
    horizons: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            'features': self.features.tolist(),
            'labels': self.labels.tolist(),
            'targets': self.targets.tolist(),
            'feature_names': self.feature_names,
            'symbols': self.symbols,
            'horizons': self.horizons,
        }


@dataclass
class SignalModelBundle:
    model_name: str
    version: str
    feature_names: list[str]
    feature_mean: list[float]
    feature_scale: list[float]
    weights: list[float]
    bias: float
    threshold: float
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> 'SignalModelBundle':
        return cls(
            model_name=payload['model_name'],
            version=payload['version'],
            feature_names=list(payload['feature_names']),
            feature_mean=list(payload['feature_mean']),
            feature_scale=list(payload['feature_scale']),
            weights=list(payload['weights']),
            bias=float(payload['bias']),
            threshold=float(payload.get('threshold', 0.5)),
            metadata=dict(payload.get('metadata', {})),
        )


class MarketFeaturePipeline:
    @staticmethod
    def _safe_series(series: pd.Series) -> pd.Series:
        return pd.to_numeric(series, errors='coerce').astype(float)

    @staticmethod
    def _sma(series: pd.Series, period: int) -> pd.Series:
        return series.rolling(period).mean()

    @staticmethod
    def _ema(series: pd.Series, period: int) -> pd.Series:
        return series.ewm(span=period, adjust=False).mean()

    @staticmethod
    def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
        delta = series.diff()
        gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False).mean()
        loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False).mean()
        rs = gain / loss.replace(0, np.nan)
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(50.0)

    @staticmethod
    def _atr(frame: pd.DataFrame, period: int = 14) -> pd.Series:
        high_low = frame['h'] - frame['l']
        high_close = (frame['h'] - frame['c'].shift(1)).abs()
        low_close = (frame['l'] - frame['c'].shift(1)).abs()
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        return true_range.rolling(period).mean()

    @staticmethod
    def _slope(series: pd.Series, period: int) -> pd.Series:
        values = series.to_numpy(dtype=float)
        output = np.full(len(values), np.nan)
        window_x = np.arange(period, dtype=float)
        x_mean = window_x.mean()
        x_denom = ((window_x - x_mean) ** 2).sum() or 1.0
        for index in range(period - 1, len(values)):
            window = values[index + 1 - period:index + 1]
            if np.isnan(window).any():
                continue
            y_mean = window.mean()
            numerator = ((window - y_mean) * (window_x - x_mean)).sum()
            output[index] = numerator / x_denom
        return pd.Series(output, index=series.index)

    @staticmethod
    def _volume_zscore(series: pd.Series, period: int) -> pd.Series:
        mean = series.rolling(period).mean()
        std = series.rolling(period).std(ddof=0).replace(0, np.nan)
        return ((series - mean) / std).replace([np.inf, -np.inf], np.nan)

    @classmethod
    def build_frame(cls, points: list[dict[str, Any]]) -> pd.DataFrame:
        if not points:
            return pd.DataFrame(columns=['t', 'o', 'h', 'l', 'c', 'v'])

        frame = pd.DataFrame(points).copy()
        for column in ['o', 'h', 'l', 'c', 'v']:
            frame[column] = cls._safe_series(frame[column])
        frame = frame.sort_values('t').reset_index(drop=True)

        frame['return_1'] = frame['c'].pct_change(1)
        frame['return_3'] = frame['c'].pct_change(3)
        frame['return_5'] = frame['c'].pct_change(5)
        frame['return_10'] = frame['c'].pct_change(10)
        frame['log_return_1'] = np.log(frame['c'] / frame['c'].shift(1))

        candle_range = (frame['h'] - frame['l']).replace(0, np.nan)
        frame['range_pct'] = candle_range / frame['c']
        frame['body_pct'] = (frame['c'] - frame['o']) / candle_range
        frame['upper_wick_pct'] = (frame['h'] - frame[['o', 'c']].max(axis=1)) / candle_range
        frame['lower_wick_pct'] = (frame[['o', 'c']].min(axis=1) - frame['l']) / candle_range

        frame['volume_z_10'] = cls._volume_zscore(frame['v'], 10)
        frame['volume_z_20'] = cls._volume_zscore(frame['v'], 20)
        frame['volatility_5'] = frame['return_1'].rolling(5).std(ddof=0)
        frame['volatility_10'] = frame['return_1'].rolling(10).std(ddof=0)
        frame['volatility_20'] = frame['return_1'].rolling(20).std(ddof=0)
        frame['momentum_5'] = frame['c'].pct_change(5)
        frame['momentum_10'] = frame['c'].pct_change(10)

        frame['trend_slope_10'] = cls._slope(frame['c'], 10)
        frame['trend_slope_20'] = cls._slope(frame['c'], 20)
        frame['sma_5'] = cls._sma(frame['c'], 5)
        frame['sma_20'] = cls._sma(frame['c'], 20)
        frame['ema_12'] = cls._ema(frame['c'], 12)
        frame['ema_20'] = cls._ema(frame['c'], 20)
        frame['ema_26'] = cls._ema(frame['c'], 26)
        frame['macd_line'] = frame['ema_12'] - frame['ema_26']
        frame['macd_signal'] = cls._ema(frame['macd_line'], 9)
        frame['macd_histogram'] = frame['macd_line'] - frame['macd_signal']
        frame['rsi_14'] = cls._rsi(frame['c'], 14)

        rolling_mean = frame['c'].rolling(20).mean()
        rolling_std = frame['c'].rolling(20).std(ddof=0)
        frame['bollinger_upper'] = rolling_mean + (rolling_std * 2)
        frame['bollinger_lower'] = rolling_mean - (rolling_std * 2)
        frame['bollinger_bandwidth'] = (frame['bollinger_upper'] - frame['bollinger_lower']) / frame['c']

        frame['atr_14'] = cls._atr(frame, 14)
        frame['atr_14_pct'] = frame['atr_14'] / frame['c']
        frame['drawdown_20'] = (frame['c'] / frame['c'].rolling(20).max()) - 1
        frame['price_to_high_20'] = frame['c'] / frame['h'].rolling(20).max()
        frame['price_to_low_20'] = frame['c'] / frame['l'].rolling(20).min()
        frame['avg_range_10'] = candle_range.rolling(10).mean() / frame['c']
        frame['avg_range_20'] = candle_range.rolling(20).mean() / frame['c']
        frame['sma_5_gap'] = frame['c'] / frame['sma_5'] - 1
        frame['sma_20_gap'] = frame['c'] / frame['sma_20'] - 1
        frame['ema_12_gap'] = frame['c'] / frame['ema_12'] - 1
        frame['ema_20_gap'] = frame['c'] / frame['ema_20'] - 1

        frame = frame.replace([np.inf, -np.inf], np.nan)
        return frame

    @staticmethod
    def feature_columns() -> list[str]:
        return list(DEFAULT_FEATURE_COLUMNS)

    @classmethod
    def build_dataset(
        cls,
        symbol_points: dict[str, list[dict[str, Any]]],
        horizon: str = '1d',
        threshold: float = 0.002,
    ) -> TrainingDataset:
        horizon_steps = HORIZON_TO_STEPS.get(horizon.lower(), 1)
        features: list[list[float]] = []
        labels: list[int] = []
        targets: list[float] = []
        symbols: list[str] = []
        horizons: list[str] = []

        for symbol, points in symbol_points.items():
            frame = cls.build_frame(points)
            if frame.empty:
                continue
            future_return = frame['c'].shift(-horizon_steps) / frame['c'] - 1
            sample_frame = frame.copy()
            sample_frame['future_return'] = future_return
            sample_frame = sample_frame.dropna(subset=DEFAULT_FEATURE_COLUMNS + ['future_return'])
            if sample_frame.empty:
                continue
            for _, row in sample_frame.iterrows():
                feature_row = [float(row[column]) for column in DEFAULT_FEATURE_COLUMNS]
                future = float(row['future_return'])
                features.append(feature_row)
                labels.append(1 if future > threshold else 0)
                targets.append(future)
                symbols.append(symbol)
                horizons.append(horizon)

        if not features:
            empty = np.zeros((0, len(DEFAULT_FEATURE_COLUMNS)), dtype=float)
            return TrainingDataset(empty, np.zeros(0, dtype=int), np.zeros(0, dtype=float), DEFAULT_FEATURE_COLUMNS, [], [])

        return TrainingDataset(
            features=np.asarray(features, dtype=float),
            labels=np.asarray(labels, dtype=int),
            targets=np.asarray(targets, dtype=float),
            feature_names=DEFAULT_FEATURE_COLUMNS,
            symbols=symbols,
            horizons=horizons,
        )


def _sigmoid(values: np.ndarray) -> np.ndarray:
    clipped = np.clip(values, -40, 40)
    return 1.0 / (1.0 + np.exp(-clipped))


@dataclass
class LinearSignalModel:
    feature_names: list[str]
    feature_mean: np.ndarray
    feature_scale: np.ndarray
    weights: np.ndarray
    bias: float
    threshold: float = 0.5
    model_name: str = 'veltrix_linear_signal'
    version: str = '1.0.0'
    metadata: dict[str, Any] | None = None

    @classmethod
    def create(cls, feature_names: list[str], metadata: dict[str, Any] | None = None) -> 'LinearSignalModel':
        size = len(feature_names)
        return cls(
            feature_names=feature_names,
            feature_mean=np.zeros(size, dtype=float),
            feature_scale=np.ones(size, dtype=float),
            weights=np.zeros(size, dtype=float),
            bias=0.0,
            threshold=0.5,
            metadata=metadata or {},
        )

    def fit(self, features: np.ndarray, labels: np.ndarray, epochs: int = 300, learning_rate: float = 0.08, l2: float = 0.001) -> dict[str, float]:
        if len(features) == 0:
            return {'loss': 0.0, 'accuracy': 0.0}

        self.feature_mean = features.mean(axis=0)
        self.feature_scale = features.std(axis=0)
        self.feature_scale[self.feature_scale == 0] = 1.0
        normalized = (features - self.feature_mean) / self.feature_scale

        weights = self.weights.copy()
        bias = float(self.bias)

        for _ in range(epochs):
            logits = normalized @ weights + bias
            probabilities = _sigmoid(logits)
            error = probabilities - labels
            gradient_w = (normalized.T @ error) / len(normalized) + (l2 * weights)
            gradient_b = float(error.mean())
            weights -= learning_rate * gradient_w
            bias -= learning_rate * gradient_b

        self.weights = weights
        self.bias = bias
        scores = self.predict_probability(features)
        predictions = (scores >= self.threshold).astype(int)
        accuracy = float((predictions == labels).mean()) if len(labels) else 0.0
        loss = float(np.mean(-(labels * np.log(scores + 1e-8) + (1 - labels) * np.log(1 - scores + 1e-8))))
        return {'loss': loss, 'accuracy': accuracy}

    def predict_probability(self, features: np.ndarray) -> np.ndarray:
        if features.ndim == 1:
            features = features.reshape(1, -1)
        normalized = (features - self.feature_mean) / self.feature_scale
        logits = normalized @ self.weights + self.bias
        return _sigmoid(logits)

    def predict_row(self, feature_row: list[float]) -> float:
        probability = self.predict_probability(np.asarray(feature_row, dtype=float))[0]
        return float(probability)

    def to_dict(self) -> dict[str, Any]:
        return {
            'model_name': self.model_name,
            'version': self.version,
            'feature_names': self.feature_names,
            'feature_mean': self.feature_mean.tolist(),
            'feature_scale': self.feature_scale.tolist(),
            'weights': self.weights.tolist(),
            'bias': self.bias,
            'threshold': self.threshold,
            'metadata': self.metadata or {},
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> 'LinearSignalModel':
        bundle = SignalModelBundle.from_dict(payload)
        return cls(
            feature_names=bundle.feature_names,
            feature_mean=np.asarray(bundle.feature_mean, dtype=float),
            feature_scale=np.asarray(bundle.feature_scale, dtype=float),
            weights=np.asarray(bundle.weights, dtype=float),
            bias=float(bundle.bias),
            threshold=float(bundle.threshold),
            model_name=bundle.model_name,
            version=bundle.version,
            metadata=bundle.metadata,
        )

    def save(self, path: Path = MODEL_ARTIFACT_PATH) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('w', encoding='utf-8') as handle:
            json.dump(self.to_dict(), handle, indent=2)
        return path

    @classmethod
    def load(cls, path: Path = MODEL_ARTIFACT_PATH) -> 'LinearSignalModel | None':
        if not path.exists():
            return None
        with path.open('r', encoding='utf-8') as handle:
            payload = json.load(handle)
        return cls.from_dict(payload)


@dataclass
class PredictionResult:
    symbol: str
    horizon: str
    direction: str
    bullish_probability: float
    bearish_probability: float
    neutral_probability: float
    confidence: float
    expected_return_pct: float
    target_price: float
    target_range_low: float
    target_range_high: float
    stop_price: float
    volatility_pct: float
    anomaly_score: float
    model_version: str
    feature_snapshot: dict[str, float]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _anomaly_score(feature_row: list[float]) -> float:
    values = np.asarray(feature_row, dtype=float)
    values = np.nan_to_num(values, nan=0.0, posinf=0.0, neginf=0.0)
    scale = np.maximum(np.abs(values).mean(), 1e-6)
    score = float(np.clip(np.abs(values).mean() / (scale * 3), 0.0, 1.0))
    return score


def train_signal_model(dataset: TrainingDataset, model_name: str = 'veltrix_linear_signal', version: str = '1.0.0') -> tuple[LinearSignalModel, dict[str, float]]:
    model = LinearSignalModel.create(dataset.feature_names, metadata={
        'samples': int(len(dataset.labels)),
        'features': len(dataset.feature_names),
        'labels_positive': int(dataset.labels.sum()) if len(dataset.labels) else 0,
    })
    model.model_name = model_name
    model.version = version
    metrics = model.fit(dataset.features, dataset.labels)
    return model, metrics


def build_feature_snapshot(feature_row: Iterable[float], feature_names: list[str]) -> dict[str, float]:
    return {name: float(value) for name, value in zip(feature_names, feature_row)}


def predict_signal_from_points(
    symbol: str,
    timeframe: str,
    points: list[dict[str, Any]],
    model: LinearSignalModel | None = None,
) -> PredictionResult:
    frame = MarketFeaturePipeline.build_frame(points)
    if frame.empty:
        return PredictionResult(
            symbol=symbol,
            horizon=timeframe,
            direction='HOLD',
            bullish_probability=0.5,
            bearish_probability=0.5,
            neutral_probability=1.0,
            confidence=0.0,
            expected_return_pct=0.0,
            target_price=0.0,
            target_range_low=0.0,
            target_range_high=0.0,
            stop_price=0.0,
            volatility_pct=0.0,
            anomaly_score=0.0,
            model_version='fallback',
            feature_snapshot={},
        )

    latest = frame.dropna(subset=DEFAULT_FEATURE_COLUMNS).tail(1)
    if latest.empty:
        latest = frame.fillna(0.0).tail(1)
    latest_row = latest.iloc[0]
    feature_row = [float(latest_row[column]) for column in DEFAULT_FEATURE_COLUMNS]
    current_price = float(latest_row['c'])
    volatility_pct = float(max(latest_row.get('volatility_20', 0.0) or 0.0, latest_row.get('atr_14_pct', 0.0) or 0.0))

    loaded_model = model or LinearSignalModel.load()
    if loaded_model is None:
        loaded_model = LinearSignalModel.create(DEFAULT_FEATURE_COLUMNS)

    bullish_probability = float(np.clip(loaded_model.predict_row(feature_row), 0.01, 0.99))
    bearish_probability = float(np.clip(1.0 - bullish_probability, 0.01, 0.99))
    neutral_probability = float(np.clip(1.0 - abs(bullish_probability - bearish_probability), 0.0, 1.0))

    momentum_hint = float(np.tanh((latest_row['macd_histogram'] or 0.0) * 2.0 + (latest_row['rsi_14'] - 50.0) / 35.0))
    blended_score = (bullish_probability - bearish_probability) * 0.7 + momentum_hint * 0.3
    confidence = float(np.clip(abs(blended_score), 0.05, 0.98))

    if blended_score > 0.12:
        direction = 'BUY'
    elif blended_score < -0.12:
        direction = 'SELL'
    else:
        direction = 'HOLD'

    expected_return_pct = float(blended_score * max(volatility_pct * 100 * 1.8, 0.75))
    target_price = current_price * (1.0 + expected_return_pct / 100.0)
    target_range_low = target_price * (1.0 - max(volatility_pct, 0.01))
    target_range_high = target_price * (1.0 + max(volatility_pct, 0.01))
    stop_price = current_price * (1.0 - max(volatility_pct * 1.5, 0.01)) if direction != 'SELL' else current_price * (1.0 + max(volatility_pct * 1.5, 0.01))
    anomaly_score = _anomaly_score(feature_row)

    return PredictionResult(
        symbol=symbol,
        horizon=timeframe,
        direction=direction,
        bullish_probability=round(bullish_probability, 4),
        bearish_probability=round(bearish_probability, 4),
        neutral_probability=round(neutral_probability, 4),
        confidence=round(confidence, 4),
        expected_return_pct=round(expected_return_pct, 3),
        target_price=round(target_price, 2),
        target_range_low=round(target_range_low, 2),
        target_range_high=round(target_range_high, 2),
        stop_price=round(stop_price, 2),
        volatility_pct=round(volatility_pct * 100, 3),
        anomaly_score=round(anomaly_score, 4),
        model_version=loaded_model.version,
        feature_snapshot=build_feature_snapshot(feature_row, DEFAULT_FEATURE_COLUMNS),
    )


build_training_dataset = MarketFeaturePipeline.build_dataset
