import { auth } from '@/auth'
import { logoutAction } from '@/lib/actions'

export default async function PendingPage() {
  const session = await auth()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6">
      <div className="max-w-sm mx-auto w-full text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Awaiting Approval</h1>
        <p className="text-gray-600 mb-2">
          Hi <span className="font-medium">{session?.user?.name}</span>, your account has been created.
        </p>
        <p className="text-gray-600 mb-8">
          An admin needs to activate your account before you can access the app. Please check back later or contact your supervisor.
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full border border-gray-300 text-gray-700 font-medium py-4 rounded-2xl active:bg-gray-100"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
