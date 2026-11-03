import { describe, expect, it } from "vitest";
import { assertSupportedReferralFlow, assertSvbPresentationPurpose, getSvbPilotReadiness, realSvbPresentationReadiness } from "../../src/modules/svb-readiness/svb-readiness.service.js";
import { createEncounterProcedureSchema, updateEncounterProcedureSchema } from "../../src/modules/encounter-procedures/encounter-procedure.schemas.js";
import { createDeclarationExportSchema, markDeclarationReadySchema } from "../../src/modules/declarations/declaration.schemas.js";

describe("NEG-FINAL-06 without an approved source sheet", () => {
  it("publishes an explicitly empty pilot with no approval or destination format", () => {
    expect(getSvbPilotReadiness()).toMatchObject({ status: "BLOCKED", realSubmissionEnabled: false,
      sourceSheet: null, destinationFormat: null, enabledServiceCodes: [], enabledCaseTypes: [] });
    expect(realSvbPresentationReadiness().issues.map((i) => i.code)).toEqual([
      "SVB_SOURCE_RULES_NOT_CONFIGURED", "SVB_DESTINATION_FORMAT_NOT_VERIFIED",
    ]);
    const edited = getSvbPilotReadiness();
    edited.enabledServiceCodes.push("forged");
    expect(getSvbPilotReadiness().enabledServiceCodes).toEqual([]);
  });
  it("preserves technical validation while blocking explicit real presentation", () => {
    expect(() => assertSvbPresentationPurpose("TECHNICAL")).not.toThrow();
    expect(() => assertSvbPresentationPurpose("REAL_SVB")).toThrow(expect.objectContaining({ code: "SVB_REAL_PRESENTATION_NOT_ENABLED", statusCode: 409 }));
    expect(markDeclarationReadySchema.parse({})).toEqual({});
    expect(createDeclarationExportSchema.parse({ format: "csv", presentationPurpose: "REAL_SVB" })).toEqual({ format: "CSV", presentationPurpose: "REAL_SVB" });
    expect(markDeclarationReadySchema.safeParse({ presentationPurpose: "APPROVED" }).success).toBe(false);
    expect(createDeclarationExportSchema.safeParse({ format: "CSV", approved: true }).success).toBe(false);
  });
  it("does not treat a referrer ID as evidence for an unsupported referral workflow", () => {
    expect(() => assertSupportedReferralFlow(false)).not.toThrow();
    expect(() => assertSupportedReferralFlow(true)).toThrow(expect.objectContaining({ code: "SVB_REFERRAL_FLOW_NOT_SUPPORTED" }));
  });
  it.each(["numberOfTreatmentsSnapshot", "assistanceSnapshot", "policlinicSnapshot", "referrerId", "referrerIdSnapshot", "declarantIdSnapshot", "providerIdSnapshot", "insuredIdSnapshot"])("rejects client snapshot/workflow override %s", (field) => {
    const result = createEncounterProcedureSchema.safeParse({ patientInsuranceId: "1", svbProcedureId: "2", [field]: "1" });
    expect(result.success).toBe(false);
    expect(updateEncounterProcedureSchema.safeParse({ additionalNote: "QA", [field]: "1" }).success).toBe(false);
  });
});
