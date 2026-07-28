import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "unauthorized", message: "Missing or malformed Authorization header." });
      return;
    }

    const token = authHeader.slice(7).trim();
    const accessSecret = process.env.JWT_ACCESS_SECRET;

    if (!accessSecret) {
      console.error("[requireAuth] JWT_ACCESS_SECRET environment variable is missing.");
      res.status(500).json({ error: "Internal server configuration error." });
      return;
    }

    const payload = jwt.verify(token, accessSecret) as jwt.JwtPayload;

    if (!payload || !payload.sub || typeof payload.sub !== "string") {
      res.status(401).json({ error: "unauthorized", message: "Invalid token payload." });
      return;
    }

    req.userId = payload.sub;
    next();
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      res.status(401).json({
        error: "token_expired",
        message: "Access token has expired.",
      });
      return;
    }

    res.status(401).json({
      error: "unauthorized",
      message: "Invalid access token.",
    });
  }
}
