import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  locale: z.enum(["en", "ar"]),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
  locale: z.enum(["en", "ar"]).default("en"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: z
      .string()
      .min(10)
      .regex(/[A-Z]/, "uppercase")
      .regex(/[a-z]/, "lowercase")
      .regex(/[0-9]/, "number")
      .regex(/[^A-Za-z0-9]/, "symbol"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMismatch",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: z
      .string()
      .min(10)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMismatch",
  });

export type LoginInput = z.infer<typeof loginSchema>;
