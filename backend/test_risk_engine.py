import asyncio
from app.db.session import SessionLocal
from app.db.models import User
from app.services.risk_service import RiskService

async def main():
    print("Starting Risk Engine verification...")
    db = SessionLocal()
    try:
        # Fetch the demo user
        user = db.query(User).filter(User.email == "demo@veltrix.ai").first()
        if not user:
            print("Demo user not found. Seeding first...")
            # We can create a temporary user ID for testing
            user_id = 1
        else:
            user_id = user.id
            print(f"Testing on User ID: {user_id} (email: {user.email})")

        # Instantiate RiskService and run compute_risk
        risk_service = RiskService(db)
        result = await risk_service.compute_risk(user_id=user_id)
        
        print("RISK ENGINE SUCCESS")
        print("Equity:", result["equity"])
        print("VaR (Value at Risk):", result["var"])
        print("Expected Shortfall (CVaR):", result["expected_shortfall"])
        print("Max Drawdown:", result["max_drawdown"])
        print("Concentration HHI:", result["concentration_risk"])
        print("Liquidity Risk Proxy:", result["liquidity_risk"])
        print("Stress Tests:")
        for t in result["stress_tests"]:
            print(f"  {t['metric']}: {t['value']}")
        print("Scenario Shock Simulations:")
        for s in result["scenario_engine"]:
            print(f"  {s['name']}: projected pnl = {s['projected_pnl']}")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
