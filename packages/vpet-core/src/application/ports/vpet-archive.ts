import type { VpetArchiveResult } from "../models/vpet-archive.ts"

export type VpetArchiveReader = {
  getArchive: () => VpetArchiveResult
}
