import type { VpetLanguage } from "../../config/types.ts"
import type { DigimonCatalog, DigimonNode } from "../../data/catalog.ts"

export type VpetToastPayload = Readonly<{
  readonly title: string
  readonly message: string
  readonly variant: "info" | "success"
  readonly duration: number
}>

export type VpetToastEvent =
  | Readonly<{ readonly kind: "spawn"; readonly nodeId: string; readonly generation: number }>
  | Readonly<{ readonly kind: "freeze" }>
  | Readonly<{ readonly kind: "unfreeze" }>
  | Readonly<{ readonly kind: "set"; readonly nodeId: string }>
  | Readonly<{ readonly kind: "evolution"; readonly fromNodeId: string; readonly toNodeId: string }>

export type VpetToastNotifier = (payload: VpetToastPayload) => Promise<void>

export type VpetToastTransport = (payload: VpetToastPayload) => boolean | Promise<boolean>

const assertNever = (value: never): never => {
  throw new Error(`Unhandled VPet toast event: ${JSON.stringify(value)}`)
}

const selectName = (node: DigimonNode, language: VpetLanguage): string => {
  switch (language) {
    case "en":
      return node.nameEn
    case "jp":
      return node.nameJp
    default:
      return assertNever(language)
  }
}

const namedPayload = (nodeId: string, language: VpetLanguage, catalog: DigimonCatalog): string | undefined => {
  const node = catalog.byId.get(nodeId)
  return node === undefined ? undefined : selectName(node, language)
}

export const formatVpetToast = (
  event: VpetToastEvent,
  language: VpetLanguage,
  catalog: DigimonCatalog,
): VpetToastPayload | undefined => {
  switch (event.kind) {
    case "spawn": {
      const name = namedPayload(event.nodeId, language, catalog)
      return name === undefined
        ? undefined
        : {
            title: "VPet",
            message: `Spawned ${name} (Generation ${event.generation}).`,
            variant: "success",
            duration: 5_000,
          }
    }
    case "freeze":
      return { title: "VPet", message: "Digimon progression frozen.", variant: "info", duration: 3_000 }
    case "unfreeze":
      return { title: "VPet", message: "Digimon progression resumed.", variant: "info", duration: 3_000 }
    case "set": {
      const name = namedPayload(event.nodeId, language, catalog)
      return name === undefined
        ? undefined
        : {
            title: "VPet",
            message: `VPet set to ${name} (${event.nodeId}).`,
            variant: "info",
            duration: 3_000,
          }
    }
    case "evolution": {
      const fromName = namedPayload(event.fromNodeId, language, catalog)
      const toName = namedPayload(event.toNodeId, language, catalog)
      return fromName === undefined || toName === undefined
        ? undefined
        : {
            title: "Digi-evolution",
            message: `${fromName} evolved into ${toName}!`,
            variant: "success",
            duration: 5_000,
          }
    }
    default:
      return assertNever(event)
  }
}

export const createBestEffortVpetToastNotifier = (transport: VpetToastTransport): VpetToastNotifier => {
  return async (payload) =>
    await Promise.resolve()
      .then(() => transport(payload))
      .then(
        () => undefined,
        () => undefined,
      )
}
