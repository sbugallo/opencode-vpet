import type { DigimonCatalog } from "../../domain/digimon-node.ts"
import type { SidebarCardInputs } from "../models/sidebar-card-inputs.ts"
import type { SidebarSnapshotReader } from "../ports/sidebar-snapshot.ts"

const NO_PARTNER: SidebarCardInputs = { kind: "no_partner" }

export const getSidebarCardInputs = (reader: SidebarSnapshotReader, catalog: DigimonCatalog): SidebarCardInputs => {
  const snapshot = reader.getSidebarSnapshot()
  if (snapshot === null) return NO_PARTNER

  const node = catalog.byId.get(snapshot.currentNodeId)
  if (node === undefined) return NO_PARTNER

  return {
    kind: "partner",
    node,
    gauge: snapshot.gauge,
    isTerminal: snapshot.isTerminal,
    frozen: snapshot.frozen,
    isSetOverride: snapshot.isSetOverride,
    trainerTotalTokens: snapshot.trainerTotalTokens,
  }
}
