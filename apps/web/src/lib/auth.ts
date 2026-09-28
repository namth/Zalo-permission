import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'zalo-permission-admin-secret-key-2024'
);

export const COOKIE_NAME = 'auth_token';

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Sign JWT token
 */
export async function signToken(payload: any): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h') // 24 hours
    .sign(SECRET);
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Get current user from request (cookies or Authorization header)
 */
export async function getCurrentUser(req: any): Promise<any> {
  let token = req.cookies?.get?.(COOKIE_NAME)?.value || req.cookies?.[COOKIE_NAME];
  
  if (!token && typeof req.headers?.get === 'function') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  if (token.startsWith('zp_')) {
    // For fixed tokens, we need to verify against database
    // This is safer in API routes which have DB access
    // Note: This requires UserService, so we might have circular dependency if not careful
    // But getCurrentUser is small enough.
    const { UserService } = await import('@/services/user.service');
    const user = await UserService.getUserByApiToken(token);
    if (!user) return null;
    return {
      id: user.id,
      zalo_id: user.zalo_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };
  }

  return verifyToken(token);
}
