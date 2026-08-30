import type { UnfreezeVpetOutcome } from "../models/vpet-control.ts"
import type { VpetControl } from "../ports/vpet-control.ts"

export const unfreezeVpet = (control: Pick<VpetControl, "unfreeze">): UnfreezeVpetOutcome => control.unfreeze()
