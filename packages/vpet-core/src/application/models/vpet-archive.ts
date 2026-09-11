export type VpetArchiveEvent = {
  readonly eventId: string
  readonly currentNodeId: string
  readonly createdAt: string
}

export type VpetArchivePartner = {
  readonly partnerId: string
  readonly generation: number
  readonly createdAt: string
  readonly retiredAt: string | null
  readonly events: readonly VpetArchiveEvent[]
}

export type VpetArchiveResult =
  | { readonly kind: "available"; readonly partners: readonly VpetArchivePartner[] }
  | { readonly kind: "empty" }
  | { readonly kind: "unavailable"; readonly message: string }
