import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/register', '/verify', '/set-password', '/pending-activation']
  
  // API paths that are public
  const publicApiPaths = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/register',
    '/api/auth/verify-code',
    '/api/auth/set-password',
    '/api/auth/resend-code',
  ]
  
  // Check if the path is public
  const isPublicPath = publicPaths.includes(pathname)
  const isPublicApi = publicApiPaths.some(path => pathname.startsWith(path))

  // Get the user session cookie
  const userSession = request.cookies.get('user_session')

  // If trying to access protected route without session, redirect to login
  if (!isPublicPath && !isPublicApi && !userSession) {
    const loginUrl = new URL('/login', request.url)
    // Add redirect parameter to know where user wanted to go
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // If already logged in and trying to access login/register pages, redirect to home
  if (userSession && ['/login', '/register', '/verify', '/set-password'].includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
