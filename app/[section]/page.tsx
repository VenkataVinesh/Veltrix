'use client'

import { notFound } from 'next/navigation'
import { TerminalShell } from '@/components/terminal-shell'
import { isAppSection, SectionView } from '@/components/views/section-view'

export default function SectionPage({ params }: { params: { section: string } }) {
  const { section } = params
  if (!isAppSection(section)) {
    notFound()
  }

  return (
    <TerminalShell>
      <SectionView section={section} />
    </TerminalShell>
  )
}
