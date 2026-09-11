import type { FreezeVpetOutcome } from "../models/vpet-control.ts"
import type { VpetControl } from "../ports/vpet-control.ts"

export const freezeVpet = (control: Pick<VpetControl, "freeze">): FreezeVpetOutcome => control.freeze()
