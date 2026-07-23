import { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z, ZodError } from "zod";
import { authService, AppError } from "../services/authService";
import { userRepository } from "../repositories/userRepository";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

const githubExchangeSchema = z.object({
  code: z.string().min(1, "code is required"),
});

// Strict rate limiter for signup/login endpoints (5 attempts per 15 minutes per IP)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
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
    const { user, accessToken, refreshToken } = await authService.signup(
      email,
      password,
      name,
    );

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    handleError(res, err, "signup");
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
    res.json({ user, accessToken });
  } catch (err) {
    handleError(res, err, "login");
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token missing" });
      return;
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await authService.refresh(refreshToken);

    res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ accessToken });
  } catch (err) {
    res.clearCookie("refreshToken", { path: "/api/auth" });
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
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    handleError(res, err, "logout");
  }
}

export async function googleAuth(req: Request, res: Response): Promise<void> {
  try {
    const { idToken } = googleAuthSchema.parse(req.body);
    const { user, accessToken, refreshToken } =
      await authService.googleAuth(idToken);

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
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
    res.json({ user, accessToken });
  } catch (err) {
    handleError(res, err, "githubExchange");
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await userRepository.findByUserId(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (err) {
    handleError(res, err, "getMe");
  }
}
