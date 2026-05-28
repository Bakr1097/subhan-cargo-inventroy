import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { parcels, users, shift_closes } from '@/db/schema'
import { eq, and, gte, desc, asc } from 'drizzle-orm'
import Link from 'next/link'
import { ShiftClient } from './shift-client'

export default async function ShiftPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userId = session.user.id

  // Find last shift close (determines where this shift starts)
  const [lastClose] = await db
    .select({ closed_at: shift_closes.closed_at })
    .from(shift_closes)
    .where(eq(shift_closes.user_id, userId))
    .orderBy(desc(shift_closes.closed_at))
    .limit(1)

  let shiftStart: Date
  if (lastClose?.closed_at) {
    shiftStart = lastClose.closed_at
  } else {
    const [user] = await db
      .select({ created_at: users.created_at })
      .from(users)
      .where(eq(users.id, userId))
    shiftStart = user?.created_at ?? new Date(0)
  }

  // Fetch shift activity in parallel
  const [receivedRows, releasedRows] = await Promise.all([

    db.select({
      id:           parcels.id,
      bilty_number: parcels.bilty_number,
      description:  parcels.description,
      units:        parcels.units,
      payment_type: parcels.payment_type,
      amount_due:   parcels.amount_due,
      received_at:  parcels.received_at,
    })
    .from(parcels)
    .where(and(eq(parcels.received_by, userId), gte(parcels.received_at, shiftStart)))
    .orderBy(asc(parcels.received_at)),

    db.select({
      id:             parcels.id,
      bilty_number:   parcels.bilty_number,
      description:    parcels.description,
      units:          parcels.units,
      payment_type:   parcels.payment_type,
      cash_collected: parcels.cash_collected,
      receiver_name:  parcels.receiver_name,
      released_at:    parcels.released_at,
    })
    .from(parcels)
    .where(and(eq(parcels.released_by, userId), gte(parcels.released_at, shiftStart)))
    .orderBy(asc(parcels.released_at)),

  ])

  const cashTotal = releasedRows.reduce((s, r) =>
    r.payment_type === 'TO_PAY' ? s + parseFloat(r.cash_collected ?? '0') : s, 0
  )

  // Serialise dates to strings for the client boundary
  const received = receivedRows.map(r => ({
    ...r,
    received_at: r.received_at?.toISOString() ?? null,
  }))

  const released = releasedRows.map(r => ({
    ...r,
    released_at: r.released_at?.toISOString() ?? null,
  }))

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">

      {/* Header — hidden when printing (slip replaces the whole view) */}
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10 print:hidden">
        <Link href="/" className="text-blue-600 font-semibold text-base py-1 pr-3">← Home</Link>
        <h1 className="text-lg font-bold text-gray-900">My Shift</h1>
        <span className="ml-auto text-xs text-gray-500 font-medium">{session.user.name}</span>
      </header>

      <ShiftClient
        staffName={session.user.name ?? 'Staff'}
        shiftStart={shiftStart.toISOString()}
        receivedParcels={received}
        releasedParcels={released}
        cashTotal={cashTotal}
      />
    </div>
  )
}
