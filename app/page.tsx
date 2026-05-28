import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { logoutAction } from '@/lib/actions'
import Link from 'next/link'

export default async function HomePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Subhan Cargo</h1>
          <p className="text-xs text-gray-500">{session.user.name} · {session.user.role}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm text-gray-600 border border-gray-300 px-3 py-2 rounded-lg active:bg-gray-100"
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="px-4 py-6 space-y-3">
        <NavCard
          href="/receive"
          color="bg-blue-600"
          title="Receive Parcel"
          subtitle="Log a parcel INTO the storehouse"
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
          }
        />
        <NavCard
          href="/release"
          color="bg-green-600"
          title="Release Parcel"
          subtitle="Log a parcel OUT of the storehouse"
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 13l4 4L19 7" />
          }
        />
        <NavCard
          href="/storehouse"
          color="bg-amber-600"
          title="Storehouse"
          subtitle="View all parcels currently in store"
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          }
        />
        <NavCard
          href="/shift"
          color="bg-orange-600"
          title="My Shift"
          subtitle="View activity and close your shift"
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          }
        />
        {isAdmin && (
          <>
            <NavCard
              href="/admin/approvals"
              color="bg-purple-600"
              title="Approvals"
              subtitle="Approve or reject staff accounts"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
              }
            />
            <NavCard
              href="/admin/reports"
              color="bg-red-600"
              title="Reports"
              subtitle="Daily handover & cash reports"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              }
            />
            <NavCard
              href="/admin/monthly"
              color="bg-teal-600"
              title="Monthly Report"
              subtitle="Activity & cash summary by date range"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              }
            />
            <NavCard
              href="/admin/shifts"
              color="bg-slate-700"
              title="Staff Shifts"
              subtitle="View staff shift reports and history"
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              }
            />
          </>
        )}
      </main>
    </div>
  )
}

function NavCard({
  href, color, title, subtitle, icon,
}: {
  href: string
  color: string
  title: string
  subtitle: string
  icon: React.ReactNode
}) {
  return (
    <Link href={href} className={`flex items-center gap-4 ${color} text-white rounded-2xl p-5 active:opacity-80`}>
      <div className="bg-white/20 rounded-xl p-3 shrink-0">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {icon}
        </svg>
      </div>
      <div>
        <div className="text-lg font-bold leading-tight">{title}</div>
        <div className="text-sm opacity-80 mt-0.5">{subtitle}</div>
      </div>
    </Link>
  )
}
