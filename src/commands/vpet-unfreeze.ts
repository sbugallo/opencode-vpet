import type { VpetControl } from "../application/ports/vpet-control.ts"
import { unfreezeVpet } from "../application/use-cases/unfreeze-vpet.ts"
import type { VpetCommandResult } from "./vpet-command-result.ts"

export const runVpetUnfreezeCommand = async (control: Pick<VpetControl, "unfreeze">): Promise<VpetCommandResult> => {
  const outcome = unfreezeVpet(control)

  switch (outcome.kind) {
    case "unfrozen":
      return { message: "VPet unfrozen.", variant: "info", event: { kind: "unfrozen" } }
    case "already_unfrozen":
      return { message: "VPet is not frozen.", variant: "info" }
    default: {
      const unexpectedOutcome: never = outcome
      return unexpectedOutcome
    }
  }
}
