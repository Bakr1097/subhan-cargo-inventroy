import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { parcels, users, shift_closes } from '@/db/schema'
import { eq, and, gte, desc, asc } from 'drizzle-orm'
import Link from 'next/link'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Karachi',
  })
}

function fmtTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi',
  })
}

function fmt(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminShiftsPage({
  searchParams,
}: {
  searchParams?: { staff?: string }
}) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/')

  // All active users (staff + admins)
  const staffList = await db
    .select({ id: users.id, full_name: users.full_name })
    .from(users)
    .where(eq(users.status, 'ACTIVE'))
    .orderBy(asc(users.full_name))

  // Resolve selected staff ID
  const selectedId = searchParams?.staff
    ?? staffList[0]?.id
    ?? null

  const selectedStaff = staffList.find(s => s.id === selectedId) ?? staffList[0] ?? null

  // ── Per-staff data (only when a staff member is selected) ──────────────────

  type ShiftRow = {
    id: string
    bilty_number: string
    description: string
    payment_type?: string
    cash_collected?: string | null
    receiver_name?: string | null
    received_at?: Date | null
    released_at?: Date | null
  }

  let shiftStart: Date | null = null
  let receivedRows: ShiftRow[] = []
  let releasedRows: ShiftRow[] = []
  let cashTotal = 0
  let history: { id: string; closed_at: Date | null; parcels_received: number; parcels_released: number; cash_collected: string }[] = []

  if (selectedStaff) {
    const userId = selectedStaff.id

    // Last shift close for this staff member
    const [lastClose] = await db
      .select({ closed_at: shift_closes.closed_at })
      .from(shift_closes)
      .where(eq(shift_closes.user_id, userId))
      .orderBy(desc(shift_closes.closed_at))
      .limit(1)

    if (lastClose?.closed_at) {
      shiftStart = lastClose.closed_at
    } else {
      const [user] = await db
        .select({ created_at: users.created_at })
        .from(users)
        .where(eq(users.id, userId))
      shiftStart = user?.created_at ?? new Date(0)
    }

    const start = shiftStart!

    const [recv, rel, hist] = await Promise.all([

      db.select({
        id:           parcels.id,
        bilty_number: parcels.bilty_number,
        description:  parcels.description,
        received_at:  parcels.received_at,
      })
      .from(parcels)
      .where(and(eq(parcels.received_by, userId), gte(parcels.received_at, start)))
      .orderBy(asc(parcels.received_at)),

      db.select({
        id:             parcels.id,
        bilty_number:   parcels.bilty_number,
        description:    parcels.description,
        payment_type:   parcels.payment_type,
        cash_collected: parcels.cash_collected,
        receiver_name:  parcels.receiver_name,
        released_at:    parcels.released_at,
      })
      .from(parcels)
      .where(and(eq(parcels.released_by, userId), gte(parcels.released_at, start)))
      .orderBy(asc(parcels.released_at)),

      db.select({
        id:               shift_closes.id,
        closed_at:        shift_closes.closed_at,
        parcels_received: shift_closes.parcels_received,
        parcels_released: shift_closes.parcels_released,
        cash_collected:   shift_closes.cash_collected,
      })
      .from(shift_closes)
      .where(eq(shift_closes.user_id, userId))
      .orderBy(desc(shift_closes.closed_at)),
    ])

    receivedRows = recv
    releasedRows = rel
    history = hist
    cashTotal = rel.reduce((s, r) =>
      r.payment_type === 'TO_PAY' ? s + parseFloat(r.cash_collected ?? '0') : s, 0
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      <header className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-blue-600 font-semibold text-base py-1 pr-3">← Home</Link>
        <h1 className="text-lg font-bold text-gray-900">Staff Shifts</h1>
      </header>

      <main className="px-4 py-6 space-y-8">

        {staffList.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">No active staff</p>
            <p className="text-sm mt-1">Approve staff accounts first</p>
          </div>
        ) : (
          <>
            {/* Staff picker */}
            <form method="GET" action="/admin/shifts" className="flex gap-2">
              <select
                name="staff"
                defaultValue={selectedStaff?.id ?? ''}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-slate-700 text-white font-semibold px-5 py-3 rounded-xl text-sm active:opacity-80"
              >
                View
              </button>
            </form>

            {selectedStaff && (
              <>
                {/* ── CURRENT SHIFT ─────────────────────────────────────────── */}
                <section>
                  <h2 className="text-base font-bold text-gray-900 mb-1">
                    Current Shift — {selectedStaff.full_name}
                  </h2>
                  {shiftStart && (
                    <p className="text-xs text-gray-500 mb-4">
                      Started {fmtDateTime(shiftStart)}
                    </p>
                  )}

                  {/* Cash total */}
                  <div className={`border-2 rounded-2xl px-5 py-4 text-center mb-5 ${
                    cashTotal > 0
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-gray-200 bg-white'
                  }`}>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Cash Collected This Shift</p>
                    <p className={`text-3xl font-bold ${cashTotal > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                      Rs. {fmt(cashTotal)}
                    </p>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{receivedRows.length}</p>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Received</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{releasedRows.length}</p>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Released</p>
                    </div>
                  </div>

                  {/* Received list */}
                  <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    Received
                    <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg">
                      {receivedRows.length}
                    </span>
                  </h3>
                  {receivedRows.length === 0 ? (
                    <p className="text-sm text-gray-400 py-3 text-center mb-4">None</p>
                  ) : (
                    <div className="space-y-2 mb-5">
                      {receivedRows.map(p => (
                        <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold font-mono tracking-wide text-gray-900 text-sm">{p.bilty_number}</p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{p.description}</p>
                          </div>
                          <span className="shrink-0 text-xs text-gray-400 pt-0.5">{fmtTime(p.received_at ?? null)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Released list */}
                  <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    Released
                    <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-lg">
                      {releasedRows.length}
                    </span>
                  </h3>
                  {releasedRows.length === 0 ? (
                    <p className="text-sm text-gray-400 py-3 text-center">None</p>
                  ) : (
                    <div className="space-y-2">
                      {releasedRows.map(p => (
                        <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold font-mono tracking-wide text-gray-900 text-sm">{p.bilty_number}</p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{p.description}</p>
                            </div>
                            <span className="shrink-0 text-xs text-gray-400 pt-0.5">{fmtTime(p.released_at ?? null)}</span>
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

                {/* ── SHIFT CLOSE HISTORY ───────────────────────────────────── */}
                <section>
                  <h2 className="text-base font-bold text-gray-900 mb-3">
                    Shift History — {selectedStaff.full_name}
                  </h2>

                  {history.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-8 text-center text-gray-400 text-sm">
                      No shifts closed yet
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-gray-200">
                      <table className="w-full text-sm bg-white border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Closed At</th>
                            <th className="text-center px-3 py-2.5 font-semibold text-gray-600">IN</th>
                            <th className="text-center px-3 py-2.5 font-semibold text-gray-600">OUT</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Cash</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0">
                              <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap text-xs">
                                {fmtDateTime(h.closed_at)}
                              </td>
                              <td className="px-3 py-2.5 text-center text-gray-700">{h.parcels_received}</td>
                              <td className="px-3 py-2.5 text-center text-gray-700">{h.parcels_released}</td>
                              <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">
                                {parseFloat(h.cash_collected) > 0
                                  ? `Rs. ${fmt(parseFloat(h.cash_collected))}`
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
