import type { SetCheatNodeOutcome } from "../models/digital-pet-control.ts"
import type { DigitalPetControl } from "../ports/digital-pet-control.ts"

export const setDigitalPetCheatNode = (
  control: Pick<DigitalPetControl, "setCheatNode">,
  validatedNodeId: string,
): SetCheatNodeOutcome => control.setCheatNode(validatedNodeId)
