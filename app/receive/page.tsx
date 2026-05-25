'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { receiveParcelAction } from '@/lib/actions'
import { useEffect, useState } from 'react'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white text-xl font-semibold py-5 rounded-2xl disabled:opacity-60 active:opacity-80"
    >
      {pending ? 'Saving…' : 'Receive Parcel'}
    </button>
  )
}

export default function ReceivePage() {
  const [state, action] = useFormState(receiveParcelAction, { error: '', success: false })
  const [paymentType, setPaymentType] = useState<'PAID' | 'TO_PAY'>('PAID')
  const [formKey, setFormKey] = useState(0)
  const [showToast, setShowToast] = useState(false)

  // Fire on every new successful submission (ts changes each time)
  useEffect(() => {
    if (!state.success) return
    setShowToast(true)
    setFormKey(k => k + 1)   // remounts the form → clears all inputs
    setPaymentType('PAID')
    const t = setTimeout(() => setShowToast(false), 3000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts])

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Success toast — block banner above header, no fixed/z-index issues */}
      <div className={showToast ? 'bg-green-500 text-white text-center py-3 font-semibold text-sm shadow' : 'hidden'}>
        ✓ Parcel received and logged
      </div>

      {/* Header */}
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-blue-600 font-semibold text-base py-1 pr-3">← Home</Link>
        <h1 className="text-lg font-bold text-gray-900">Receive Parcel</h1>
      </header>

      <main className="px-4 py-6">
        <form key={formKey} action={action} className="space-y-5">

          {/* Hidden payment_type so server action always receives it */}
          <input type="hidden" name="payment_type" value={paymentType} />

          {/* Error banner */}
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
              {state.error}
            </div>
          )}

          {/* Bilty Number */}
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

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              name="description"
              type="text"
              required
              autoComplete="off"
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="e.g. Electronics, Clothes"
            />
          </div>

          {/* Units */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Units <span className="text-red-500">*</span>
            </label>
            <input
              name="units"
              type="number"
              inputMode="numeric"
              required
              min="1"
              defaultValue="1"
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Payment Type Toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Payment Type <span className="text-red-500">*</span>
            </label>
            <div className="flex rounded-xl border border-gray-300 overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setPaymentType('PAID')}
                className={`flex-1 py-4 text-lg font-bold transition-colors ${
                  paymentType === 'PAID'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                PAID
              </button>
              <div className="w-px bg-gray-300" />
              <button
                type="button"
                onClick={() => setPaymentType('TO_PAY')}
                className={`flex-1 py-4 text-lg font-bold transition-colors ${
                  paymentType === 'TO_PAY'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                TO PAY
              </button>
            </div>
          </div>

          {/* Amount Due — always in DOM, shown/hidden via CSS so state is never stale */}
          <div className={paymentType === 'TO_PAY' ? 'block' : 'hidden'}>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Amount Due (Rs.) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-medium">Rs.</span>
              <input
                name="amount_due"
                type="number"
                inputMode="decimal"
                required={paymentType === 'TO_PAY'}
                min="0"
                step="1"
                className="w-full border-2 border-amber-400 rounded-xl pl-14 pr-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                placeholder="0"
              />
            </div>
          </div>

          <div className="pt-2">
            <SubmitButton />
          </div>
        </form>
      </main>
    </div>
  )
}
