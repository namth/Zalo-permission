import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'auth_token';
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'zalo-permission-admin-secret-key-2024'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Define protected paths
  const isProtectedPath = pathname.startsWith('/admin');
  const isProtectedApi = pathname.startsWith('/api/admin');

  if (!isProtectedPath && !isProtectedApi) {
    return NextResponse.next();
  }

    // 2. Check for auth token (Cookie or Authorization header)
  let token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    if (isProtectedApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  try {
    // 3. Verify token
    let role: string | null = null;
    let userPayload: any = null;

    if (token.startsWith('zp_')) {
      // Fixed API Token - Verify via internal API
      // Use localhost to avoid SSL/DNS issues with public origin inside Docker
      const internalOrigin = 'http://127.0.0.1:3000';
      try {
        const verifyRes = await fetch(`${internalOrigin}/api/auth/verify-api-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        if (verifyRes.ok) {
          const data = await verifyRes.json();
          if (data.success) {
            userPayload = data.user;
            role = userPayload.role;
          }
        }
      } catch (err) {
        console.error('Middleare API token fetch error:', err);
      }
    } else {
      // Standard JWT Token
      const { payload } = await jwtVerify(token, SECRET);
      userPayload = payload;
      role = (payload as any).role;
    }

    if (!userPayload) {
      throw new Error('Unauthorized');
    }

    // 4. Role-based access control for Frontend
    if (isProtectedPath) {
      const adminOnlyPaths = [
        '/admin/dashboard',
        '/admin/users',
        '/admin/tools',
        '/admin/tool-groups'
      ];
      
      const isRestrictedForUser = adminOnlyPaths.some(path => pathname.startsWith(path));
      
      if (role !== 'admin' && isRestrictedForUser) {
        // Redirect non-admin to Workspaces
        return NextResponse.redirect(new URL('/admin/workspaces', request.url));
      }

      // Special case: /admin without subpath usually goes to dashboard
      if (role !== 'admin' && pathname === '/admin') {
        return NextResponse.redirect(new URL('/admin/workspaces', request.url));
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware auth error:', error);
    if (isProtectedApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
