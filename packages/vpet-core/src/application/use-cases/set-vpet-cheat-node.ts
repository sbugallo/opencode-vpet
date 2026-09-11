import type { SetCheatNodeOutcome } from "../models/vpet-control.ts"
import type { VpetControl } from "../ports/vpet-control.ts"

export const setVpetCheatNode = (
  control: Pick<VpetControl, "setCheatNode">,
  validatedNodeId: string,
): SetCheatNodeOutcome => control.setCheatNode(validatedNodeId)
