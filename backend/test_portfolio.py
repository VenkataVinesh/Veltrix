import httpx
import asyncio
import os

async def main():
    async with httpx.AsyncClient() as client:
        # Login — password comes from the seeded dev account (see SETUP.md)
        resp = await client.post("http://localhost:8000/api/v1/auth/login", json={
            "email": os.environ.get("SEED_DEMO_EMAIL", "demo@veltrix.ai"),
            "password": os.environ["SEED_DEMO_PASSWORD"]
        })
        print("Login Status:", resp.status_code)
        token = resp.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create Portfolio
        resp = await client.post("http://localhost:8000/api/v1/portfolio/", headers=headers, json={
            "name": "Test Portfolio"
        })
        print("Create Portfolio Status:", resp.status_code)
        print("Create Portfolio Response:", resp.text)
        
        if resp.status_code == 201:
            pid = resp.json()["id"]
            # Add Position
            print("Adding position...")
            resp = await client.post(f"http://localhost:8000/api/v1/portfolio/{pid}/positions", headers=headers, json={
                "symbol": "AAPL",
                "quantity": 10,
                "avg_price": 150.0
            })
            print("Add Position Status:", resp.status_code)
            print("Add Position Response:", resp.text)
        else:
            print("Failed to create portfolio")

if __name__ == "__main__":
    asyncio.run(main())
