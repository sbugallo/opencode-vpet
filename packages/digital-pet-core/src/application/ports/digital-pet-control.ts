import type {
  FreezeDigitalPetOutcome,
  SetCheatNodeOutcome,
  UnfreezeDigitalPetOutcome,
} from "../models/digital-pet-control.ts"

export type DigitalPetControl = {
  freeze: () => FreezeDigitalPetOutcome
  unfreeze: () => UnfreezeDigitalPetOutcome
  setCheatNode: (validatedNodeId: string) => SetCheatNodeOutcome
}
