import type { VpetArchiveEvent, VpetArchivePartner, VpetArchiveResult } from "../application/models/vpet-archive.ts"
import type { ResolvedVpetSettings } from "../config/types.ts"
import type { DigimonCatalog } from "../data/catalog.ts"

export type HistoryGeneration = {
  readonly partnerId: string
  readonly generation: number
  readonly createdAt: string
  readonly retiredAt: string | null
  readonly path: readonly string[]
}

export type HistoryViewModel =
  | { readonly kind: "available"; readonly generations: readonly HistoryGeneration[] }
  | { readonly kind: "empty" }
  | { readonly kind: "unavailable"; readonly message: string }

const assertNever = (value: never): never => {
  throw new Error(`Unexpected archive result: ${JSON.stringify(value)}`)
}

const comparePartners = (left: VpetArchivePartner, right: VpetArchivePartner): number => {
  const createdAtComparison = right.createdAt.localeCompare(left.createdAt)
  if (createdAtComparison !== 0) return createdAtComparison
  const generationDifference = right.generation - left.generation
  if (generationDifference !== 0) return generationDifference
  return right.partnerId.localeCompare(left.partnerId)
}

const dedupeAdjacentEvents = (events: readonly VpetArchiveEvent[]): readonly VpetArchiveEvent[] => {
  const distinctEvents: VpetArchiveEvent[] = []
  for (const event of events) {
    const previousEvent = distinctEvents.at(-1)
    if (previousEvent?.currentNodeId !== event.currentNodeId) distinctEvents.push(event)
  }
  return distinctEvents
}

const displayNodeId = (nodeId: string, catalog: DigimonCatalog, settings: ResolvedVpetSettings): string => {
  const node = catalog.byId.get(nodeId)
  if (node === undefined) return nodeId
  return `${node.id} ${settings.language === "en" ? node.nameEn : node.nameJp}`
}

export const buildHistoryViewModel = (
  archive: VpetArchiveResult,
  catalog: DigimonCatalog,
  settings: ResolvedVpetSettings,
): HistoryViewModel => {
  switch (archive.kind) {
    case "available":
      return {
        kind: "available",
        generations: archive.partners
          .slice()
          .sort(comparePartners)
          .map((partner) => ({
            partnerId: partner.partnerId,
            generation: partner.generation,
            createdAt: partner.createdAt,
            retiredAt: partner.retiredAt,
            path: dedupeAdjacentEvents(partner.events).map((event) =>
              displayNodeId(event.currentNodeId, catalog, settings),
            ),
          })),
      }
    case "empty":
      return { kind: "empty" }
    case "unavailable":
      return { kind: "unavailable", message: archive.message }
    default:
      return assertNever(archive)
  }
}
