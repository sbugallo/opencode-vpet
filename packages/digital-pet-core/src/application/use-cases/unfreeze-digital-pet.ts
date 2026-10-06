import type { UnfreezeDigitalPetOutcome } from "../models/digital-pet-control.ts"
import type { DigitalPetControl } from "../ports/digital-pet-control.ts"

export const unfreezeDigitalPet = (control: Pick<DigitalPetControl, "unfreeze">): UnfreezeDigitalPetOutcome =>
  control.unfreeze()
