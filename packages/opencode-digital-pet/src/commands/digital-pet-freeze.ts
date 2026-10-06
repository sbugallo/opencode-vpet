import type { DigitalPetControl } from "@jcendal/digital-pet-core/application/ports/digital-pet-control.ts"
import { freezeDigitalPet } from "@jcendal/digital-pet-core/application/use-cases/freeze-digital-pet.ts"
import type { DigitalPetCommandResult } from "./digital-pet-command-result.ts"

export type DigitalPetFreezeContext = {
  readonly sessionID: string
  readonly messageID: string
}

export const runDigitalPetFreezeCommand = async (
  control: Pick<DigitalPetControl, "freeze">,
  context: DigitalPetFreezeContext,
): Promise<DigitalPetCommandResult> => {
  const outcome = freezeDigitalPet(control)
  const parts = [
    {
      id: context.messageID,
      sessionID: context.sessionID,
      messageID: context.messageID,
      type: "text" as const,
      text: "Digital Pet frozen.",
    },
  ]

  switch (outcome.kind) {
    case "frozen":
      return { parts, event: { kind: "frozen" } }
    case "already_frozen":
      return { parts }
    default: {
      const unexpectedOutcome: never = outcome
      return unexpectedOutcome
    }
  }
}
