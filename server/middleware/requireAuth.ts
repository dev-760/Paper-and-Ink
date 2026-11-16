import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { serverConfig } from '../config.ts';
import { getSupabaseAdmin } from '../services/supabase/admin.ts';

export interface AuthenticatedUser {
  id: string;
  username?: string;
  token: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthenticatedUser;
  }
}

let jwksResolver: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwksResolver() {
  if (!jwksResolver && serverConfig.supabaseJwksUrl) {
    jwksResolver = createRemoteJWKSet(new URL(serverConfig.supabaseJwksUrl));
  }
  return jwksResolver;
}

/**
 * Verifies the Bearer Supabase access token using JWKS (when asymmetric) and
 * confirms active session/user status via Supabase Auth.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    const protectedHeader = decodeProtectedHeader(token);
    if (protectedHeader.alg && protectedHeader.alg !== 'HS256') {
      const jwks = getJwksResolver();
      if (jwks) {
        await jwtVerify(token, jwks, {
          issuer: `${serverConfig.supabaseUrl}/auth/v1`,
          audience: 'authenticated',
        });
      }
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired session.' });
      return;
    }

    const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
    req.authUser = {
      id: data.user.id,
      username: typeof meta.username === 'string' ? meta.username : undefined,
      token,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.' });
  }
}
