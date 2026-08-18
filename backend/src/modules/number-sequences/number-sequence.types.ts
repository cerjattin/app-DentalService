export const NUMBER_SEQUENCE_TYPES = [
  "PATIENT",
  "APPOINTMENT",
  "INVOICE",
  "DECLARATION",
] as const;

export type NumberSequenceTypeCode = (typeof NUMBER_SEQUENCE_TYPES)[number];

export interface AllocateNumberInput {
  organizationId: bigint;

  sequenceType: NumberSequenceTypeCode;

  /**
   * Si no se suministra:
   * PATIENT      -> 0
   * demás tipos -> año actual America/Curacao
   */
  sequenceYear?: number;
}

export interface AllocatedBusinessNumber {
  organizationId: bigint;

  sequenceType: NumberSequenceTypeCode;

  sequenceYear: number;

  value: bigint;

  prefix: string;

  padding: number;

  formatted: string;
}
