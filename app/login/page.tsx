'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { loginAction } from '@/lib/actions'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white text-lg font-semibold py-4 rounded-2xl disabled:opacity-60 active:opacity-80"
    >
      {pending ? 'Signing in…' : 'Sign In'}
    </button>
  )
}

export default function LoginPage() {
  const [state, action] = useFormState(loginAction, { error: '' })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6">
      <div className="max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-gray-500 mb-8 text-sm">Subhan Cargo — Custody Tracker</p>

        <form action={action} className="space-y-4">
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="••••••••"
            />
          </div>

          <SubmitButton />
        </form>

        <p className="text-center text-gray-500 mt-6 text-sm">
          No account?{' '}
          <Link href="/signup" className="text-blue-600 font-semibold">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
