import type { DigitalPetArchiveResult } from "../models/digital-pet-archive.ts"

export type DigitalPetArchiveReader = {
  getArchive: () => DigitalPetArchiveResult
}
