import type { FreezeVpetOutcome, SetCheatNodeOutcome, UnfreezeVpetOutcome } from "../models/vpet-control.ts"

export type VpetControl = {
  freeze: () => FreezeVpetOutcome
  unfreeze: () => UnfreezeVpetOutcome
  setCheatNode: (validatedNodeId: string) => SetCheatNodeOutcome
}
