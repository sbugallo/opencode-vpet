export type DigitalPetArchiveEvent = {
  readonly eventId: string
  readonly currentNodeId: string
  readonly createdAt: string
}

export type DigitalPetArchivePartner = {
  readonly partnerId: string
  readonly generation: number
  readonly createdAt: string
  readonly retiredAt: string | null
  readonly events: readonly DigitalPetArchiveEvent[]
}

export type DigitalPetArchiveResult =
  | { readonly kind: "available"; readonly partners: readonly DigitalPetArchivePartner[] }
  | { readonly kind: "empty" }
  | { readonly kind: "unavailable"; readonly message: string }
