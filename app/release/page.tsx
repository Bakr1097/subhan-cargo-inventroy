'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { lookupParcelAction, releaseParcelAction } from '@/lib/actions'
import type { FoundParcel } from '@/lib/actions'
import { useEffect, useState } from 'react'
import Link from 'next/link'

function LookupButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white text-xl font-semibold py-5 rounded-2xl disabled:opacity-60 active:opacity-80"
    >
      {pending ? 'Searching…' : 'Look Up Parcel'}
    </button>
  )
}

function ReleaseButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-green-600 text-white text-xl font-semibold py-5 rounded-2xl disabled:opacity-60 active:opacity-80"
    >
      {pending ? 'Releasing…' : 'Release Parcel'}
    </button>
  )
}

export default function ReleasePage() {
  const [lookupState, lookupAction] = useFormState(lookupParcelAction, { error: '', parcel: null })
  const [releaseState, releaseAction] = useFormState(releaseParcelAction, { error: '', success: false })

  const [foundParcel, setFoundParcel] = useState<FoundParcel | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [lookupKey, setLookupKey] = useState(0)

  // Move to release phase when lookup finds a parcel
  useEffect(() => {
    if (lookupState.parcel) {
      setFoundParcel(lookupState.parcel)
    }
  }, [lookupState.parcel])

  // After successful release: show toast, reset to lookup phase
  useEffect(() => {
    if (!releaseState.success) return
    setShowToast(true)
    setFoundParcel(null)
    setLookupKey(k => k + 1)
    const t = setTimeout(() => setShowToast(false), 3000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseState.ts])

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Success toast */}
      <div className={showToast ? 'bg-green-500 text-white text-center py-3 font-semibold text-sm shadow' : 'hidden'}>
        ✓ Parcel released successfully
      </div>

      {/* Header */}
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-blue-600 font-semibold text-base py-1 pr-3">← Home</Link>
        <h1 className="text-lg font-bold text-gray-900">Release Parcel</h1>
      </header>

      <main className="px-4 py-6">
        {!foundParcel ? (

          /* ── PHASE 1: LOOKUP ──────────────────────────────── */
          <form key={lookupKey} action={lookupAction} className="space-y-5">

            {lookupState.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-xl text-sm font-medium leading-snug">
                {lookupState.error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Bilty Number <span className="text-red-500">*</span>
              </label>
              <input
                name="bilty_number"
                type="text"
                required
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full border border-gray-300 rounded-xl px-4 py-4 text-xl tracking-wide font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white uppercase"
                placeholder="e.g. LHR-12345"
              />
            </div>

            <LookupButton />
          </form>

        ) : (

          /* ── PHASE 2: RELEASE ─────────────────────────────── */
          <div className="space-y-5">

            {/* Back link */}
            <button
              type="button"
              onClick={() => setFoundParcel(null)}
              className="text-blue-600 font-semibold text-sm py-1"
            >
              ← Search again
            </button>

            {/* Parcel details card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <p className="text-xl font-bold font-mono tracking-wide text-gray-900">
                {foundParcel.bilty_number}
              </p>
              <p className="text-gray-700">{foundParcel.description}</p>
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <span className="text-sm text-gray-500">
                  {foundParcel.units} unit{foundParcel.units !== 1 ? 's' : ''}
                </span>
                <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                  foundParcel.payment_type === 'TO_PAY'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {foundParcel.payment_type === 'TO_PAY'
                    ? `TO PAY — Rs. ${foundParcel.amount_due}`
                    : 'PAID'}
                </span>
              </div>
            </div>

            {/* Receiver + release form */}
            <form action={releaseAction} className="space-y-5">
              {/* Hidden fields carry parcel identity to the server */}
              <input type="hidden" name="parcel_id" value={foundParcel.id} />
              <input type="hidden" name="payment_type" value={foundParcel.payment_type} />

              {releaseState.error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                  {releaseState.error}
                </div>
              )}

              {/* Receiver Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Receiver Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="receiver_name"
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  placeholder="Full name of person collecting"
                />
              </div>

              {/* Receiver Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  name="receiver_phone"
                  type="tel"
                  inputMode="numeric"
                  required
                  autoComplete="off"
                  maxLength={11}
                  pattern="03[0-9]{9}"
                  onKeyDown={e => {
                    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
                    if (!allowed.includes(e.key) && !/^[0-9]$/.test(e.key)) e.preventDefault()
                  }}
                  onInvalid={e => (e.target as HTMLInputElement).setCustomValidity('Enter a valid Pakistani mobile number (e.g. 03001234567)')}
                  onChange={e => (e.target as HTMLInputElement).setCustomValidity('')}
                  className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  placeholder="e.g. 03001234567"
                />
              </div>

              {/* Receiver CNIC */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  CNIC <span className="text-red-500">*</span>
                </label>
                <input
                  name="receiver_cnic"
                  type="text"
                  inputMode="numeric"
                  required
                  autoComplete="off"
                  maxLength={15}
                  pattern="[0-9]{5}-[0-9]{7}-[0-9]"
                  onKeyDown={e => {
                    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
                    if (!allowed.includes(e.key) && !/^[0-9]$/.test(e.key)) e.preventDefault()
                  }}
                  onInvalid={e => (e.target as HTMLInputElement).setCustomValidity('Enter a valid CNIC (e.g. 33100-1234567-8)')}
                  onChange={e => {
                    const input = e.target as HTMLInputElement
                    input.setCustomValidity('')
                    const digits = input.value.replace(/\D/g, '').slice(0, 13)
                    if (digits.length > 12) {
                      input.value = digits.slice(0, 5) + '-' + digits.slice(5, 12) + '-' + digits.slice(12)
                    } else if (digits.length > 5) {
                      input.value = digits.slice(0, 5) + '-' + digits.slice(5)
                    } else {
                      input.value = digits
                    }
                  }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  placeholder="e.g. 33100-1234567-8"
                />
              </div>

              {/* Cash Collected — always in DOM, shown/hidden via CSS (same pattern as /receive) */}
              <div className={foundParcel.payment_type === 'TO_PAY' ? 'block' : 'hidden'}>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Cash Collected (Rs.) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-medium">Rs.</span>
                  <input
                    name="cash_collected"
                    type="number"
                    inputMode="decimal"
                    required={foundParcel.payment_type === 'TO_PAY'}
                    min="0"
                    step="1"
                    defaultValue={foundParcel.amount_due ?? ''}
                    className="w-full border-2 border-amber-400 rounded-xl pl-14 pr-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-1">
                  Pre-filled with amount due — edit if different.
                </p>
              </div>

              <div className="pt-2">
                <ReleaseButton />
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
