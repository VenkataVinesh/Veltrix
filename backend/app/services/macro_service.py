from __future__ import annotations

from datetime import datetime

import httpx

from app.core.config import settings


class MacroService:
    async def get_macro_dashboard(self) -> dict:
        fred = await self._fetch_fred_series()
        trading_economics = await self._fetch_tradingeconomics_calendar()

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "rates": fred.get("rates", {}),
            "inflation": fred.get("inflation", {}),
            "dxy": fred.get("dxy", {}),
            "commodities": fred.get("commodities", {}),
            "calendar": trading_economics,
            "sentiment": {
                "recession_probability": self._recession_probability(fred),
                "macro_regime": self._macro_regime(fred),
            },
        }

    async def _fetch_fred_series(self) -> dict:
        api_key = settings.fred_api_key
        if not api_key:
            return {
                "rates": {},
                "inflation": {},
                "dxy": {},
                "commodities": {},
                "note": "FRED API key missing",
            }

        series_map = {
            "DGS10": "ust10y",
            "DGS2": "ust2y",
            "CPIAUCSL": "cpi",
            "PPIACO": "ppi",
            "DTWEXBGS": "dxy",
            "DCOILWTICO": "wti",
            "GOLDAMGBD228NLBM": "gold",
        }

        values: dict[str, float] = {}
        async with httpx.AsyncClient(timeout=10.0) as client:
            for series_id, label in series_map.items():
                url = "https://api.stlouisfed.org/fred/series/observations"
                params = {
                    "series_id": series_id,
                    "api_key": api_key,
                    "file_type": "json",
                    "sort_order": "desc",
                    "limit": 1,
                }
                try:
                    response = await client.get(url, params=params)
                    response.raise_for_status()
                    payload = response.json()
                    observations = payload.get("observations", [])
                    if observations:
                        value = observations[0].get("value")
                        try:
                            values[label] = float(value)
                        except Exception:
                            continue
                except Exception:
                    continue

        return {
            "rates": {"ust10y": values.get("ust10y"), "ust2y": values.get("ust2y")},
            "inflation": {"cpi": values.get("cpi"), "ppi": values.get("ppi")},
            "dxy": {"index": values.get("dxy")},
            "commodities": {"wti": values.get("wti"), "gold": values.get("gold")},
        }

    async def _fetch_tradingeconomics_calendar(self) -> list[dict]:
        if not settings.tradingeconomics_api_key:
            return []

        url = "https://api.tradingeconomics.com/calendar"
        params = {
            "c": settings.tradingeconomics_api_key,
            "f": "json",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                payload = response.json()
                if isinstance(payload, list):
                    return [
                        {
                            "country": item.get("Country"),
                            "event": item.get("Event"),
                            "actual": item.get("Actual"),
                            "forecast": item.get("Forecast"),
                            "importance": item.get("Importance"),
                            "date": item.get("Date"),
                        }
                        for item in payload[:25]
                    ]
        except Exception:
            return []
        return []

    @staticmethod
    def _recession_probability(fred_payload: dict) -> float:
        rates = fred_payload.get("rates", {})
        y10 = rates.get("ust10y")
        y2 = rates.get("ust2y")
        if y10 is None or y2 is None:
            return 0.0
        spread = y10 - y2
        if spread > 1:
            return 0.15
        if spread > 0:
            return 0.35
        if spread > -0.5:
            return 0.62
        return 0.8

    @staticmethod
    def _macro_regime(fred_payload: dict) -> str:
        inflation = fred_payload.get("inflation", {})
        cpi = inflation.get("cpi")
        if cpi is None:
            return "unknown"
        if cpi > 320:
            return "inflationary"
        if cpi > 280:
            return "neutral"
        return "disinflationary"
