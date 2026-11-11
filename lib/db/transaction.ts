import { Prisma } from "@prisma/client";

export const SERIALIZABLE_TX = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 30_000,
} as const;

export function isRetryableTransactionError(error: unknown) {
  return (error as { code?: string }).code === "P2034";
}

/**
 * Retries a serializable transaction a small number of times when Postgres
 * reports a serialization conflict. Callers should perform every read/write
 * that must stay consistent inside `run`.
 */
export async function serializable<T>(
  run: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === attempts - 1) {
        throw error;
      }
    }
  }
  throw lastError;
}
