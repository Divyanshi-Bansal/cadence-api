import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { userService, AppError } from '../services/userService';
import {
  signUpSchema,
  forgotPasswordSchema,
  updateUserSchema,
} from '../validations/userValidation';

function handleError(res: Response, err: unknown, label: string): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Validation failed.',
      issues: err.issues.map((e) => ({
        field: e.path.map(String).join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error(`[userController] ${label}:`, err);
  res.status(500).json({ error: 'Internal server error.' });
}

export async function getUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = await userService.getProfile(req.userId);
    res.json({ user });
  } catch (err) {
    handleError(res, err, 'getUserProfile');
  }
}

export async function signUp(req: Request, res: Response): Promise<void> {
  try {
    const { name } = signUpSchema.parse(req.body);
    const user = await userService.signUp(req.userId, req.userEmail, name);
    res.status(201).json({ user });
  } catch (err) {
    handleError(res, err, 'signUp');
  }
}

export async function signIn(req: Request, res: Response): Promise<void> {
  try {
    const user = await userService.signIn(req.userId, req.userEmail);
    res.json({ user });
  } catch (err) {
    handleError(res, err, 'signIn');
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    await userService.forgotPassword(email);
    res.json({
      message:
        'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (err) {
    handleError(res, err, 'forgotPassword');
  }
}
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await userService.updateProfile(req.userId, data);
    res.json({ user });
  } catch (err) {
    handleError(res, err, 'updateProfile');
  }
}
