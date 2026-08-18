export function serializeApiValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeApiValue);
  }

  if (value !== null && typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }

    const serialized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      serialized[key] = serializeApiValue(nestedValue);
    }

    return serialized;
  }

  return value;
}
