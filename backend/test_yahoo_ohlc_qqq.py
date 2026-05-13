import asyncio
from app.services.market_service import get_ohlc

async def main():
    print("Fetching QQQ 1h...")
    res = await get_ohlc("QQQ", "1h")
    print("Result source:", res.get("source"))
    print("Points count:", len(res.get("points", [])))

if __name__ == "__main__":
    asyncio.run(main())
