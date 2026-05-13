import asyncio
from app.services.optimizer_service import OptimizerService, OptimizerInput

async def main():
    service = OptimizerService()
    try:
        result = await service.optimize(
            OptimizerInput(
                amount=50000,
                risk_tolerance="medium",
                horizon="long",
                preferred_sectors=["technology"],
                ethical=False,
                dividend_preference=False,
                volatility_tolerance="medium"
            )
        )
        print("SUCCESS")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
