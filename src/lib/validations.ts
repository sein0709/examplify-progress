import { z } from "zod";

export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(100, { message: "Password must be less than 100 characters" }),
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Full name is required" })
    .max(100, { message: "Full name must be less than 100 characters" }),
  role: z.enum(["instructor", "student"], {
    errorMap: () => ({ message: "Please select a role" }),
  }),
});

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .max(100, { message: "Password must be less than 100 characters" }),
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
