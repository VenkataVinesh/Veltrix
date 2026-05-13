import httpx
import asyncio

async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Login
        resp = await client.post("http://localhost:8000/api/v1/auth/login", json={
            "email": "demo@veltrix.ai",
            "password": "Demo123!"
        })
        print("Login Status:", resp.status_code)
        token = resp.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get Forecasts
        print("Fetching forecasts...")
        resp = await client.get("http://localhost:8000/api/v1/forecasts", headers=headers)
        print("Forecast Status:", resp.status_code)
        print("Forecast Response Summary:", resp.json().get("summary", {}))
        print("Forecast Items Count:", len(resp.json().get("items", [])))

if __name__ == "__main__":
    asyncio.run(main())
