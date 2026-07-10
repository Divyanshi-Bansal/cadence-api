import { verifyToken } from '@clerk/backend';
import { Request, Response, NextFunction } from 'express';
import { syncUser } from '../lib/syncUser';

// Augment the Express Request type so downstream handlers get full type-safety.
declare global {
  namespace Express {
    interface Request {
      /** The verified Clerk user id (e.g. "user_2abc…") */
      userId: string;
    }
  }
}

/**
 * requireAuth middleware
 *
 * 1. Reads the Bearer token from the Authorization header.
 * 2. Verifies it against Clerk using the standalone verifyToken() helper
 *    (JWKS-backed — requires CLERK_SECRET_KEY in env).
 * 3. Attaches `req.userId` for downstream route handlers.
 * 4. Calls syncUser() to upsert the caller in our DB on first visit.
 *
 * Usage:
 *   router.get('/protected', requireAuth, myHandler);
 *   app.use('/habits', requireAuth, habitRoutes);
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or malformed Authorization header.' });
      return;
    }

    const token = authHeader.slice(7); // strip "Bearer "

    // verifyToken is a standalone export in @clerk/backend v3.
    // It validates the JWT signature + expiry via Clerk's JWKS endpoint.
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    // `sub` is the Clerk user id (e.g. "user_2abc…")
    const clerkId = payload.sub;

    // Sync user to DB — no-op if the record already exists (upsert).
    const email = typeof payload.email === 'string' ? payload.email : '';
    const name  = typeof payload.name  === 'string' ? payload.name  : undefined;

    await syncUser({ clerkId, email, name });

    // Attach userId so every downstream handler can read req.userId
    req.userId = clerkId;

    next();
  } catch (err) {
    console.error('[requireAuth] Token verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

