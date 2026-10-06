import type { DigitalPetControl } from "@jcendal/digital-pet-core/application/ports/digital-pet-control.ts"
import { unfreezeDigitalPet } from "@jcendal/digital-pet-core/application/use-cases/unfreeze-digital-pet.ts"
import type { DigitalPetCommandResult } from "./digital-pet-command-result.ts"

export type DigitalPetUnfreezeContext = {
  readonly sessionID: string
  readonly messageID: string
}

export const runDigitalPetUnfreezeCommand = async (
  control: Pick<DigitalPetControl, "unfreeze">,
  context: DigitalPetUnfreezeContext,
): Promise<DigitalPetCommandResult> => {
  const outcome = unfreezeDigitalPet(control)
  const parts = [
    {
      id: context.messageID,
      sessionID: context.sessionID,
      messageID: context.messageID,
      type: "text" as const,
      text: "Digital Pet unfrozen.",
    },
  ]

  switch (outcome.kind) {
    case "unfrozen":
      return { parts, event: { kind: "unfrozen" } }
    case "already_unfrozen":
      return { parts }
    default: {
      const unexpectedOutcome: never = outcome
      return unexpectedOutcome
    }
  }
}
