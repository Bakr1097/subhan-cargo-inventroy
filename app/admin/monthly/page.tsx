import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { parcels, users } from '@/db/schema'
import { eq, and, gte, lt, asc, ne } from 'drizzle-orm'
import Link from 'next/link'
import { PrintButton } from '../reports/print-button'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayPKT(): string {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function firstOfMonthPKT(): string {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function fmt(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
}

function formatDateDisplay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-PK', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string }
}) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/')

  const fromDate = searchParams?.from ?? firstOfMonthPKT()
  const toDate   = searchParams?.to   ?? todayPKT()

  const rangeStart = new Date(fromDate + 'T00:00:00+05:00')
  const rangeEnd   = new Date(toDate   + 'T23:59:59.999+05:00')

  // ── Fetch in parallel ──────────────────────────────────────────────────────

  const [receivedRows, releasedRows, toPayRows] = await Promise.all([

    // All parcels received in range (include status for "still in store" count)
    db.select({
      id:         parcels.id,
      status:     parcels.status,
      staff_id:   parcels.received_by,
      staff_name: users.full_name,
    })
    .from(parcels)
    .leftJoin(users, eq(parcels.received_by, users.id))
    .where(and(gte(parcels.received_at, rangeStart), lt(parcels.received_at, rangeEnd), ne(parcels.voided, true)))
    .orderBy(asc(users.full_name)),

    // All parcels released in range
    db.select({
      id:         parcels.id,
      staff_id:   parcels.released_by,
      staff_name: users.full_name,
    })
    .from(parcels)
    .leftJoin(users, eq(parcels.released_by, users.id))
    .where(and(gte(parcels.released_at, rangeStart), lt(parcels.released_at, rangeEnd), ne(parcels.voided, true)))
    .orderBy(asc(users.full_name)),

    // TO_PAY parcels released in range (for cash totals)
    db.select({
      staff_id:       parcels.released_by,
      staff_name:     users.full_name,
      amount_due:     parcels.amount_due,
      cash_collected: parcels.cash_collected,
    })
    .from(parcels)
    .leftJoin(users, eq(parcels.released_by, users.id))
    .where(and(
      eq(parcels.payment_type, 'TO_PAY'),
      eq(parcels.status, 'RELEASED'),
      gte(parcels.released_at, rangeStart),
      lt(parcels.released_at, rangeEnd),
      ne(parcels.voided, true),
    ))
    .orderBy(asc(users.full_name)),
  ])

  // ── Activity summary ───────────────────────────────────────────────────────

  const totalReceived  = receivedRows.length
  const totalReleased  = releasedRows.length
  const totalStillIn   = receivedRows.filter(r => r.status === 'IN_STORE').length

  // ── Cash summary ───────────────────────────────────────────────────────────

  const totalDue       = toPayRows.reduce((s, r) => s + parseFloat(r.amount_due      ?? '0'), 0)
  const totalCollected = toPayRows.reduce((s, r) => s + parseFloat(r.cash_collected  ?? '0'), 0)
  const netDiff        = totalCollected - totalDue

  // ── Per-staff breakdown ────────────────────────────────────────────────────

  type StaffRow = {
    name:      string
    inCount:   number
    outCount:  number
    cashTotal: number
  }

  const staffMap = new Map<string, StaffRow>()

  function ensureStaff(id: string | null, name: string | null) {
    const key = id ?? '__unknown__'
    if (!staffMap.has(key)) {
      staffMap.set(key, { name: name ?? 'Unknown', inCount: 0, outCount: 0, cashTotal: 0 })
    }
    return staffMap.get(key)!
  }

  for (const r of receivedRows) ensureStaff(r.staff_id, r.staff_name).inCount++
  for (const r of releasedRows) ensureStaff(r.staff_id, r.staff_name).outCount++
  for (const r of toPayRows) {
    ensureStaff(r.staff_id, r.staff_name).cashTotal += parseFloat(r.cash_collected ?? '0')
  }

  const staffBreakdown = Array.from(staffMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  // ── Display strings ────────────────────────────────────────────────────────

  const fromDisplay = formatDateDisplay(fromDate)
  const toDisplay   = formatDateDisplay(toDate)
  const rangeLabel  = fromDate === toDate ? fromDisplay : `${fromDisplay} – ${toDisplay}`

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">

      {/* Screen header — hidden on print */}
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10 print:hidden">
        <Link href="/" className="text-blue-600 font-semibold text-base py-1 pr-3">← Home</Link>
        <h1 className="text-lg font-bold text-gray-900">Monthly Report</h1>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </header>

      {/* Date range picker — hidden on print */}
      <div className="px-4 py-4 bg-white border-b print:hidden">
        <form method="GET" action="/admin/monthly" className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">From</label>
              <input
                type="date"
                name="from"
                defaultValue={fromDate}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">To</label>
              <input
                type="date"
                name="to"
                defaultValue={toDate}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 text-white font-semibold px-5 py-3 rounded-xl text-sm active:opacity-80"
          >
            View Report
          </button>
        </form>
      </div>

      {/* Print-only masthead */}
      <div className="hidden print:block px-2 pt-4 pb-3 border-b border-gray-300">
        <h1 className="text-lg font-bold text-gray-900">Subhan Cargo — Monthly Report</h1>
        <p className="text-sm text-gray-600 mt-0.5">{rangeLabel}</p>
      </div>

      <main className="px-4 py-6 space-y-8 print:px-2 print:py-4 print:space-y-6">

        {/* Range label on screen */}
        <p className="text-xs text-gray-500 -mb-4 print:hidden">{rangeLabel}</p>

        {/* ══ SECTION 1: ACTIVITY SUMMARY ════════════════════════════════════ */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 print:mb-2">Activity Summary</h2>

          <div className="grid grid-cols-3 gap-3 print:gap-2">

            <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center break-inside-avoid print:rounded-none print:border-gray-400">
              <p className="text-2xl font-bold text-blue-600">{totalReceived}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">Received</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center break-inside-avoid print:rounded-none print:border-gray-400">
              <p className="text-2xl font-bold text-green-600">{totalReleased}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">Released</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center break-inside-avoid print:rounded-none print:border-gray-400">
              <p className="text-2xl font-bold text-amber-600">{totalStillIn}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">Still In</p>
            </div>

          </div>
        </section>

        {/* ══ SECTION 2: CASH SUMMARY ════════════════════════════════════════ */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 print:mb-2">Cash Summary</h2>

          {toPayRows.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-8 text-center text-gray-400 text-sm print:rounded-none">
              No TO PAY parcels released in this period
            </div>
          ) : (
            <div className="border-2 border-amber-400 bg-amber-50 rounded-2xl px-5 py-4 space-y-3 break-inside-avoid print:rounded-none print:border-gray-900 print:bg-white">

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Amount Due</span>
                <span className="font-bold text-gray-900">Rs. {fmt(totalDue)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Cash Collected</span>
                <span className={`font-bold ${totalCollected < totalDue ? 'text-red-600' : 'text-gray-900'}`}>
                  Rs. {fmt(totalCollected)}
                </span>
              </div>

              <div className="flex justify-between text-sm pt-2 border-t border-amber-300 print:border-gray-400">
                <span className="text-gray-600 font-semibold">Net Difference</span>
                <span className={`font-bold ${
                  netDiff < 0 ? 'text-red-600'
                  : netDiff > 0 ? 'text-green-700'
                  : 'text-gray-500'
                }`}>
                  {netDiff === 0
                    ? 'Balanced'
                    : `${netDiff > 0 ? '+' : ''}Rs. ${fmt(netDiff)}`}
                </span>
              </div>

              <p className="text-xs text-gray-400 pt-1">
                {toPayRows.length} TO PAY parcel{toPayRows.length !== 1 ? 's' : ''} released in this period
              </p>
            </div>
          )}
        </section>

        {/* ══ SECTION 3: PER-STAFF BREAKDOWN ═════════════════════════════════ */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 print:mb-2">Staff Breakdown</h2>

          {staffBreakdown.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-8 text-center text-gray-400 text-sm print:rounded-none">
              No activity in this period
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 break-inside-avoid print:rounded-none print:border-gray-400">
              <table className="w-full text-sm bg-white border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Staff Member</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-600">IN</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-600">OUT</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Cash Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {staffBreakdown.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 print:border-gray-200">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 print:bg-transparent print:border print:border-blue-400">
                          {s.inCount}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700 print:bg-transparent print:border print:border-green-400">
                          {s.outCount}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">
                        {s.cashTotal > 0 ? `Rs. ${fmt(s.cashTotal)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {staffBreakdown.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold print:bg-gray-100 print:border-gray-400">
                      <td className="px-4 py-2.5 text-sm text-gray-700">Total</td>
                      <td className="px-4 py-2.5 text-center text-sm text-gray-900">{totalReceived}</td>
                      <td className="px-4 py-2.5 text-center text-sm text-gray-900">{totalReleased}</td>
                      <td className="px-4 py-2.5 text-right text-sm text-gray-900 whitespace-nowrap">
                        {totalCollected > 0 ? `Rs. ${fmt(totalCollected)}` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
