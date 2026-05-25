import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const session = req.auth
  const { pathname } = req.nextUrl

  // Let NextAuth's own API routes through
  if (pathname.startsWith('/api/auth')) return NextResponse.next()

  const publicPaths = ['/login', '/signup', '/pending']
  const isPublic = publicPaths.includes(pathname)

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session) {
    const { status, role } = session.user as { status: string; role: string }

    // PENDING users can only see the pending page
    if (status === 'PENDING' && pathname !== '/pending') {
      return NextResponse.redirect(new URL('/pending', req.url))
    }

    // ACTIVE users get redirected away from public auth pages
    if (status === 'ACTIVE' && isPublic) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Non-admins cannot access /admin/* routes
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
