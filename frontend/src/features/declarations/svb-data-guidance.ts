// Display guidance for published snapshots, never a second SVB validator.
export const svbFieldGuidance: Record<string, string> = {
  DeclarantId: 'The invoice version retains the organization identity captured for that version. Settings changes apply to future captures.',
  InvoiceNumber: 'Review the invoice number allocated by the billing workflow.',
  DetailInvoiceNumber: 'Review the detail number allocated to this invoice item.',
  ProviderId: 'Review the provider SVB identifier at its source. Changing a provider does not rewrite existing snapshots.',
  Date: 'Review the recorded service date in the invoice version.',
  InsuredId: 'Review the patient insurance record used for this service. Preserve leading zeros.',
  AccidentFormNumber: 'Accident registration and selection are not available in this workspace. Do not substitute an internal record key.',
  TreatmentId: 'The external treatment ID comes from the patient treatment case selected for the appointment. A case key is not an external treatment ID.',
  Amount: 'Review the tariff and quantity through the authorized billing workflow. The saved amount is calculated by the server.',
  NumberOfTreatments: 'A clinic-approved capture rule is still required. Do not derive this value from procedure quantity or assume a default.',
  Assistance: 'A clinic-approved capture rule is still required. Do not assume a default or infer this value from the procedure.',
  ReferrerId: 'Referral registration and evidence selection are not available in this workspace. An identifier alone does not establish an authorized referral.',
  PoliClinic: 'The value is captured from the clinic location. Location SVB configuration is not yet available in this workspace.',
  AdditionalNote: 'Review the service note and use an authorized correction for existing invoice content.',
}

export function svbIssueDescription(code: string) {
  if (code === 'DECLARATION_SVB_DATA_INCOMPLETE') return 'Missing snapshot data'
  if (code === 'DECLARATION_SVB_DATA_INVALID') return 'Invalid snapshot data'
  return 'Review required'
}
