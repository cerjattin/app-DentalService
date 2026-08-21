import { AppError } from "../errors/app-error.js";

export function parseBigIntId(
  value: string | string[] | undefined,
  fieldName = "id",
): bigint {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new AppError(
      400,
      "INVALID_ID",
      `${fieldName} must be a positive integer`,
    );
  }

  return BigInt(value);
}
