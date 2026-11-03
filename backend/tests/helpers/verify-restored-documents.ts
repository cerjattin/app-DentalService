import { requireLocalQaUrl } from "../../src/infrastructure/database/qa-recovery.js";
// A fresh process proves downloads use the restored DB/root, not source client caches.
requireLocalQaUrl(process.env.DATABASE_URL ?? "");
const { documentService } =
  await import("../../src/modules/documents/document.service.js");
const { prisma } = await import("../../src/infrastructure/database/prisma.js");
try {
  const actor = {
    userId: BigInt(process.env.RESTORED_QA_USER_ID!),
    organizationId: BigInt(process.env.RESTORED_QA_ORGANIZATION_ID!),
    email: "synthetic@local.invalid",
    firstName: "Synthetic",
    lastName: "QA",
    roles: [],
    permissions: ["document.read"],
  };
  const ids = JSON.parse(process.env.RESTORED_QA_DOCUMENT_IDS!) as string[];
  for (const id of ids) await documentService.download(BigInt(id), actor);
  console.log(JSON.stringify({ verified: ids.length }));
} finally {
  await prisma.$disconnect();
}
