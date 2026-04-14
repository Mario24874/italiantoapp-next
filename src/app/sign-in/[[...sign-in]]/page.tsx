import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f7f5] dark:bg-[#0d1a0d] px-4 py-8">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/app/icon-192.png" alt="Italianto" className="size-16 mx-auto mb-3 rounded-2xl" />
        <h1 className="text-2xl font-bold text-italianto-800 dark:text-italianto-300">Italianto</h1>
        <p className="text-sm text-gray-400 dark:text-[#4a7a4a] mt-1">Impara l&apos;italiano con l&apos;IA</p>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-sm',
            card: 'rounded-2xl border border-[#d4e4d4] shadow-green',
          },
        }}
        afterSignInUrl="/app/tutor"
        afterSignUpUrl="/app/tutor"
      />
    </div>
  )
}
