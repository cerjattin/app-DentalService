import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),

  password: z.string().min(1).max(256),
});

export type LoginRequest = z.infer<typeof loginSchema>;
