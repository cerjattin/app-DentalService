import { AppError } from "../errors/app-error.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value: string, fieldName: string): Date {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new AppError(
      400,
      "INVALID_DATE",
      `${fieldName} must use YYYY-MM-DD format`,
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(400, "INVALID_DATE", `${fieldName} is not a valid date`);
  }

  return date;
}

export function formatDateOnly(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}
