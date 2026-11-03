import { runQaRecovery } from "../infrastructure/database/qa-recovery.js";

try {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== "--writers-paused") throw new Error();
  const report = await runQaRecovery({
    sourceUrl: process.env.TEST_DATABASE_URL ?? "",
    restoreUrl: process.env.RESTORE_TEST_DATABASE_URL ?? "",
    sourceDocuments: process.env.QA_DOCUMENT_ROOT ?? "",
    output: process.env.QA_RECOVERY_OUTPUT ?? "",
    pgBin: process.env.PG_BIN ?? "",
    writersPaused: true,
  });
  console.log(
    JSON.stringify(
      {
        restored: report.restored,
        syntheticQaOnly: true,
        documentsVerified: report.documentsVerified,
        fingerprintsVerified: report.tableAndSequenceFingerprints.length,
        operationalReadinessApproved: false,
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    "QA recovery failed. Use distinct dedicated local _test databases, an empty target and a new output directory; operational connections are never used.",
  );
  process.exitCode = 1;
}
