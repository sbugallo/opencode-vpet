import type { Part } from "@opencode-ai/sdk"

export type DigitalPetCommandEvent =
  | { readonly kind: "spawned"; readonly nodeId: string; readonly generation: number }
  | { readonly kind: "frozen" }
  | { readonly kind: "unfrozen" }
  | { readonly kind: "set"; readonly nodeId: string }

export type DigitalPetCommandResult = {
  readonly parts: readonly Part[]
  readonly event?: DigitalPetCommandEvent
}
