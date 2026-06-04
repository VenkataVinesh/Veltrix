import asyncio
from app.services.backtester import run_backtest

async def main():
    print("Starting Backtest verification...")
    try:
        result = await run_backtest(
            symbol="SPY",
            timeframe="1d",
            fast_window=20,
            slow_window=50,
            ma_type="sma",
            direction_type="long_only"
        )
        print("BACKTEST SUCCESS")
        print("Symbol:", result["symbol"])
        print("Metrics:")
        for k, v in result["metrics"].items():
            print(f"  {k}: {v}")
        print("Equity Curve points:", len(result["equity_curve"]))
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
