import { verifyToken } from '@clerk/backend';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId: string;
      userEmail: string;
    }
  }
}

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
    req.userId    = payload.sub;
    req.userEmail = typeof payload.email === 'string' ? payload.email : '';

    next();
  } catch (err) {
    console.error('[requireAuth] Token verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
