import asyncio
from app.services.market_service import get_ohlc
from ml.feature_pipeline import build_feature_snapshot, build_training_dataset, train_signal_model
from app.db.session import SessionLocal

async def main():
    symbols = ["SPY", "AAPL", "MSFT", "NVDA", "QQQ"]
    horizons = ["1d"]
    
    print("Fetching data for training...")
    symbol_points = {}
    for symbol in symbols:
        try:
            ohlc = await get_ohlc(symbol, "1d")
            points = ohlc.get("points", [])
            if points:
                symbol_points[symbol] = points
                print(f"Fetched {len(points)} points for {symbol}")
            else:
                print(f"No points for {symbol}")
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
            
    if not symbol_points:
        print("No data fetched. Cannot train.")
        return
        
    print("Building dataset...")
    dataset = build_training_dataset(symbol_points, horizon="1d")
    print(f"Dataset created with {len(dataset.labels)} samples")
    
    if len(dataset.labels) == 0:
        print("Not enough data to train.")
        return
        
    print("Training model...")
    model, metrics = train_signal_model(dataset)
    print("Training metrics:", metrics)
    
    print("Saving model...")
    path = model.save()
    print(f"Model saved to {path}")

if __name__ == "__main__":
    asyncio.run(main())
