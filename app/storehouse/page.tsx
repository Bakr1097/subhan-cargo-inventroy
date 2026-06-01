import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { parcels, users } from '@/db/schema'
import { eq, and, desc, ne } from 'drizzle-orm'
import Link from 'next/link'
import { StorehouseClient } from './storehouse-client'

export default async function StorehousePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'

  const rows = await db
    .select({
      id: parcels.id,
      bilty_number: parcels.bilty_number,
      description: parcels.description,
      units: parcels.units,
      payment_type: parcels.payment_type,
      amount_due: parcels.amount_due,
      received_at: parcels.received_at,
      received_by_name: users.full_name,
    })
    .from(parcels)
    .leftJoin(users, eq(parcels.received_by, users.id))
    .where(and(eq(parcels.status, 'IN_STORE'), ne(parcels.voided, true)))
    .orderBy(desc(parcels.received_at))

  // Serialise dates to strings so they pass the server→client boundary cleanly
  const serialised = rows.map(r => ({
    ...r,
    received_at: r.received_at ? r.received_at.toISOString() : null,
  }))

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">

      {/* Header — hidden when printing */}
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10 print:hidden">
        <Link href="/" className="text-blue-600 font-semibold text-base py-1 pr-3">← Home</Link>
        <h1 className="text-lg font-bold text-gray-900">Storehouse</h1>
        <span className="ml-auto bg-amber-100 text-amber-700 text-sm font-bold px-2.5 py-1 rounded-lg">
          {rows.length} in store
        </span>
      </header>

      <StorehouseClient rows={serialised} total={rows.length} isAdmin={isAdmin} />
    </div>
  )
}
