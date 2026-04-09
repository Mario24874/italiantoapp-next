import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/layout/bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f5] dark:bg-[#0d1a0d]">
      {/* Main content — leaves room for bottom nav */}
      <main className="flex-1 pb-16 overflow-hidden">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
