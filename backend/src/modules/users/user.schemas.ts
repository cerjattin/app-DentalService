import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),

  firstName: z.string().trim().min(1).max(120),

  lastName: z.string().trim().min(1).max(120),

  password: z.string().min(12).max(256),

  roleCodes: z
    .array(z.enum(["ADMIN", "RECEPTION", "PROVIDER"]))
    .min(1)
    .max(3),
});

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),

  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]).optional(),

  role: z.enum(["ADMIN", "RECEPTION", "PROVIDER"]).optional(),

  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
