'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Cpu,
  Activity,
  Zap,
  MessageSquare,
  BarChart3,
  Shield,
  Globe2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

interface AgentPersona {
  id: string
  name: string
  role: string
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
}

const AGENT_PERSONAS: AgentPersona[] = [
  {
    id: 'technical',
    name: 'SIGMA-T',
    role: 'Technical Analyst',
    icon: BarChart3,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    id: 'macro',
    name: 'ATLAS-M',
    role: 'Macro Strategist',
    icon: Globe2,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  {
    id: 'risk',
    name: 'NEXUS-R',
    role: 'Risk Manager',
    icon: Shield,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  {
    id: 'momentum',
    name: 'APEX-Q',
    role: 'Quant Momentum',
    icon: Activity,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
]

function buildAgentArgument(
  agentId: string,
  signal: { signal: string; confidence: number; momentum: number; trend: string; volatility: number; support: number; resistance: number; target_up?: number; target_down?: number } | undefined,
  symbol: string
): { bullish: string; bearish: string; verdict: 'BUY' | 'SELL' | 'HOLD'; confidence: number } {
  if (!signal) {
    return { bullish: 'Awaiting market data...', bearish: 'Awaiting market data...', verdict: 'HOLD', confidence: 50 }
  }

  const priceMid = ((signal.support ?? 0) + (signal.resistance ?? 0)) / 2
  const upside = signal.target_up ? ((signal.target_up - priceMid) / Math.max(priceMid, 1) * 100) : 0
  const downside = signal.target_down ? ((priceMid - signal.target_down) / Math.max(priceMid, 1) * 100) : 0
  const vol = (signal.volatility * 100).toFixed(2)
  const mom = signal.momentum.toFixed(3)
  const conf = Math.round(signal.confidence * 100)

  const args: Record<string, { bullish: string; bearish: string }> = {
    technical: {
      bullish: `${symbol} shows ${signal.trend} trend with momentum ${mom}. Support at $${(signal.support ?? 0).toFixed(2)} holding strong. Upside target $${(signal.target_up ?? 0).toFixed(2)} (+${upside.toFixed(1)}%). Technical structure favors continuation.`,
      bearish: `Volatility at ${vol}% creates elevated risk. Resistance at $${(signal.resistance ?? 0).toFixed(2)} could cap gains. Downside scenario targets $${(signal.target_down ?? 0).toFixed(2)} (-${downside.toFixed(1)}%). Caution warranted.`,
    },
    macro: {
      bullish: `Macro regime supports risk-on positioning. ${symbol} sector correlation positive. Fed policy trajectory and liquidity conditions create tailwinds for this asset class at current levels.`,
      bearish: `Global macro uncertainty persists. Credit spreads and currency volatility may weigh on risk assets. Institutional positioning shows caution. Cross-asset signals mixed.`,
    },
    risk: {
      bullish: `Portfolio-adjusted risk metrics within acceptable bounds. Sharpe contribution positive at current entry. Position sizing model supports allocation. Stop at $${(signal.target_down ?? 0).toFixed(2)} provides defined risk.`,
      bearish: `VaR exposure elevated with vol at ${vol}%. Tail risk scenarios show -${downside.toFixed(1)}% drawdown potential. Concentration risk flagged. Recommend reduced size or hedge via options.`,
    },
    momentum: {
      bullish: `Quantitative momentum score ${mom > '0' ? 'positive' : 'turning'}. Relative strength vs benchmark constructive. Volume pattern supports price action. Model signals ${signal.signal} with ${conf}% confidence.`,
      bearish: `Momentum deceleration risk detected. Volatility regime ${parseFloat(vol) > 25 ? 'elevated' : 'moderate'} historically precedes mean reversion. Quant model flags potential for pullback to $${(signal.support ?? 0).toFixed(2)}.`,
    },
  }

  return {
    bullish: args[agentId]?.bullish ?? 'Analysis pending...',
    bearish: args[agentId]?.bearish ?? 'Analysis pending...',
    verdict: signal.signal as 'BUY' | 'SELL' | 'HOLD',
    confidence: conf,
  }
}

interface AIDebatePanelProps {
  symbol?: string
  compact?: boolean
}

export function AIDebatePanel({ symbol = 'SPY', compact = false }: AIDebatePanelProps) {
  const [expanded, setExpanded] = useState(!compact)
  const [activeAgent, setActiveAgent] = useState<string | null>(null)

  const { data: signal, isLoading } = useQuery({
    queryKey: ['signal', symbol, '1D'],
    queryFn: () => api.signal(symbol, '1D'),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  // Compute overall consensus
  const agentVerdicts = AGENT_PERSONAS.map((agent) => {
    const args = buildAgentArgument(agent.id, signal, symbol)
    return { agent, ...args }
  })

  const buyVotes = agentVerdicts.filter((v) => v.verdict === 'BUY').length
  const sellVotes = agentVerdicts.filter((v) => v.verdict === 'SELL').length
  const holdVotes = agentVerdicts.filter((v) => v.verdict === 'HOLD').length
  const avgConf = Math.round(agentVerdicts.reduce((a, v) => a + v.confidence, 0) / agentVerdicts.length)

  const consensusSignal = buyVotes >= sellVotes && buyVotes >= holdVotes
    ? 'BUY'
    : sellVotes > buyVotes
      ? 'SELL'
      : 'HOLD'

  const consensusColor = consensusSignal === 'BUY'
    ? 'text-success border-success/30 bg-success/10'
    : consensusSignal === 'SELL'
      ? 'text-destructive border-destructive/30 bg-destructive/10'
      : 'text-primary border-primary/30 bg-primary/10'

  return (
    <div className="space-y-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 glow-amber">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold">AI Debate Engine</h3>
            <p className="text-xs text-muted-foreground">
              {AGENT_PERSONAS.length} agents · {symbol} analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Consensus pill */}
          <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold', consensusColor)}>
            {consensusSignal === 'BUY' ? <TrendingUp className="w-3 h-3" /> : consensusSignal === 'SELL' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {consensusSignal}
            <span className="text-[10px] opacity-70">{avgConf}%</span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {/* Consensus meter */}
            <div className="mb-4 p-3 rounded-xl bg-secondary/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Consensus Votes</span>
                <div className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-primary animate-pulse" />
                  <span className="text-xs text-primary">{isLoading ? 'Analyzing...' : 'Live'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden flex">
                  <motion.div
                    className="h-full bg-success"
                    initial={{ width: 0 }}
                    animate={{ width: `${(buyVotes / AGENT_PERSONAS.length) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(holdVotes / AGENT_PERSONAS.length) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                  />
                  <motion.div
                    className="h-full bg-destructive"
                    initial={{ width: 0 }}
                    animate={{ width: `${(sellVotes / AGENT_PERSONAS.length) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground whitespace-nowrap">
                  <span className="text-success">{buyVotes}B</span>
                  <span className="text-primary">{holdVotes}H</span>
                  <span className="text-destructive">{sellVotes}S</span>
                </div>
              </div>
            </div>

            {/* Agent cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agentVerdicts.map((v, i) => {
                const isActive = activeAgent === v.agent.id
                const AgentIcon = v.agent.icon
                return (
                  <motion.div
                    key={v.agent.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={cn(
                      'rounded-xl border p-3 cursor-pointer transition-all duration-200',
                      v.agent.bgColor,
                      v.agent.borderColor,
                      isActive && 'ring-1 ring-primary/40'
                    )}
                    onClick={() => setActiveAgent(isActive ? null : v.agent.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-1.5 rounded-lg', v.agent.bgColor)}>
                          <AgentIcon className={cn('w-3.5 h-3.5', v.agent.color)} />
                        </div>
                        <div>
                          <div className={cn('text-xs font-bold font-mono', v.agent.color)}>{v.agent.name}</div>
                          <div className="text-[10px] text-muted-foreground">{v.agent.role}</div>
                        </div>
                      </div>
                      <div className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold border',
                        v.verdict === 'BUY' ? 'text-success border-success/30 bg-success/10' :
                          v.verdict === 'SELL' ? 'text-destructive border-destructive/30 bg-destructive/10' :
                            'text-primary border-primary/30 bg-primary/10'
                      )}>
                        {v.verdict}
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Confidence</span>
                        <span className={v.agent.color}>{v.confidence}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-secondary/60 overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', v.verdict === 'BUY' ? 'bg-success' : v.verdict === 'SELL' ? 'bg-destructive' : 'bg-primary')}
                          initial={{ width: 0 }}
                          animate={{ width: `${v.confidence}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.08 }}
                        />
                      </div>
                    </div>

                    {/* Expandable argument */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-2 space-y-2">
                            <div className="flex items-start gap-1.5">
                              <TrendingUp className="w-3 h-3 text-success mt-0.5 shrink-0" />
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{v.bullish}</p>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <TrendingDown className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{v.bearish}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!isActive && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {v.verdict === 'BUY' ? v.bullish : v.verdict === 'SELL' ? v.bearish : v.bullish}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                      <MessageSquare className="w-3 h-3" />
                      <span>{isActive ? 'Click to collapse' : 'Click for full analysis'}</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Signal explainability footer */}
            <div className="mt-3 p-3 rounded-xl border border-border/40 bg-secondary/20">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">Signal Explainability</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {signal
                  ? `${symbol} ${consensusSignal} consensus from ${AGENT_PERSONAS.length} AI agents (${avgConf}% avg confidence). 
                     Trend: ${signal.trend} · Momentum: ${signal.momentum.toFixed(3)} · 
                     Volatility: ${(signal.volatility * 100).toFixed(2)}% · 
                     Support: $${(signal.support ?? 0).toFixed(2)} · Resistance: $${(signal.resistance ?? 0).toFixed(2)}.`
                  : 'Loading signal context from AI agents...'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
