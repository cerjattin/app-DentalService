import { z } from "zod";

export const uploadDocumentQuerySchema = z.object({
  documentType: z.enum([
    "SIGNATURE",
    "AUTHORIZATION",
    "SUPPORTING_DOCUMENT",
    "OTHER",
  ]),
  originalFilename: z.string().trim().min(1).max(255),
});

export type UploadDocumentQuery = z.infer<typeof uploadDocumentQuerySchema>;
