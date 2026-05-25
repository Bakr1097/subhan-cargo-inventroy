import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { approveUserAction, rejectUserAction } from '@/lib/actions'

export default async function ApprovalsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/')

  const pending = await db
    .select({
      id: users.id,
      full_name: users.full_name,
      email: users.email,
      created_at: users.created_at,
    })
    .from(users)
    .where(eq(users.status, 'PENDING'))
    .orderBy(asc(users.created_at))

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-blue-600 font-semibold text-base py-1 pr-3">← Home</Link>
        <h1 className="text-lg font-bold text-gray-900">Approvals</h1>
        {pending.length > 0 && (
          <span className="ml-auto bg-purple-100 text-purple-700 text-sm font-bold px-2.5 py-1 rounded-lg">
            {pending.length} pending
          </span>
        )}
      </header>

      <main className="px-4 py-6">
        {pending.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">All caught up</p>
            <p className="text-sm mt-1">No staff accounts awaiting approval</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(user => (
              <div key={user.id} className="bg-white border border-gray-200 rounded-2xl p-4">

                {/* User info */}
                <p className="font-bold text-gray-900 text-base">{user.full_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Registered{' '}
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-PK', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })
                    : '—'}
                </p>

                {/* Approve / Reject */}
                <form className="flex gap-2 mt-4">
                  <input type="hidden" name="user_id" value={user.id} />
                  <button
                    formAction={approveUserAction}
                    type="submit"
                    className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl text-sm active:opacity-80"
                  >
                    Approve
                  </button>
                  <button
                    formAction={rejectUserAction}
                    type="submit"
                    className="flex-1 bg-red-50 text-red-600 border border-red-200 font-semibold py-3 rounded-xl text-sm active:opacity-80"
                  >
                    Reject
                  </button>
                </form>

              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
