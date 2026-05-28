'use client'

import { useState } from 'react'

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

export function StorehouseClient({ rows, total }: { rows: Row[]; total: number }) {
  const [query, setQuery] = useState('')

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
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
