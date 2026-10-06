export type FreezeDigitalPetOutcome = { readonly kind: "frozen" } | { readonly kind: "already_frozen" }

export type UnfreezeDigitalPetOutcome = { readonly kind: "unfrozen" } | { readonly kind: "already_unfrozen" }

export type SetCheatNodeOutcome =
  | { readonly kind: "set"; readonly cheatNodeId: string }
  | { readonly kind: "already_set"; readonly cheatNodeId: string }
