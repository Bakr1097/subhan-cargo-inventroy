'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { closeShiftAction, type ShiftSlip } from '@/lib/actions'

type ReceivedParcel = {
  id: string
  bilty_number: string
  description: string
  units: number
  payment_type: string
  amount_due: string | null
  received_at: string | null
}

type ReleasedParcel = {
  id: string
  bilty_number: string
  description: string
  units: number
  payment_type: string
  cash_collected: string | null
  receiver_name: string | null
  released_at: string | null
}

type Props = {
  staffName: string
  shiftStart: string
  receivedParcels: ReceivedParcel[]
  releasedParcels: ReleasedParcel[]
  cashTotal: number
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi',
  })
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Karachi',
  })
}

function fmt(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
}

// ── Handover slip ─────────────────────────────────────────────────────────────

function HandoverSlip({
  slip,
  receivedParcels,
  releasedParcels,
  onDone,
}: {
  slip: ShiftSlip
  receivedParcels: ReceivedParcel[]
  releasedParcels: ReleasedParcel[]
  onDone: () => void
}) {
  return (
    <div className="min-h-screen bg-white print:bg-white">

      {/* Print-only masthead */}
      <div className="hidden print:block px-2 pt-4 pb-3 border-b border-gray-300">
        <h1 className="text-lg font-bold text-gray-900">Subhan Cargo — Shift Handover Slip</h1>
      </div>

      <div className="px-4 py-6 space-y-5 print:px-2 print:py-4 print:space-y-4">

        {/* Staff name strip */}
        <div className="bg-gray-900 text-white rounded-2xl px-5 py-4 print:rounded-none">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Handover Slip</p>
          <p className="text-xl font-bold mt-1">{slip.staffName}</p>
        </div>

        {/* Shift period */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2.5 print:rounded-none print:border-gray-400">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Shift Started</span>
            <span className="text-gray-900 font-semibold">{fmtDateTime(slip.shiftStart)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Shift Closed</span>
            <span className="text-gray-900 font-semibold">{fmtDateTime(slip.closedAt)}</span>
          </div>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-2 gap-3 print:gap-2">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center break-inside-avoid print:rounded-none print:border-gray-400">
            <p className="text-3xl font-bold text-blue-600">{slip.parcelsReceived}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Parcels Received</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center break-inside-avoid print:rounded-none print:border-gray-400">
            <p className="text-3xl font-bold text-green-600">{slip.parcelsReleased}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Parcels Released</p>
          </div>
        </div>

        {/* Cash to hand over — big, prominent */}
        <div className="border-2 border-amber-400 bg-amber-50 rounded-2xl px-5 py-6 text-center break-inside-avoid print:rounded-none print:border-gray-900 print:bg-white">
          <p className="text-sm font-semibold text-gray-600 mb-2">Cash to Hand Over</p>
          <p className="text-5xl font-bold text-amber-700 print:text-gray-900">
            Rs. {fmt(slip.cashCollected)}
          </p>
        </div>

        {/* ── Parcels Received detail ──────────────────────────────────────── */}
        <section className="break-inside-avoid">
          <h2 className="text-sm font-bold text-gray-700 mb-2 mt-2">
            Parcels Received ({receivedParcels.length})
          </h2>
          {receivedParcels.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center border border-gray-200 rounded-xl print:rounded-none print:border-gray-300">
              None
            </p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible rounded-xl border border-gray-200 print:rounded-none print:border-gray-400">
              <table className="w-full text-xs bg-white border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Bilty #</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Description</th>
                    <th className="text-center px-2 py-2 font-semibold text-gray-600">Units</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Payment</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedParcels.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 print:border-gray-200">
                      <td className="px-3 py-2 font-bold font-mono tracking-wide text-gray-900 whitespace-nowrap">
                        {p.bilty_number}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{p.description}</td>
                      <td className="px-2 py-2 text-center text-gray-700">{p.units}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.payment_type === 'TO_PAY' ? (
                          <span className="font-semibold text-amber-700">
                            TO PAY · Rs. {p.amount_due ?? '—'}
                          </span>
                        ) : (
                          <span className="text-green-700 font-semibold">PAID</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                        {fmtTime(p.received_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Parcels Released detail ──────────────────────────────────────── */}
        <section className="break-inside-avoid">
          <h2 className="text-sm font-bold text-gray-700 mb-2 mt-2">
            Parcels Released ({releasedParcels.length})
          </h2>
          {releasedParcels.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center border border-gray-200 rounded-xl print:rounded-none print:border-gray-300">
              None
            </p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible rounded-xl border border-gray-200 print:rounded-none print:border-gray-400">
              <table className="w-full text-xs bg-white border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Bilty #</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Description</th>
                    <th className="text-center px-2 py-2 font-semibold text-gray-600">Units</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Receiver</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Payment</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {releasedParcels.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 print:border-gray-200">
                      <td className="px-3 py-2 font-bold font-mono tracking-wide text-gray-900 whitespace-nowrap">
                        {p.bilty_number}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{p.description}</td>
                      <td className="px-2 py-2 text-center text-gray-700">{p.units}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {p.receiver_name ?? '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.payment_type === 'TO_PAY' ? (
                          <span className="font-semibold text-amber-700">
                            Rs. {p.cash_collected ?? '—'}
                          </span>
                        ) : (
                          <span className="text-green-700 font-semibold">PAID</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                        {fmtTime(p.released_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Buttons — hidden on print */}
        <div className="flex gap-3 pt-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-purple-600 text-white font-semibold py-4 rounded-2xl text-base active:opacity-80"
          >
            Print Slip
          </button>
          <button
            onClick={onDone}
            className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl text-base active:opacity-80"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ShiftClient({
  shiftStart,
  receivedParcels,
  releasedParcels,
  cashTotal,
}: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<'shift' | 'confirm' | 'slip'>('shift')
  // Bundle slip totals + parcel snapshots together so the lists are frozen at
  // close time and unaffected by the server refresh revalidatePath triggers.
  const [slipState, setSlipState] = useState<{
    slip: ShiftSlip
    received: ReceivedParcel[]
    released: ReleasedParcel[]
  } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    // Snapshot props NOW — before the server refresh can replace them with
    // the empty post-close lists.
    const snapReceived = receivedParcels
    const snapReleased = releasedParcels
    startTransition(async () => {
      const result = await closeShiftAction()
      if (result.error) {
        setError(result.error)
        setPhase('shift')
      } else if (result.slip) {
        setSlipState({ slip: result.slip, received: snapReceived, released: snapReleased })
        setPhase('slip')
      }
    })
  }

  function handleDone() {
    setSlipState(null)
    setPhase('shift')
    setError('')
    router.refresh()
  }

  // ── Slip view ───────────────────────────────────────────────────────────────
  if (phase === 'slip' && slipState) {
    return (
      <HandoverSlip
        slip={slipState.slip}
        receivedParcels={slipState.received}
        releasedParcels={slipState.released}
        onDone={handleDone}
      />
    )
  }

  // ── Shift view ──────────────────────────────────────────────────────────────
  return (
    <>
      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Shift started banner */}
      <div className="px-4 py-4 bg-white border-b">
        <p className="text-xs text-gray-500 font-medium">Shift started</p>
        <p className="text-sm font-semibold text-gray-800 mt-0.5">{fmtDateTime(shiftStart)}</p>
      </div>

      <main className="px-4 py-6 space-y-8 pb-28 md:pb-4">

        {/* Cash total — big, prominent */}
        <div className={`border-2 rounded-2xl px-5 py-5 text-center ${
          cashTotal > 0
            ? 'border-amber-400 bg-amber-50'
            : 'border-gray-200 bg-white'
        }`}>
          <p className="text-sm font-semibold text-gray-600 mb-1">TO PAY Cash Collected This Shift</p>
          <p className={`text-4xl font-bold ${cashTotal > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
            Rs. {fmt(cashTotal)}
          </p>
        </div>

        {/* Parcels received */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            Received
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg">
              {receivedParcels.length}
            </span>
          </h2>
          {receivedParcels.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No parcels received this shift</p>
          ) : (
            <div className="space-y-2">
              {receivedParcels.map(p => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold font-mono tracking-wide text-gray-900 text-sm">{p.bilty_number}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{p.description}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400 pt-0.5">{fmtTime(p.received_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Parcels released */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            Released
            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-lg">
              {releasedParcels.length}
            </span>
          </h2>
          {releasedParcels.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No parcels released this shift</p>
          ) : (
            <div className="space-y-2">
              {releasedParcels.map(p => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold font-mono tracking-wide text-gray-900 text-sm">{p.bilty_number}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{p.description}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400 pt-0.5">{fmtTime(p.released_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.receiver_name && (
                      <span className="text-xs text-gray-500">→ {p.receiver_name}</span>
                    )}
                    {p.payment_type === 'TO_PAY' && p.cash_collected && (
                      <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                        Rs. {p.cash_collected}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Mobile: sticky bar pinned to viewport bottom.
          Desktop: inline section with a clear divider above it. */}
      <div className="sticky bottom-0 px-4 py-4 bg-gray-50 border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:static md:px-4 md:pt-8 md:pb-10 md:bg-transparent md:border-t-2 md:border-gray-300 md:shadow-none">
        {phase === 'confirm' ? (
          <div className="bg-white border-2 border-orange-400 rounded-2xl p-5 space-y-4">
            <p className="font-semibold text-gray-900 text-base">Close your shift?</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              This records your handover totals —{' '}
              <strong>{receivedParcels.length}</strong> received,{' '}
              <strong>{releasedParcels.length}</strong> released,{' '}
              <strong>Rs. {fmt(cashTotal)}</strong> cash to hand over.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1 bg-orange-500 text-white font-semibold py-4 rounded-xl text-base disabled:opacity-60 active:opacity-80"
              >
                {isPending ? 'Closing…' : 'Yes, Close Shift'}
              </button>
              <button
                onClick={() => setPhase('shift')}
                disabled={isPending}
                className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-xl text-base disabled:opacity-60 active:opacity-80"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPhase('confirm')}
            className="w-full bg-orange-500 text-white font-bold py-5 rounded-2xl text-lg active:opacity-80"
          >
            Close Shift &amp; Handover
          </button>
        )}
      </div>
    </>
  )
}
