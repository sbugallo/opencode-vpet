export type VpetCommandEvent =
  | { readonly kind: "spawned"; readonly nodeId: string; readonly generation: number }
  | { readonly kind: "frozen" }
  | { readonly kind: "unfrozen" }
  | { readonly kind: "set"; readonly nodeId: string }

export type VpetCommandResult = {
  readonly message: string
  readonly variant: "info" | "warning"
  readonly event?: VpetCommandEvent
}
