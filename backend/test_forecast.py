from app.db.session import SessionLocal
from app.services.forecast_service import ForecastService

def main():
    db = SessionLocal()
    try:
        service = ForecastService(db, ["SPY"])
        forecasts = service.get_forecasts(["1d", "7d"])
        print(f"Got {len(forecasts)} forecasts.")
        print(forecasts)
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
