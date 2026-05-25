import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TutorLive } from '@/components/tutor/tutor-live'
import { getTutor } from '@/components/tutor/tutor-voices'

export const metadata: Metadata = { title: 'Tutor AI — Italianto' }

export default async function TutorChatPage({ params }: { params: { slug: string } }) {
  const tutor = getTutor(params.slug)
  if (!tutor) notFound()

  return (
    <div className="h-[calc(100vh-64px)]">
      <TutorLive
        tutorName={tutor.name}
        tutorSlug={tutor.slug}
        avatarUrl={tutor.avatar ?? null}
      />
    </div>
  )
}
