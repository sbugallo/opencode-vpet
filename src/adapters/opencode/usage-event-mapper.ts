import type { AssistantMessage, Event, Message } from "@opencode-ai/sdk"

import type { CompletedUsage } from "../../application/use-cases/record-usage.ts"

const isCompletedAssistantMessage = (message: Message): message is AssistantMessage => {
  return message.role === "assistant" && "time" in message && message.time.completed !== undefined
}

export const toCompletedUsageFromMessage = (message: Message): CompletedUsage | null => {
  if (!isCompletedAssistantMessage(message)) return null
  const completedAt = message.time.completed
  if (completedAt === undefined) return null

  return {
    receiptKey: `message:${message.id}`,
    eventId: `usage:${message.id}`,
    tokenDelta:
      message.tokens.input +
      message.tokens.output +
      message.tokens.reasoning +
      message.tokens.cache.read +
      message.tokens.cache.write,
    cost: Number.isFinite(message.cost) && message.cost > 0 ? message.cost : null,
    createdAt: new Date(completedAt).toISOString(),
  }
}

export const toCompletedUsageFromEvent = (event: Event): CompletedUsage | null => {
  if (event.type !== "message.updated") return null
  return toCompletedUsageFromMessage(event.properties.info)
}
