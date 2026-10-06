import type { Part } from "@opencode-ai/sdk"

import type { DigitalPetControl } from "@jcendal/digital-pet-core/application/ports/digital-pet-control.ts"
import { setDigitalPetCheatNode } from "@jcendal/digital-pet-core/application/use-cases/set-digital-pet-cheat-node.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/data/catalog.ts"
import type { DigitalPetCommandResult } from "./digital-pet-command-result.ts"

export type DigitalPetSetContext = {
  readonly sessionID: string
  readonly messageID: string
  readonly arguments: string
}

export type DigimonCatalogLoader = () => Promise<DigimonCatalog>

const textPart = (context: DigitalPetSetContext, text: string): Part => ({
  id: context.messageID,
  sessionID: context.sessionID,
  messageID: context.messageID,
  type: "text",
  text,
})

export const runDigitalPetSetCommand = async (
  control: Pick<DigitalPetControl, "setCheatNode">,
  context: DigitalPetSetContext,
  loadCatalog: DigimonCatalogLoader,
): Promise<DigitalPetCommandResult> => {
  if (context.arguments.includes("\n")) return { parts: [textPart(context, "Usage: /digital-pet-set <id>.")] }
  const tokens = context.arguments.trim().split(/\s+/)
  if (context.arguments.trim() === "" || tokens.length !== 1)
    return { parts: [textPart(context, "Usage: /digital-pet-set <id>.")] }

  const requestedId = tokens[0]
  if (requestedId === undefined) return { parts: [textPart(context, "Usage: /digital-pet-set <id>.")] }
  const node = (await loadCatalog()).byId.get(requestedId)
  if (node === undefined) return { parts: [textPart(context, `Unknown Digimon ID: ${requestedId}.`)] }

  const outcome = setDigitalPetCheatNode(control, node.id)
  const parts = [textPart(context, `Digital Pet set to ${node.nameEn} (${node.id}).`)]

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
