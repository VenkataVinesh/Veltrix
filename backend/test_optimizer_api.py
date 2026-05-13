import httpx
import asyncio

async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get Forecasts
        print("Optimizing portfolio...")
        resp = await client.post("http://localhost:8000/api/v1/optimizer/", json={
            "amount": 10000.0,
            "risk_tolerance": "medium",
            "horizon": "long"
        })
        print("Optimizer Status:", resp.status_code)
        print("Optimizer Response:", resp.text[:500]) # Print first 500 chars

if __name__ == "__main__":
    asyncio.run(main())
