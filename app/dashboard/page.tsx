'use client'

import { TerminalShell } from '@/components/terminal-shell'
import { SectionView } from '@/components/views/section-view'

export default function DashboardPage() {
  return (
    <TerminalShell>
      <SectionView section="dashboard" />
    </TerminalShell>
  )
}
