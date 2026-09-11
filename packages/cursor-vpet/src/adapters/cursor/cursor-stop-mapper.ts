import type { CompletedUsage, CursorHookPayload } from "./types.ts"

export const hasStopTokens = (payload: CursorHookPayload): boolean => {
  const input = payload.input_tokens ?? 0
  const output = payload.output_tokens ?? 0
  return input + output > 0
}

export const toCompletedUsageFromStop = (payload: CursorHookPayload, receivedAt: string): CompletedUsage | null => {
  if (!hasStopTokens(payload)) return null

  const generationId = payload.generation_id ?? payload.conversation_id
  if (generationId === undefined || generationId.length === 0) return null

  const tokenDelta = (payload.input_tokens ?? 0) + (payload.output_tokens ?? 0)

  return {
    receiptKey: `cursor-turn:${generationId}`,
    eventId: `cursor-stop:${generationId}`,
    tokenDelta,
    cost: null,
    createdAt: receivedAt,
  }
}
