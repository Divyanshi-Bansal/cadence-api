import { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z, ZodError } from "zod";
import { authService, AppError } from "../services/authService";
import { userRepository } from "../repositories/userRepository";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(20, "Password cannot exceed 20 characters")
  .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
  .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
  .regex(/[0-9]/, "Password must contain at least 1 number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special character");

const signupSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const magicLinkReqSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const verifyMagicLinkSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

const githubExchangeSchema = z.object({
  code: z.string().min(1, "code is required"),
});

// Strict rate limiter for auth endpoints (5 attempts per 15 minutes per IP)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again in 15 minutes." },
});

const isProduction = process.env.NODE_ENV === "production";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict" as const,
  path: "/api/auth",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const LOGGED_IN_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

function handleError(res: Response, err: unknown, label: string): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: "Validation failed.",
      issues: err.issues.map((e) => ({
        field: e.path.map(String).join("."),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error(`[authController] ${label}:`, err);
  res.status(500).json({ error: "Internal server error." });
}

export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = signupSchema.parse(req.body);
    const result = await authService.signup(
      email,
      password,
      name,
    );

    res.status(201).json(result);
  } catch (err) {
    handleError(res, err, "signup");
  }
}

export async function requestMagicLink(req: Request, res: Response): Promise<void> {
  try {
    const { email } = magicLinkReqSchema.parse(req.body);
    const result = await authService.sendMagicLink(email);
    res.json(result);
  } catch (err) {
    handleError(res, err, "requestMagicLink");
  }
}

export async function verifyMagicLink(req: Request, res: Response): Promise<void> {
  try {
    const { token } = verifyMagicLinkSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.verifyMagicLink(token);

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);
    res.json({ user, accessToken });
  } catch (err) {
    handleError(res, err, "verifyMagicLink");
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.login(
      email,
      password,
    );

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);
    res.json({ user, accessToken });
  } catch (err) {
    handleError(res, err, "login");
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = await authService.getMe(userId);
    res.json({ user });
  } catch (err) {
    handleError(res, err, "getMe");
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      res.clearCookie("cadence_logged_in", { path: "/" });
      res.status(401).json({ error: "Refresh token missing" });
      return;
    }

    const { user, accessToken, refreshToken: newRefreshToken } =
      await authService.refresh(refreshToken);

    res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);
    res.json({ user, accessToken });
  } catch (err) {
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.clearCookie("cadence_logged_in", { path: "/" });
    handleError(res, err, "refresh");
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.clearCookie("cadence_logged_in", { path: "/" });
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.clearCookie("cadence_logged_in", { path: "/" });
    handleError(res, err, "logout");
  }
}

export async function googleAuth(req: Request, res: Response): Promise<void> {
  try {
    const { idToken } = googleAuthSchema.parse(req.body);
    const { user, accessToken, refreshToken } =
      await authService.googleAuth(idToken);

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);
    res.json({ user, accessToken });
  } catch (err) {
    handleError(res, err, "googleAuth");
  }
}

export async function githubCallback(req: Request, res: Response): Promise<void> {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({ error: "Authorization code missing" });
      return;
    }

    const { oneTimeCode, refreshToken } =
      await authService.githubAuthCallback(code);

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/auth/callback?code=${oneTimeCode}`);
  } catch (err) {
    handleError(res, err, "githubCallback");
  }
}

export async function githubExchange(req: Request, res: Response): Promise<void> {
  try {
    const { code } = githubExchangeSchema.parse(req.body);
    const { user, accessToken, refreshToken } =
      await authService.exchangeGithubCode(code);

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie("cadence_logged_in", "true", LOGGED_IN_COOKIE_OPTIONS);
    res.json({ user, accessToken });
  } catch (err) {
    handleError(res, err, "githubExchange");
  }
}
