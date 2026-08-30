import type { VpetControl } from "../application/ports/vpet-control.ts"
import { unfreezeVpet } from "../application/use-cases/unfreeze-vpet.ts"
import type { VpetCommandResult } from "./vpet-command-result.ts"

export type VpetUnfreezeContext = {
  readonly sessionID: string
  readonly messageID: string
}

export const runVpetUnfreezeCommand = async (
  control: Pick<VpetControl, "unfreeze">,
  context: VpetUnfreezeContext,
): Promise<VpetCommandResult> => {
  const outcome = unfreezeVpet(control)
  const parts = [
    {
      id: context.messageID,
      sessionID: context.sessionID,
      messageID: context.messageID,
      type: "text" as const,
      text: "VPet unfrozen.",
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
