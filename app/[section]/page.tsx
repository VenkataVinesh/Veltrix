import { notFound } from 'next/navigation'
import { TerminalShell } from '@/components/terminal-shell'
import { isAppSection, SectionView } from '@/components/views/section-view'

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (!isAppSection(section)) {
    notFound()
  }

  return (
    <TerminalShell>
      <SectionView section={section} />
    </TerminalShell>
  )
}
