import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const { userId } = await auth()
  // El tutor requiere cuenta; los visitantes aterrizan en una herramienta libre
  redirect(userId ? '/tutor' : '/conjugador')
}
