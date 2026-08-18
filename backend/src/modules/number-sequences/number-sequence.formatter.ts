export function formatBusinessNumber(
  prefix: string,
  value: bigint,
  padding: number,
): string {
  if (value < 0n) {
    throw new Error("Sequence value cannot be negative");
  }

  if (!Number.isInteger(padding) || padding < 1 || padding > 18) {
    throw new Error("Sequence padding must be between 1 and 18");
  }

  const numericPart = value.toString().padStart(padding, "0");

  return `${prefix}${numericPart}`;
}
