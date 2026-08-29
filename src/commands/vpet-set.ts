import type { Part } from "@opencode-ai/sdk"

import type { VpetControl } from "../application/ports/vpet-control.ts"
import { setVpetCheatNode } from "../application/use-cases/set-vpet-cheat-node.ts"
import type { DigimonCatalog } from "../data/catalog.ts"
import type { VpetCommandResult } from "./vpet-command-result.ts"

export type VpetSetContext = {
  readonly sessionID: string
  readonly messageID: string
  readonly arguments: string
}

export type DigimonCatalogLoader = () => Promise<DigimonCatalog>

const textPart = (context: VpetSetContext, text: string): Part => ({
  id: context.messageID,
  sessionID: context.sessionID,
  messageID: context.messageID,
  type: "text",
  text,
})

export const runVpetSetCommand = async (
  control: Pick<VpetControl, "setCheatNode">,
  context: VpetSetContext,
  loadCatalog: DigimonCatalogLoader,
): Promise<VpetCommandResult> => {
  if (context.arguments.includes("\n")) return { parts: [textPart(context, "Usage: /vpet-set <id>.")] }
  const tokens = context.arguments.trim().split(/\s+/)
  if (context.arguments.trim() === "" || tokens.length !== 1)
    return { parts: [textPart(context, "Usage: /vpet-set <id>.")] }

  const requestedId = tokens[0]
  if (requestedId === undefined) return { parts: [textPart(context, "Usage: /vpet-set <id>.")] }
  const node = (await loadCatalog()).byId.get(requestedId)
  if (node === undefined) return { parts: [textPart(context, `Unknown Digimon ID: ${requestedId}.`)] }

  const outcome = setVpetCheatNode(control, node.id)
  const parts = [textPart(context, `VPet set to ${node.nameEn} (${node.id}).`)]

  switch (outcome.kind) {
    case "set":
      return { parts, event: { kind: "set", nodeId: node.id } }
    case "already_set":
      return { parts }
    default: {
      const unexpectedOutcome: never = outcome
      return unexpectedOutcome
    }
  }
}
