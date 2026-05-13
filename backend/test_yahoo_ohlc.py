import asyncio
from app.services.market_service import get_ohlc

async def main():
    print("Fetching AAPL 1h...")
    res = await get_ohlc("AAPL", "1h")
    print("Result source:", res.get("source"))
    print("Points count:", len(res.get("points", [])))
    if res.get("points"):
        print("First point:", res["points"][0])

if __name__ == "__main__":
    asyncio.run(main())
