import type { VpetControl } from "@sbugallo/vpet-core/application/ports/vpet-control.ts"
import { freezeVpet } from "@sbugallo/vpet-core/application/use-cases/freeze-vpet.ts"
import type { VpetCommandResult } from "./vpet-command-result.ts"

export type VpetFreezeContext = {
  readonly sessionID: string
  readonly messageID: string
}

export const runVpetFreezeCommand = async (
  control: Pick<VpetControl, "freeze">,
  context: VpetFreezeContext,
): Promise<VpetCommandResult> => {
  const outcome = freezeVpet(control)
  const parts = [
    {
      id: context.messageID,
      sessionID: context.sessionID,
      messageID: context.messageID,
      type: "text" as const,
      text: "VPet frozen.",
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
