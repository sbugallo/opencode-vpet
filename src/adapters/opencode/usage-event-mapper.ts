import type { CompletedUsage } from "../../application/use-cases/record-usage.ts"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const toFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

const toTokenCount = (value: unknown): number | undefined => {
  const count = toFiniteNumber(value)
  return count === undefined || count < 0 ? undefined : count
}

/**
 * Maps a completed assistant message from the v2 `session.context()` shape into
 * a usage receipt. Messages without a completed timestamp or full token usage
 * (for example title or compaction messages) are not recordable.
 */
export const toCompletedUsageFromMessage = (message: unknown): CompletedUsage | null => {
  if (!isRecord(message)) return null
  const { type, id, time, tokens, cost: rawCost } = message
  if (type !== "assistant") return null
  if (typeof id !== "string" || id.length === 0) return null
  if (!isRecord(time)) return null
  const { completed } = time
  const completedAt = toFiniteNumber(completed)
  if (completedAt === undefined) return null

  if (!isRecord(tokens)) return null
  const { input: rawInput, output: rawOutput, reasoning: rawReasoning, cache } = tokens
  if (!isRecord(cache)) return null
  const { read: rawRead, write: rawWrite } = cache
  const input = toTokenCount(rawInput)
  const output = toTokenCount(rawOutput)
  const reasoning = toTokenCount(rawReasoning)
  const cacheRead = toTokenCount(rawRead)
  const cacheWrite = toTokenCount(rawWrite)
  if (
    input === undefined ||
    output === undefined ||
    reasoning === undefined ||
    cacheRead === undefined ||
    cacheWrite === undefined
  ) {
    return null
  }

  const cost = toFiniteNumber(rawCost)

  return {
    receiptKey: `message:${id}`,
    eventId: `usage:${id}`,
    tokenDelta: input + output + reasoning + cacheRead + cacheWrite,
    cost: cost !== undefined && cost > 0 ? cost : null,
    createdAt: new Date(completedAt).toISOString(),
  }
}
