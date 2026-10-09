import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'auth_token';
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'zalo-permission-admin-secret-key-2024'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Backward compatibility: redirect any legacy /admin/... to /...
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const newPath = pathname.replace(/^\/admin/, '') || '/';
    return NextResponse.redirect(new URL(newPath, request.url));
  }

  const isApi = pathname.startsWith('/api');
  const isProtectedApi = pathname.startsWith('/api/admin');
  const isPublicPath = pathname === '/login' || pathname === '/register';

  // Protected frontend path is any non-api, non-public path
  const isProtectedPath = !isApi && !isPublicPath;

  if (!isProtectedPath && !isProtectedApi) {
    return NextResponse.next();
  }

  // Check for auth token (Cookie or Authorization header)
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
    // Verify token
    let role: string | null = null;
    let userPayload: any = null;

    if (token.startsWith('zp_')) {
      // Fixed API Token - Verify via internal API
      const port = process.env.PORT || '7140';
      const internalOrigin = `http://127.0.0.1:${port}`;
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
        console.error('Middleware API token fetch error:', err);
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

    // Role-based access control for Frontend
    if (isProtectedPath) {
      const adminOnlyPaths = [
        '/dashboard',
        '/users',
        '/tools',
        '/tool-groups'
      ];
      
      const isRestrictedForUser = adminOnlyPaths.some(
        path => pathname === path || pathname.startsWith(path + '/')
      );
      
      if (role !== 'admin' && isRestrictedForUser) {
        // Redirect non-admin to Workspaces
        return NextResponse.redirect(new URL('/workspaces', request.url));
      }

      // Special case: / for non-admin
      if (role !== 'admin' && pathname === '/') {
        return NextResponse.redirect(new URL('/workspaces', request.url));
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

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
