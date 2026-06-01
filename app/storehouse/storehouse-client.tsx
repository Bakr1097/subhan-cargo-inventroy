'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { voidParcelAction } from '@/lib/actions'

type Row = {
  id: string
  bilty_number: string
  description: string
  units: number
  payment_type: string
  amount_due: string | null
  received_at: string | null
  received_by_name: string | null
}

export function StorehouseClient({
  rows,
  total,
  isAdmin,
}: {
  rows: Row[]
  total: number
  isAdmin: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [voidModal, setVoidModal] = useState<{ id: string; bilty_number: string } | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState('')
  const [isPending, startTransition] = useTransition()

  const q = query.trim().toLowerCase()
  const filtered = q === ''
    ? rows
    : rows.filter(r =>
        r.bilty_number.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      )

  const today = new Date().toLocaleDateString('en-PK', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  function openVoidModal(row: { id: string; bilty_number: string }) {
    setVoidModal(row)
    setVoidReason('')
    setVoidError('')
  }

  function closeVoidModal() {
    if (isPending) return
    setVoidModal(null)
    setVoidReason('')
    setVoidError('')
  }

  function handleVoidConfirm() {
    if (!voidReason.trim() || !voidModal) return
    startTransition(async () => {
      const result = await voidParcelAction(voidModal.id, voidReason.trim())
      if (result.error) {
        setVoidError(result.error)
      } else {
        setVoidModal(null)
        setVoidReason('')
        router.refresh()
      }
    })
  }

  return (
    <>
      {/* Print-only masthead */}
      <div className="hidden print:block px-2 pt-4 pb-3 border-b border-gray-300">
        <h1 className="text-lg font-bold text-gray-900">Subhan Cargo — Storehouse Report</h1>
        <p className="text-sm text-gray-600 mt-0.5">{today}</p>
        <p className="text-sm text-gray-500 mt-0.5">{total} parcel{total !== 1 ? 's' : ''} in store</p>
      </div>

      {/* Search + Print bar — hidden on print */}
      <div className="px-4 py-3 bg-white border-b flex gap-2 print:hidden">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search bilty # or description…"
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <button
          onClick={() => window.print()}
          className="shrink-0 text-sm font-semibold text-white bg-purple-600 px-4 py-2.5 rounded-xl active:opacity-80"
        >
          Print
        </button>
      </div>

      <main className="px-4 py-6 print:px-2 print:py-4">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {q ? (
              <>
                <p className="text-lg font-medium">No results</p>
                <p className="text-sm mt-1">No parcels match &ldquo;{query}&rdquo;</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">Storehouse is empty</p>
                <p className="text-sm mt-1">All parcels have been released</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3 print:space-y-2">
            {filtered.map(row => (
              <div
                key={row.id}
                className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2 break-inside-avoid print:rounded-none print:border-gray-400"
              >
                {/* Bilty + payment badge */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-bold font-mono tracking-wide text-gray-900">
                    {row.bilty_number}
                  </p>
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${
                    row.payment_type === 'TO_PAY'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {row.payment_type === 'TO_PAY' ? `TO PAY · Rs. ${row.amount_due}` : 'PAID'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-gray-700 text-sm">{row.description}</p>

                {/* Units + date + received by */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-0.5">
                  <span>{row.units} unit{row.units !== 1 ? 's' : ''}</span>
                  <span>
                    {row.received_at
                      ? new Date(row.received_at).toLocaleDateString('en-PK', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })
                      : '—'}
                    {row.received_by_name ? ` · ${row.received_by_name}` : ''}
                  </span>
                </div>

                {/* Void button — admin only, hidden on print */}
                {isAdmin && (
                  <div className="flex justify-end pt-1 print:hidden">
                    <button
                      onClick={() => openVoidModal({ id: row.id, bilty_number: row.bilty_number })}
                      className="text-xs font-bold text-red-600 border border-red-300 px-3 py-1.5 rounded-lg active:bg-red-50"
                    >
                      Void
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Void confirmation modal */}
      {voidModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">

            <div>
              <h2 className="text-lg font-bold text-gray-900">Void Bilty</h2>
              <p className="text-sm font-mono text-gray-500 mt-0.5">{voidModal.bilty_number}</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 font-medium leading-relaxed">
              This cannot be undone. The bilty will be permanently voided and removed from all reports.
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="Enter reason for voiding…"
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                autoFocus
              />
            </div>

            {voidError && (
              <p className="text-sm text-red-600 font-medium">{voidError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={closeVoidModal}
                disabled={isPending}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl text-sm active:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidConfirm}
                disabled={!voidReason.trim() || isPending}
                className="flex-1 bg-red-600 text-white font-semibold py-3 rounded-xl text-sm active:opacity-80 disabled:opacity-50"
              >
                {isPending ? 'Voiding…' : 'Confirm Void'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
