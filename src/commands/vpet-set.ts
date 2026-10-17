import type { VpetControl } from "../application/ports/vpet-control.ts"
import { setVpetCheatNode } from "../application/use-cases/set-vpet-cheat-node.ts"
import type { DigimonCatalog } from "../data/catalog.ts"
import type { VpetCommandResult } from "./vpet-command-result.ts"

export type VpetSetContext = {
  readonly arguments: string
}

export type DigimonCatalogLoader = () => Promise<DigimonCatalog>

export const runVpetSetCommand = async (
  control: Pick<VpetControl, "setCheatNode">,
  context: VpetSetContext,
  loadCatalog: DigimonCatalogLoader,
): Promise<VpetCommandResult> => {
  if (context.arguments.includes("\n")) return { message: "Usage: /vpet-set <id>.", variant: "warning" }
  const tokens = context.arguments.trim().split(/\s+/)
  if (context.arguments.trim() === "" || tokens.length !== 1)
    return { message: "Usage: /vpet-set <id>.", variant: "warning" }

  const requestedId = tokens[0]
  if (requestedId === undefined) return { message: "Usage: /vpet-set <id>.", variant: "warning" }
  const node = (await loadCatalog()).byId.get(requestedId)
  if (node === undefined) return { message: `Unknown Digimon ID: ${requestedId}.`, variant: "warning" }

  const outcome = setVpetCheatNode(control, node.id)
  const message = `VPet set to ${node.nameEn} (${node.id}).`

  switch (outcome.kind) {
    case "set":
      return { message, variant: "info", event: { kind: "set", nodeId: node.id } }
    case "already_set":
      return { message, variant: "info" }
    default: {
      const unexpectedOutcome: never = outcome
      return unexpectedOutcome
    }
  }
}
