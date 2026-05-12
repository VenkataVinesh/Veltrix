'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  Send, 
  Sparkles,
  Brain,
  RefreshCw,
} from 'lucide-react'
import { GlassPanel } from '@/components/glass-panel'
import { MiniChart } from '@/components/mini-chart'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

const suggestedPrompts = [
  "What's your market outlook for this week?",
  "Analyze NVDA for a potential entry",
  "Review my portfolio risk exposure",
  "Find high-conviction trade setups",
]

export function CopilotView() {
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState('')
  const queryClient = useQueryClient()
  const { data: history } = useQuery({
    queryKey: ['copilot-history'],
    queryFn: api.copilotHistory,
  })
  const chatMutation = useMutation({
    mutationFn: (message: string) => api.copilotChat(message),
    onSuccess: () => {
      setInput('')
      queryClient.invalidateQueries({ queryKey: ['copilot-history'] })
    },
  })

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6">
      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        <GlassPanel 
          className="flex-1 flex flex-col"
          glow="amber"
          delay={0.1}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">AI Trading Copilot</h2>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs text-muted-foreground">Online - GPT-5 + Custom Models</span>
                </div>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </motion.button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {(history ?? []).map((msg, i) => (
              <div key={msg.id} className="space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4 flex-row-reverse"
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  "bg-accent"
                )}>
                  <span className="text-sm font-bold text-accent-foreground">JD</span>
                </div>
                <div className="flex-1 max-w-2xl flex flex-col items-end">
                  <div className={cn(
                    "p-4 rounded-2xl",
                    "bg-accent text-accent-foreground"
                  )}>
                    <p className="text-sm">{msg.question}</p>
                  </div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 + 0.05 }}
                className="flex gap-4"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/20">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 max-w-2xl">
                  <div className="p-4 rounded-2xl bg-secondary/50">
                    <p className="text-sm">{msg.answer}</p>
                  </div>
                </div>
              </motion.div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border/50">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything about markets, trading, or your portfolio..."
                  className="w-full px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
              </div>
              <motion.button
                onClick={async () => {
                  if (!input.trim()) return
                  setStreaming('')
                  await api.copilotStream(input, (chunk) => setStreaming((prev) => prev + chunk))
                  chatMutation.mutate(input)
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>
            {streaming && (
              <div className="mt-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
                <span className="text-muted-foreground">Streaming:</span> {streaming}
              </div>
            )}

            {/* Suggested Prompts */}
            <div className="flex flex-wrap gap-2 mt-3">
              {suggestedPrompts.map((prompt, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setInput(prompt)}
                  className="px-3 py-1.5 rounded-lg bg-secondary/50 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* Context Panel */}
      <div className="hidden xl:block w-80 space-y-4">
        <GlassPanel 
          title="Quick Context" 
          subtitle="Market snapshot"
          delay={0.2}
        >
          <div className="p-4 space-y-4">
            {[
              { symbol: 'SPY', price: '$478.32', change: '+1.24%', trend: 'up' as const },
              { symbol: 'QQQ', price: '$412.56', change: '+1.87%', trend: 'up' as const },
              { symbol: 'VIX', price: '18.42', change: '-5.2%', trend: 'down' as const },
            ].map((item, i) => (
              <motion.div
                key={item.symbol}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/30"
              >
                <div>
                  <span className="font-mono font-semibold">{item.symbol}</span>
                  <div className="text-xs text-muted-foreground">{item.price}</div>
                </div>
                <div className="flex items-center gap-2">
                  <MiniChart symbol={item.symbol} timeframe="1D" color={item.trend === 'up' ? 'green' : 'red'} height={20} width={40} />
                  <span className={cn(
                    "text-xs font-mono",
                    item.trend === 'up' ? "text-success" : "text-destructive"
                  )}>
                    {item.change}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel 
          title="AI Memory" 
          subtitle="Conversation context"
          delay={0.3}
        >
          <div className="p-4 space-y-3">
            {[
              'Prefers technical analysis over fundamentals',
              'Risk tolerance: Moderate',
              'Focus sectors: Tech, AI',
              'Typical position size: 2-3%'
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <Brain className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                {item}
              </motion.div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
