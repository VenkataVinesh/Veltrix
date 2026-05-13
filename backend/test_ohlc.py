import asyncio
from app.services.market_service import get_ohlc

def main():
    print("Testing get_ohlc...")
    ohlc = asyncio.run(get_ohlc("SPY", "1d"))
    print("Got OHLC:", len(ohlc.get("points", [])))

if __name__ == "__main__":
    main()
