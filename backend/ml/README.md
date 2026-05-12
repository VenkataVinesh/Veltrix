# ML Service Architecture

Production layout for forecasting, anomaly detection, sentiment, risk and optimization.

- `features/`: Feature engineering pipelines
- `training/`: Train jobs for LSTM, Transformer, XGBoost, RandomForest, LightGBM
- `inference/`: Model loading and unified prediction API
- `registry/`: Model metadata/versioning contracts
