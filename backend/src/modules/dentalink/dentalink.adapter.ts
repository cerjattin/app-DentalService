import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
/** Internal normalized contract, not the undocumented Dentalink HTTP protocol. */
export interface DentalinkReadAdapter {
  readonly kind: "SYNTHETIC" | "DENTALINK_HTTP";
  readPage(input: {
    externalAccountId: string;
    from: string | null;
    to: string | null;
    cursor: string | null;
  }): Promise<unknown>;
}
// No fixture, HTTP endpoint, token or URL is accepted from an API request.
export const dentalinkAdapterProvider: {
  resolve(): DentalinkReadAdapter | undefined;
} = { resolve: () => undefined };
export function getDentalinkAdapter() {
  const adapter = dentalinkAdapterProvider.resolve();
  if (adapter?.kind === "SYNTHETIC") {
    const url = new URL(env.DATABASE_URL);
    if (
      env.NODE_ENV !== "test" ||
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^\/[a-z0-9_]+_test$/.test(url.pathname)
    ) {
      throw new AppError(
        409,
        "DENTALINK_SYNTHETIC_QA_ONLY",
        "Synthetic imports are restricted to isolated local QA",
      );
    }
  }
  return adapter;
}
