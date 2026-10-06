import type { DigitalPetLanguage } from "@jcendal/digital-pet-core/config/types.ts"
import type { DigimonCatalog, DigimonNode } from "@jcendal/digital-pet-core/data/catalog.ts"

export type DigitalPetToastPayload = Readonly<{
  readonly title: string
  readonly message: string
  readonly variant: "info" | "success"
  readonly duration: number
}>

export type DigitalPetToastEvent =
  | Readonly<{ readonly kind: "spawn"; readonly nodeId: string; readonly generation: number }>
  | Readonly<{ readonly kind: "freeze" }>
  | Readonly<{ readonly kind: "unfreeze" }>
  | Readonly<{ readonly kind: "set"; readonly nodeId: string }>
  | Readonly<{ readonly kind: "evolution"; readonly fromNodeId: string; readonly toNodeId: string }>
  | Readonly<{ readonly kind: "evolution_battle"; readonly opponentNodeId: string }>
  | Readonly<{ readonly kind: "defeat" }>

export type DigitalPetToastNotifier = (payload: DigitalPetToastPayload) => Promise<void>

export type DigitalPetToastTransport = (payload: DigitalPetToastPayload) => boolean | Promise<boolean>

const assertNever = (value: never): never => {
  throw new Error(`Unhandled Digital Pet toast event: ${JSON.stringify(value)}`)
}

const selectName = (node: DigimonNode, language: DigitalPetLanguage): string => {
  switch (language) {
    case "en":
      return node.nameEn
    case "jp":
      return node.nameJp
    default:
      return assertNever(language)
  }
}

const namedPayload = (nodeId: string, language: DigitalPetLanguage, catalog: DigimonCatalog): string | undefined => {
  const node = catalog.byId.get(nodeId)
  return node === undefined ? undefined : selectName(node, language)
}

export const formatDigitalPetToast = (
  event: DigitalPetToastEvent,
  language: DigitalPetLanguage,
  catalog: DigimonCatalog,
): DigitalPetToastPayload | undefined => {
  switch (event.kind) {
    case "spawn": {
      const name = namedPayload(event.nodeId, language, catalog)
      return name === undefined
        ? undefined
        : {
            title: "Digital Pet",
            message: `Spawned ${name} (Generation ${event.generation}).`,
            variant: "success",
            duration: 5_000,
          }
    }
    case "freeze":
      return { title: "Digital Pet", message: "Digimon progression frozen.", variant: "info", duration: 3_000 }
    case "unfreeze":
      return { title: "Digital Pet", message: "Digimon progression resumed.", variant: "info", duration: 3_000 }
    case "set": {
      const name = namedPayload(event.nodeId, language, catalog)
      return name === undefined
        ? undefined
        : {
            title: "Digital Pet",
            message: `Digital Pet set to ${name} (${event.nodeId}).`,
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
    case "evolution_battle": {
      const opponentName = namedPayload(event.opponentNodeId, language, catalog)
      return opponentName === undefined
        ? undefined
        : {
            title: "Evolution battle",
            message: `Battle against ${opponentName}! Win to evolve.`,
            variant: "info",
            duration: 5_000,
          }
    }
    case "defeat":
      return {
        title: "Defeat",
        message: "Defeat! You lost all tokens for this stage.",
        variant: "info",
        duration: 5_000,
      }
    default:
      return assertNever(event)
  }
}

export const createBestEffortDigitalPetToastNotifier = (
  transport: DigitalPetToastTransport,
): DigitalPetToastNotifier => {
  return async (payload) =>
    await Promise.resolve()
      .then(() => transport(payload))
      .then(
        () => undefined,
        () => undefined,
      )
}
