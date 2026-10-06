import type { FreezeDigitalPetOutcome } from "../models/digital-pet-control.ts"
import type { DigitalPetControl } from "../ports/digital-pet-control.ts"

export const freezeDigitalPet = (control: Pick<DigitalPetControl, "freeze">): FreezeDigitalPetOutcome =>
  control.freeze()
