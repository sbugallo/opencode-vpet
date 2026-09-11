export const isRecoverableSqliteReadError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("sqlite") || error.message.includes("database") || error.message.includes("no such table"))
