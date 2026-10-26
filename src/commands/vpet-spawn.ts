import type { PartnerLifecycle } from "../application/ports/partner-lifecycle.ts"
import { spawnPartner } from "../application/use-cases/spawn-partner.ts"
import type { DigimonCatalog } from "../data/catalog.ts"
import { DIGITAMA_FIELD_EGGS } from "../data/digimon-data.ts"
import type { VpetCommandResult } from "./vpet-command-result.ts"
import type { DigimonCatalogLoader } from "./vpet-set.ts"

export type { DigimonCatalogLoader } from "./vpet-set.ts"

export type VpetSpawnContext = {
  readonly arguments: string
  readonly createdAt: string
}

export const DIGITAMA_FIELDS: readonly string[] = Object.freeze(Object.keys(DIGITAMA_FIELD_EGGS))

const usage = (): VpetCommandResult => ({
  message: `Usage: /vpet-spawn [${DIGITAMA_FIELDS.join("|")}].`,
  variant: "warning",
})

const randomEgg = (catalog: DigimonCatalog, random: () => number): string | undefined => {
  const eggs = catalog.nodes.filter((node) => node.stage === 0)
  if (eggs.length === 0) return undefined
  const sample = random()
  const index =
    !Number.isFinite(sample) || sample <= 0 ? 0 : sample >= 1 ? eggs.length - 1 : Math.floor(sample * eggs.length)
  return eggs[index]?.id
}

export const runVpetSpawnCommand = async (
  lifecycle: PartnerLifecycle,
  context: VpetSpawnContext,
  loadCatalog: DigimonCatalogLoader,
  random: () => number = Math.random,
): Promise<VpetCommandResult> => {
  if (context.arguments.includes("\n")) return usage()
  const tokens = context.arguments
    .trim()
    .split(/\s+/)
    .filter((token) => token !== "")
  if (tokens.length > 1) return usage()

  const catalog = await loadCatalog()
  const requestedField = tokens[0]
  let eggId: string | undefined
  if (requestedField === undefined) {
    eggId = randomEgg(catalog, random)
    if (eggId === undefined) return { message: "No digitama available.", variant: "warning" }
  } else {
    eggId = DIGITAMA_FIELD_EGGS[requestedField]
    if (eggId === undefined) return { message: `Unknown digitama field: ${requestedField}.`, variant: "warning" }
  }

  const node = catalog.byId.get(eggId)
  if (node === undefined) return { message: `Unknown Digimon ID: ${eggId}.`, variant: "warning" }

  const partner = spawnPartner(lifecycle, node.id, context.createdAt)

  return {
    message: `Spawned Generation ${partner.generation} from ${node.nameEn}.`,
    variant: "info",
    event: { kind: "spawned", nodeId: node.id, generation: partner.generation },
  }
}
