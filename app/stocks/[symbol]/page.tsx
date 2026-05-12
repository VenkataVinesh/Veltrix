import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TerminalShell } from '@/components/terminal-shell'
import { TradingChart } from '@/components/trading-chart'
import { GlassPanel } from '@/components/glass-panel'
import { LiveQuote } from './live-quote'

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params

  return (
    <TerminalShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/markets" className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-sm hover:bg-secondary/70">
            <ArrowLeft className="h-4 w-4" />
            Back to markets
          </Link>
          <div className="rounded-xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">Realtime stream connected</div>
        </div>

        <div className="grid gap-6 xl:grid-cols-4">
          <div className="xl:col-span-3">
            <GlassPanel glow="amber" className="p-4">
              <LiveQuote symbol={symbol} />
              <div className="h-[520px] mt-4">
                <TradingChart
                  symbol={symbol}
                  timeframe="1D"
                  chartMode="candles"
                  indicators={{
                    volume: true,
                    rsi: true,
                    macd: true,
                    ema: true,
                    sma: false,
                    bollinger: true,
                    volumeProfile: false,
                  }}
                />
              </div>
            </GlassPanel>
          </div>

          <div className="space-y-4">
            <GlassPanel title="Key Stats" className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Symbol</span><span className="font-mono">{symbol}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Source</span><span className="font-mono text-xs">Live market data</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Signal Bias</span><span className="font-mono text-primary">Pending</span></div>
              </div>
            </GlassPanel>
            <GlassPanel title="AI Trade Plan" className="p-4">
              <p className="text-sm text-muted-foreground">Load chart data to generate AI trade plan.</p>
            </GlassPanel>
          </div>
        </div>
      </div>
    </TerminalShell>
  )
}
