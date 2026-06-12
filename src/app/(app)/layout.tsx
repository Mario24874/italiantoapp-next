import { BottomNav } from '@/components/layout/bottom-nav'

// Guests can browse every tool page; /profilo and the paid APIs (translate, tutor)
// keep their own auth gates (middleware + per-route checks).
export default function AppLayout({ children }: { children: React.ReactNode }) {
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
