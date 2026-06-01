import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { parcels, users } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import Link from 'next/link'

function fmtDateTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Karachi',
  })
}

export default async function VoidedParcelsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/')

  // Alias users table for voided_by join
  const voidedByUser = users

  const rows = await db
    .select({
      id:            parcels.id,
      bilty_number:  parcels.bilty_number,
      description:   parcels.description,
      units:         parcels.units,
      payment_type:  parcels.payment_type,
      amount_due:    parcels.amount_due,
      voided_at:     parcels.voided_at,
      void_reason:   parcels.void_reason,
      voided_by_name: voidedByUser.full_name,
    })
    .from(parcels)
    .leftJoin(voidedByUser, eq(parcels.voided_by, voidedByUser.id))
    .where(eq(parcels.voided, true))
    .orderBy(desc(parcels.voided_at))

  return (
    <div className="min-h-screen bg-gray-50">

      <header className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-blue-600 font-semibold text-base py-1 pr-3">← Home</Link>
        <h1 className="text-lg font-bold text-gray-900">Voided Bilties</h1>
        <span className="ml-auto bg-red-100 text-red-700 text-sm font-bold px-2.5 py-1 rounded-lg">
          {rows.length} voided
        </span>
      </header>

      <main className="px-4 py-6">

        {rows.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">No voided bilties</p>
            <p className="text-sm mt-1">Voided parcels will appear here as an audit trail</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div
                key={row.id}
                className="bg-white border border-red-100 rounded-2xl p-4 space-y-2"
              >
                {/* Bilty + payment badge */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-bold font-mono tracking-wide text-gray-900">
                    {row.bilty_number}
                  </p>
                  <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-700">
                    VOIDED
                  </span>
                </div>

                {/* Description */}
                <p className="text-gray-700 text-sm">{row.description}</p>

                {/* Payment info */}
                <p className="text-xs text-gray-400">
                  {row.units} unit{row.units !== 1 ? 's' : ''} ·{' '}
                  {row.payment_type === 'TO_PAY'
                    ? `TO PAY · Rs. ${row.amount_due}`
                    : 'PAID'}
                </p>

                {/* Void reason */}
                <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 space-y-1">
                  <p className="text-xs font-semibold text-red-700">Reason</p>
                  <p className="text-sm text-gray-700">{row.void_reason ?? '—'}</p>
                </div>

                {/* Voided by + when */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-0.5">
                  <span>Voided by <strong className="text-gray-600">{row.voided_by_name ?? 'Admin'}</strong></span>
                  <span>{fmtDateTime(row.voided_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
