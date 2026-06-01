import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { parcels, users } from '@/db/schema'
import { eq, and, gte, lt, asc, ne } from 'drizzle-orm'
import Link from 'next/link'
import { PrintButton } from './print-button'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayPKT(): string {
  const pkt = new Date(Date.now() + 5 * 60 * 60 * 1000)
  return pkt.toISOString().slice(0, 10)
}

function formatTimePKT(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi',
  })
}

function formatDateDisplay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-PK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmt(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { date?: string }
}) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/')

  const selectedDate = searchParams?.date ?? todayPKT()

  // PKT day boundaries (UTC+5)
  const startDate = new Date(selectedDate + 'T00:00:00+05:00')
  const endDate   = new Date(selectedDate + 'T23:59:59.999+05:00')

  // ── Fetch handover events in parallel ──────────────────────────────────────

  const [inEvents, outEvents, toPayReleased] = await Promise.all([

    // IN events: parcels received on this date
    db.select({
      bilty_number: parcels.bilty_number,
      description:  parcels.description,
      units:        parcels.units,
      time:         parcels.received_at,
      staff_name:   users.full_name,
    })
    .from(parcels)
    .leftJoin(users, eq(parcels.received_by, users.id))
    .where(and(gte(parcels.received_at, startDate), lt(parcels.received_at, endDate), ne(parcels.voided, true)))
    .orderBy(asc(parcels.received_at)),

    // OUT events: parcels released on this date
    db.select({
      bilty_number: parcels.bilty_number,
      description:  parcels.description,
      units:        parcels.units,
      time:         parcels.released_at,
      staff_name:   users.full_name,
    })
    .from(parcels)
    .leftJoin(users, eq(parcels.released_by, users.id))
    .where(and(gte(parcels.released_at, startDate), lt(parcels.released_at, endDate), ne(parcels.voided, true)))
    .orderBy(asc(parcels.released_at)),

    // TO_PAY parcels released on this date (for cash report)
    db.select({
      bilty_number:   parcels.bilty_number,
      description:    parcels.description,
      amount_due:     parcels.amount_due,
      cash_collected: parcels.cash_collected,
      released_at:    parcels.released_at,
      staff_id:       parcels.released_by,
      staff_name:     users.full_name,
    })
    .from(parcels)
    .leftJoin(users, eq(parcels.released_by, users.id))
    .where(and(
      eq(parcels.payment_type, 'TO_PAY'),
      eq(parcels.status, 'RELEASED'),
      gte(parcels.released_at, startDate),
      lt(parcels.released_at, endDate),
      ne(parcels.voided, true),
    ))
    .orderBy(asc(users.full_name), asc(parcels.released_at)),
  ])

  // ── Build combined & sorted handover event list ────────────────────────────

  type HandoverEvent = {
    bilty_number: string
    description:  string
    units:        number
    time:         Date | null
    staff_name:   string | null
    type:         'IN' | 'OUT'
  }

  const handoverEvents: HandoverEvent[] = [
    ...inEvents.map(e  => ({ ...e, type: 'IN'  as const })),
    ...outEvents.map(e => ({ ...e, type: 'OUT' as const })),
  ].sort((a, b) => (a.time?.getTime() ?? 0) - (b.time?.getTime() ?? 0))

  // ── Group TO_PAY rows by releasing staff member ────────────────────────────

  type StaffGroup = {
    staff_name:      string
    rows:            typeof toPayReleased
    total_due:       number
    total_collected: number
  }

  const staffMap = new Map<string, StaffGroup>()
  for (const row of toPayReleased) {
    const key = row.staff_id ?? '__unknown__'
    if (!staffMap.has(key)) {
      staffMap.set(key, {
        staff_name:      row.staff_name ?? 'Unknown',
        rows:            [],
        total_due:       0,
        total_collected: 0,
      })
    }
    const group = staffMap.get(key)!
    group.rows.push(row)
    group.total_due       += parseFloat(row.amount_due     ?? '0')
    group.total_collected += parseFloat(row.cash_collected ?? '0')
  }

  const staffGroups        = Array.from(staffMap.values())
  const grandTotalDue      = staffGroups.reduce((s, g) => s + g.total_due,       0)
  const grandTotalCollected = staffGroups.reduce((s, g) => s + g.total_collected, 0)
  const grandDiff          = grandTotalCollected - grandTotalDue

  const dateDisplay = formatDateDisplay(selectedDate)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">

      {/* Screen header — hidden when printing */}
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10 print:hidden">
        <Link href="/" className="text-blue-600 font-semibold text-base py-1 pr-3">← Home</Link>
        <h1 className="text-lg font-bold text-gray-900">Reports</h1>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </header>

      {/* Date picker — hidden when printing */}
      <div className="px-4 py-4 bg-white border-b print:hidden">
        <form method="GET" action="/admin/reports" className="flex gap-2">
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          />
          <button
            type="submit"
            className="bg-purple-600 text-white font-semibold px-5 py-3 rounded-xl text-sm active:opacity-80"
          >
            View
          </button>
        </form>
      </div>

      {/* Print-only masthead */}
      <div className="hidden print:block px-2 pt-4 pb-3 border-b border-gray-300">
        <h1 className="text-lg font-bold text-gray-900">Subhan Cargo — Daily Reports</h1>
        <p className="text-sm text-gray-600 mt-0.5">{dateDisplay}</p>
      </div>

      <main className="px-4 py-6 space-y-10 print:px-2 print:py-4 print:space-y-8">

        {/* ══ REPORT 1: DAILY HANDOVER LOG ═══════════════════════════════════ */}
        <section>

          <div className="flex items-baseline justify-between mb-3 print:mb-2">
            <h2 className="text-base font-bold text-gray-900">Daily Handover Log</h2>
            <span className="text-xs text-gray-500 print:hidden">{dateDisplay}</span>
          </div>

          {handoverEvents.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-10 text-center text-gray-400 text-sm print:rounded-none">
              No activity recorded on this date
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 print:rounded-none print:border-gray-400">
                <table className="w-full text-sm bg-white border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Time</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Bilty #</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Description</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-gray-600">Units</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-gray-600">Action</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {handoverEvents.map((ev, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap font-mono text-xs">
                          {formatTimePKT(ev.time)}
                        </td>
                        <td className="px-3 py-2.5 font-bold font-mono tracking-wide text-gray-900 whitespace-nowrap text-xs">
                          {ev.bilty_number}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{ev.description}</td>
                        <td className="px-3 py-2.5 text-center text-gray-700">{ev.units}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded print:bg-transparent print:border ${
                            ev.type === 'IN'
                              ? 'bg-blue-100 text-blue-700 print:border-blue-400'
                              : 'bg-green-100 text-green-700 print:border-green-400'
                          }`}>
                            {ev.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                          {ev.staff_name ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Event count summary */}
              <div className="flex gap-5 mt-2 px-1 text-xs text-gray-500">
                <span>IN: <strong className="text-gray-800">{inEvents.length}</strong></span>
                <span>OUT: <strong className="text-gray-800">{outEvents.length}</strong></span>
                <span>Total: <strong className="text-gray-800">{handoverEvents.length}</strong></span>
              </div>
            </>
          )}
        </section>

        {/* ══ REPORT 2: DAILY TO-PAY CASH REPORT ════════════════════════════ */}
        <section>

          <div className="flex items-baseline justify-between mb-3 print:mb-2">
            <h2 className="text-base font-bold text-gray-900">Daily To-Pay Cash Report</h2>
            <span className="text-xs text-gray-500 print:hidden">{dateDisplay}</span>
          </div>

          {staffGroups.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-10 text-center text-gray-400 text-sm print:rounded-none">
              No TO PAY parcels released on this date
            </div>
          ) : (
            <div className="space-y-4 print:space-y-4">

              {/* One block per staff member */}
              {staffGroups.map((group, gi) => (
                <div
                  key={gi}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden break-inside-avoid print:rounded-none print:border-gray-400"
                >
                  {/* Staff name header */}
                  <div className="bg-purple-50 px-4 py-2.5 border-b border-gray-200 print:bg-gray-100 print:border-gray-400">
                    <p className="font-bold text-gray-900 text-sm">{group.staff_name}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs print:bg-white print:border-gray-300">
                          <th className="text-left px-4 py-2 font-semibold text-gray-500 whitespace-nowrap">Bilty #</th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-500">Description</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-500 whitespace-nowrap">Amount Due</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-500 whitespace-nowrap">Collected</th>
                          <th className="text-right px-4 py-2 font-semibold text-gray-500 whitespace-nowrap">Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row, ri) => {
                          const due       = parseFloat(row.amount_due     ?? '0')
                          const collected = parseFloat(row.cash_collected ?? '0')
                          const diff      = collected - due
                          return (
                            <tr key={ri} className="border-b border-gray-100 last:border-0 print:border-gray-200">
                              <td className="px-4 py-2.5 font-bold font-mono tracking-wide text-gray-900 text-xs whitespace-nowrap">
                                {row.bilty_number}
                              </td>
                              <td className="px-4 py-2.5 text-gray-700">{row.description}</td>
                              <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">
                                Rs.&nbsp;{fmt(due)}
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <span className={collected < due ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                                  Rs.&nbsp;{fmt(collected)}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <span className={diff < 0 ? 'text-red-600 font-semibold' : diff > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                                  {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}Rs.&nbsp;${fmt(diff)}`}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold print:bg-gray-100 print:border-gray-400">
                          <td colSpan={2} className="px-4 py-2.5 text-sm text-gray-700">
                            Subtotal — {group.rows.length} parcel{group.rows.length !== 1 ? 's' : ''}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm text-gray-900 whitespace-nowrap">
                            Rs.&nbsp;{fmt(group.total_due)}
                          </td>
                          <td className={`px-4 py-2.5 text-right text-sm whitespace-nowrap ${
                            group.total_collected < group.total_due ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            Rs.&nbsp;{fmt(group.total_collected)}
                          </td>
                          <td className={`px-4 py-2.5 text-right text-sm whitespace-nowrap ${
                            group.total_collected - group.total_due < 0 ? 'text-red-600'
                            : group.total_collected - group.total_due > 0 ? 'text-green-700'
                            : 'text-gray-400'
                          }`}>
                            {group.total_collected === group.total_due
                              ? '—'
                              : `${group.total_collected > group.total_due ? '+' : ''}Rs. ${fmt(group.total_collected - group.total_due)}`}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}

              {/* Grand Total */}
              <div className="border-2 border-amber-400 bg-amber-50 rounded-2xl px-5 py-4 space-y-2 break-inside-avoid print:rounded-none print:border-gray-900 print:bg-white">
                <p className="text-sm font-bold text-gray-900 mb-1">
                  Grand Total — {toPayReleased.length} parcel{toPayReleased.length !== 1 ? 's' : ''}, {staffGroups.length} staff member{staffGroups.length !== 1 ? 's' : ''}
                </p>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Amount Due</span>
                  <span className="font-bold text-gray-900">Rs. {fmt(grandTotalDue)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Cash Collected</span>
                  <span className={`font-bold ${grandTotalCollected < grandTotalDue ? 'text-red-600' : 'text-gray-900'}`}>
                    Rs. {fmt(grandTotalCollected)}
                  </span>
                </div>

                <div className="flex justify-between text-sm pt-2 border-t border-amber-300 print:border-gray-400">
                  <span className="text-gray-600 font-semibold">Net Difference</span>
                  <span className={`font-bold ${
                    grandDiff < 0 ? 'text-red-600'
                    : grandDiff > 0 ? 'text-green-700'
                    : 'text-gray-500'
                  }`}>
                    {grandDiff === 0
                      ? 'Balanced'
                      : `${grandDiff > 0 ? '+' : ''}Rs. ${fmt(grandDiff)}`}
                  </span>
                </div>
              </div>

            </div>
          )}
        </section>

      </main>
    </div>
  )
}
