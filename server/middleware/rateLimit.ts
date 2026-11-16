import type { NextFunction, Request, Response } from 'express';

interface BucketEntry {
  timestamps: number[];
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyBuilder?: (req: Request) => string;
  message?: string;
}

/**
 * In-memory sliding-window rate limiter for auth and AI endpoints.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, BucketEntry>();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const cutoff = now - options.windowMs;
    const baseIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = options.keyBuilder ? `${baseIp}:${options.keyBuilder(req)}` : baseIp;

    const existing = store.get(key);
    const active = existing ? existing.timestamps.filter((ts) => ts > cutoff) : [];

    if (active.length >= options.maxRequests) {
      const oldest = active[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: options.message || 'Too many requests. Please wait a moment and try again.',
      });
      return;
    }

    active.push(now);
    store.set(key, { timestamps: active });

    if (store.size > 5000) {
      for (const [entryKey, entry] of store.entries()) {
        if (entry.timestamps.every((ts) => ts <= cutoff)) {
          store.delete(entryKey);
        }
      }
    }

    next();
  };
}
