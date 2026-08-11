import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name must be at least 1 character.")
  .max(120, "Name must be at most 120 characters.")
  .optional();

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Please provide a valid email address.")
  .toLowerCase();

export const signUpSchema = z.object({
  name: nameSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const updateUserSchema = z
  .object({
    name: nameSchema,
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided for update.",
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
