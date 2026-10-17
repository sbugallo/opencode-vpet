import type { VpetControl } from "../application/ports/vpet-control.ts"
import { freezeVpet } from "../application/use-cases/freeze-vpet.ts"
import type { VpetCommandResult } from "./vpet-command-result.ts"

export const runVpetFreezeCommand = async (control: Pick<VpetControl, "freeze">): Promise<VpetCommandResult> => {
  const outcome = freezeVpet(control)

  switch (outcome.kind) {
    case "frozen":
      return { message: "VPet frozen.", variant: "info", event: { kind: "frozen" } }
    case "already_frozen":
      return { message: "VPet is already frozen.", variant: "info" }
    default: {
      const unexpectedOutcome: never = outcome
      return unexpectedOutcome
    }
  }
}
