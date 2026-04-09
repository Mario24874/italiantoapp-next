import type { Metadata } from 'next'
import { TutorSelector } from '@/components/tutor/tutor-selector'

export const metadata: Metadata = { title: 'Tutor AI — Italianto' }

export default function TutorPage() {
  return (
    <div className="h-full overflow-y-auto">
      <TutorSelector />
    </div>
  )
}
