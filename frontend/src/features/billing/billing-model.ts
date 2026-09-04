import { z } from 'zod'

const labels: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_SIGNATURE: 'Pending signature',
  SIGNED: 'Signed',
  CLOSED: 'Closed',
  DECLARED: 'Declared',
  CORRECTION_REQUIRED: 'Correction required',
  CANCELLED: 'Cancelled',
  SUPERSEDED: 'Superseded',
  VOID: 'Void',
  ORIGINAL: 'Original',
  CORRECTION: 'Correction',
  VALID: 'Valid',
  PATIENT: 'Patient',
  LEGAL_REPRESENTATIVE: 'Legal representative',
  GUARDIAN: 'Guardian',
  OTHER: 'Other',
  MOUSE: 'Mouse',
  TOUCHSCREEN: 'Touchscreen',
  SIGNATURE_PAD: 'Signature pad',
  UPLOADED: 'Uploaded',
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  APPLIED: 'Applied',
}
export const billingLabel = (value: string) => labels[value] ?? value

export const correctionRequestSchema = z.object({
  reasonCode: z.string().trim().min(1, 'Enter a reason code.').max(50),
  reasonText: z.string().trim().min(1, 'Describe the correction.').max(2000),
})

export const correctionResolutionSchema = z.object({
  reason: z.string().trim().max(500),
})

export const correctionItemSchema = z.object({
  detailInvoiceNumber: z.string().trim().min(1).max(100),
  serviceDateSnapshot: z.string().date(),
  procedureCodeSnapshot: z.string().trim().min(1).max(50),
  procedureDescriptionSnapshot: z.string().trim().min(1).max(500),
  providerIdSnapshot: z.string().trim().min(1).max(64),
  insuredIdSnapshot: z.string().trim().min(1).max(80),
  unitTariffSnapshot: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/, 'Enter a valid decimal amount.'),
  currencyCodeSnapshot: z.string().trim().length(3).transform((v) => v.toUpperCase()),
  quantity: z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/, 'Enter a valid quantity.'),
  authorizationIdSnapshot: z.string().trim().max(80),
  diagnosticCodeSnapshot: z.string().trim().max(50),
  treatmentIdSnapshot: z.string().trim().max(80),
  accidentFormNumberSnapshot: z.string().trim().max(80),
  numberOfTreatmentsSnapshot: z.string().trim().regex(/^$|^[1-9]\d*$/, 'Enter a positive whole number.'),
  assistanceSnapshot: z.string().trim().max(100),
  referrerIdSnapshot: z.string().trim().max(64),
  policlinicSnapshot: z.string().trim().max(64),
  additionalNote: z.string().trim().max(500),
})

export const signerSchema = z
  .object({
    signatureType: z.enum([
      'PATIENT',
      'LEGAL_REPRESENTATIVE',
      'GUARDIAN',
      'OTHER',
    ]),
    signerName: z.string().trim().max(255),
    signerRelationship: z.string().trim().max(120),
    confirmed: z
      .boolean()
      .refine((value) => value, 'Confirm before saving the signature.'),
  })
  .superRefine((value, ctx) => {
    if (value.signatureType !== 'PATIENT' && !value.signerName)
      ctx.addIssue({
        code: 'custom',
        path: ['signerName'],
        message: 'Enter the signer name.',
      })
    if (
      ['LEGAL_REPRESENTATIVE', 'GUARDIAN'].includes(value.signatureType) &&
      !value.signerRelationship
    )
      ctx.addIssue({
        code: 'custom',
        path: ['signerRelationship'],
        message: 'Enter the relationship to the patient.',
      })
  })
