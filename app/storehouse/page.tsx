import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { parcels, users } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import Link from 'next/link'

export default async function StorehousePage() {
  const session = await auth()
  if (!session) redirect('/login')

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
    .where(eq(parcels.status, 'IN_STORE'))
    .orderBy(desc(parcels.received_at))

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-blue-600 font-semibold text-base py-1 pr-3">← Home</Link>
        <h1 className="text-lg font-bold text-gray-900">Storehouse</h1>
        <span className="ml-auto bg-amber-100 text-amber-700 text-sm font-bold px-2.5 py-1 rounded-lg">
          {rows.length} in store
        </span>
      </header>

      <main className="px-4 py-6">
        {rows.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">Storehouse is empty</p>
            <p className="text-sm mt-1">All parcels have been released</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={row.id} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">

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
    </div>
  )
}
