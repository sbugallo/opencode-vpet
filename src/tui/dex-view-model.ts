import type { VpetArchiveResult } from "../application/models/vpet-archive.ts"
import type { ResolvedVpetSettings } from "../config/types.ts"
import type { DigimonCatalog } from "../data/catalog.ts"
import { getStageLabel } from "../data/stages.ts"
import { DIGIMON_STAGES } from "../domain/stage.ts"
import type { DigimonNode } from "../domain/digimon-node.ts"

export type DexRow = {
  readonly id: string
  readonly stage: string
  readonly discovered: boolean
  readonly name: string
}

export type DexViewModel =
  | { readonly kind: "available"; readonly rows: readonly DexRow[] }
  | { readonly kind: "empty" }
  | { readonly kind: "unavailable"; readonly message: string }

const REDACTED_NAME = "------"

const assertNever = (value: never): never => {
  throw new Error(`Unexpected archive result: ${JSON.stringify(value)}`)
}

const compareCatalogNodes = (left: DigimonNode, right: DigimonNode): number => {
  const stageDifference = DIGIMON_STAGES.indexOf(left.stage) - DIGIMON_STAGES.indexOf(right.stage)
  if (stageDifference !== 0) return stageDifference
  const [, leftSerial = ""] = left.id.split("-")
  const [, rightSerial = ""] = right.id.split("-")
  const serialDifference = Number(leftSerial) - Number(rightSerial)
  if (serialDifference !== 0) return serialDifference
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}

const discoveredNodeIds = (
  archive: Extract<VpetArchiveResult, { readonly kind: "available" }>,
): ReadonlySet<string> => {
  const nodeIds = new Set<string>()
  for (const partner of archive.partners) {
    for (const event of partner.events) nodeIds.add(event.currentNodeId)
  }
  return nodeIds
}

export const buildDexViewModel = (
  archive: VpetArchiveResult,
  catalog: DigimonCatalog,
  settings: ResolvedVpetSettings,
): DexViewModel => {
  switch (archive.kind) {
    case "available": {
      const discoveredIds = discoveredNodeIds(archive)
      const labels = settings.stageLabels[settings.language]
      return {
        kind: "available",
        rows: catalog.nodes
          .slice()
          .sort(compareCatalogNodes)
          .map((node) => ({
            id: node.id,
            stage: getStageLabel(node.stage, labels),
            discovered: discoveredIds.has(node.id),
            name: discoveredIds.has(node.id) ? (settings.language === "en" ? node.nameEn : node.nameJp) : REDACTED_NAME,
          })),
      }
    }
    case "empty":
      return { kind: "empty" }
    case "unavailable":
      return { kind: "unavailable", message: archive.message }
    default:
      return assertNever(archive)
  }
}
