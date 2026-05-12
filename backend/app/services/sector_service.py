"""Sector performance analysis service."""

from typing import List, Dict, Optional
from app.services.market_providers import ProviderOrchestrator, provider_orchestrator


# Sector composition: Define representative stocks for each sector
SECTOR_STOCKS = {
    "Technology": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "TSLA"],
    "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "LLY", "MRK"],
    "Financials": ["JPM", "BAC", "WFC", "GS", "MS", "BLK"],
    "Consumer": ["WMT", "AMZN", "MCD", "NKE", "HD", "TJX"],
    "Energy": ["XOM", "CVX", "COP", "SLB", "EOG", "MPC"],
    "Industrial": ["BA", "CAT", "GE", "MMM", "HON", "RTX"],
    "Materials": ["LIN", "APD", "FCX", "NEM", "ALB", "NUCOR"],
    "Utilities": ["NEE", "DUK", "SO", "EXC", "AEP", "XEL"],
    "Real Estate": ["PLD", "AMT", "SPG", "EQIX", "VICI", "AVB"],
    "Telecom": ["VZ", "T", "CMCSA", "TMUS", "CHTR", "LBRDK"],
}

# Market weight (percentage of S&P 500)
SECTOR_WEIGHTS = {
    "Technology": 28,
    "Healthcare": 13,
    "Financials": 12,
    "Consumer": 11,
    "Energy": 9,
    "Industrial": 8,
    "Materials": 5,
    "Utilities": 5,
    "Real Estate": 5,
    "Telecom": 4,
}


class SectorService:
    """Calculate real-time sector performance from market data."""

    def __init__(self, market_provider: Optional[ProviderOrchestrator] = None):
        self.market_provider = market_provider or provider_orchestrator
        self.sector_stocks = SECTOR_STOCKS
        self.sector_weights = SECTOR_WEIGHTS

    async def get_sector_performance(self) -> List[Dict]:
        """
        Get current sector performance by aggregating constituent stock changes.
        
        Returns list of sectors with:
        - name: Sector name
        - change: Weighted percentage change
        - weight: Market weight (%)
        - stocks: List of constituent stocks with their performance
        - last_updated: ISO timestamp
        """
        results = []
        
        # Flatten all stocks needed
        all_stocks = set()
        for sector, stocks in self.sector_stocks.items():
            all_stocks.update(stocks)
        
        # Get quotes for all stocks at once
        all_stocks_list = list(all_stocks)
        quotes = await self.market_provider.get_quotes(all_stocks_list)
        
        # Build quote dict for quick lookup
        quote_dict = {}
        for quote in quotes:
            symbol = quote.get("symbol", "")
            price = quote.get("price", 0)
            prev_close = quote.get("prev_close", price)  # Fallback to current if not available
            change_pct = ((price - prev_close) / prev_close * 100) if prev_close > 0 else 0
            
            quote_dict[symbol] = {
                "price": price,
                "prev_close": prev_close,
                "change_pct": change_pct,
                "source": quote.get("source", "unknown")
            }
        
        # Calculate sector performance
        for sector_name, stocks in self.sector_stocks.items():
            sector_changes = []
            sector_details = []
            
            for stock in stocks:
                if stock in quote_dict:
                    stock_data = quote_dict[stock]
                    sector_changes.append(stock_data["change_pct"])
                    sector_details.append({
                        "symbol": stock,
                        "price": stock_data["price"],
                        "prev_close": stock_data["prev_close"],
                        "change": stock_data["change_pct"]
                    })
            
            # Calculate average change for sector
            if sector_changes:
                sector_change = sum(sector_changes) / len(sector_changes)
            else:
                sector_change = 0.0
            
            results.append({
                "name": sector_name,
                "change": round(sector_change, 2),
                "weight": self.sector_weights.get(sector_name, 0),
                "stocks": sector_details,
                "constituent_count": len(sector_details)
            })
        
        # Sort by weight (descending)
        results.sort(key=lambda x: x["weight"], reverse=True)
        return results

    async def get_sector_details(self, sector_name: str) -> Optional[Dict]:
        """Get detailed information about a specific sector."""
        if sector_name not in self.sector_stocks:
            return None
        
        stocks = self.sector_stocks[sector_name]
        
        # Get quotes for sector stocks
        quotes = await self.market_provider.get_quotes(stocks)
        quote_dict = {}
        
        for quote in quotes:
            symbol = quote.get("symbol", "")
            price = quote.get("price", 0)
            prev_close = quote.get("prev_close", price)
            change_pct = ((price - prev_close) / prev_close * 100) if prev_close > 0 else 0
            
            quote_dict[symbol] = {
                "price": price,
                "prev_close": prev_close,
                "change_pct": change_pct,
                "volume": quote.get("volume", 0)
            }
        
        # Build stock list with performance
        stock_list = []
        sector_changes = []
        
        for stock in stocks:
            if stock in quote_dict:
                stock_data = quote_dict[stock]
                stock_list.append({
                    "symbol": stock,
                    "price": stock_data["price"],
                    "prev_close": stock_data["prev_close"],
                    "change": stock_data["change_pct"],
                    "volume": stock_data["volume"]
                })
                sector_changes.append(stock_data["change_pct"])
        
        # Calculate sector average
        sector_avg = sum(sector_changes) / len(sector_changes) if sector_changes else 0.0
        
        # Sort stocks by performance descending
        stock_list.sort(key=lambda x: x["change"], reverse=True)
        
        return {
            "name": sector_name,
            "weight": self.sector_weights.get(sector_name, 0),
            "avg_change": round(sector_avg, 2),
            "stocks": stock_list,
            "best_performer": stock_list[0] if stock_list else None,
            "worst_performer": stock_list[-1] if stock_list else None,
            "constituent_count": len(stock_list)
        }

    async def get_sector_leaders_losers(self, limit: int = 3) -> Dict:
        """Get top performing and worst performing sectors."""
        sectors = await self.get_sector_performance()
        
        # Sort by change
        sorted_sectors = sorted(sectors, key=lambda x: x["change"], reverse=True)
        
        return {
            "leaders": sorted_sectors[:limit],
            "losers": sorted_sectors[-limit:],
            "timestamp": None  # Would be added by API layer
        }

    async def get_sector_heatmap_data(self) -> List[Dict]:
        """Get sector data formatted for heatmap visualization."""
        sectors = await self.get_sector_performance()
        
        return [
            {
                "name": sector["name"],
                "change": sector["change"],
                "weight": sector["weight"]
            }
            for sector in sectors
        ]
