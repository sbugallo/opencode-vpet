import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = join(import.meta.dirname, "..", "packages", "opencode-digital-pet")

const REPLACEMENTS = [
  [/from "(\.\.\/)+domain\//g, 'from "@jcendal/digital-pet-core/domain/'],
  [/from "\.\/domain\//g, 'from "@jcendal/digital-pet-core/domain/'],
  [/from "(\.\.\/)+application\//g, 'from "@jcendal/digital-pet-core/application/'],
  [/from "\.\/application\//g, 'from "@jcendal/digital-pet-core/application/'],
  [/from "(\.\.\/)+data\//g, 'from "@jcendal/digital-pet-core/data/'],
  [/from "\.\/data\//g, 'from "@jcendal/digital-pet-core/data/'],
  [/from "(\.\.\/)+config\/types\.ts"/g, 'from "@jcendal/digital-pet-core/config/types.ts"'],
  [/from "\.\/config\/types\.ts"/g, 'from "@jcendal/digital-pet-core/config/types.ts"'],
  [/from "(\.\.\/)+config\/defaults\.ts"/g, 'from "@jcendal/digital-pet-core/config/defaults.ts"'],
  [/from "\.\/config\/defaults\.ts"/g, 'from "@jcendal/digital-pet-core/config/defaults.ts"'],
  [/from "(\.\.\/)+config\/normalize\.ts"/g, 'from "@jcendal/digital-pet-core/config/normalize.ts"'],
  [/from "\.\/config\/normalize\.ts"/g, 'from "@jcendal/digital-pet-core/config/normalize.ts"'],
  [/from "\.\/sidebar-view-model\.ts"/g, 'from "@jcendal/digital-pet-core/view-models/sidebar-view-model.ts"'],
  [/from "\.\/dex-view-model\.ts"/g, 'from "@jcendal/digital-pet-core/view-models/dex-view-model.ts"'],
  [/from "\.\/history-view-model\.ts"/g, 'from "@jcendal/digital-pet-core/view-models/history-view-model.ts"'],
  [/from "\.\.\/tui\/sidebar-view-model\.ts"/g, 'from "@jcendal/digital-pet-core/view-models/sidebar-view-model.ts"'],
  [/from "\.\.\/tui\/dex-view-model\.ts"/g, 'from "@jcendal/digital-pet-core/view-models/dex-view-model.ts"'],
  [/from "\.\.\/tui\/history-view-model\.ts"/g, 'from "@jcendal/digital-pet-core/view-models/history-view-model.ts"'],
  [/from "\.\.\/src\/domain\//g, 'from "@jcendal/digital-pet-core/domain/'],
  [/from "\.\.\/\.\.\/src\/domain\//g, 'from "@jcendal/digital-pet-core/domain/'],
  [/from "\.\.\/src\/application\//g, 'from "@jcendal/digital-pet-core/application/'],
  [/from "\.\.\/\.\.\/src\/application\//g, 'from "@jcendal/digital-pet-core/application/'],
  [/from "\.\.\/src\/data\//g, 'from "@jcendal/digital-pet-core/data/'],
  [/from "\.\.\/\.\.\/src\/data\//g, 'from "@jcendal/digital-pet-core/data/'],
  [/from "\.\.\/src\/data\/digimon-data"/g, 'from "@jcendal/digital-pet-core/data/digimon-data.ts"'],
]

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path)
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      let content = await readFile(path, "utf8")
      for (const [pattern, replacement] of REPLACEMENTS) {
        content = content.replace(pattern, replacement)
      }
      await writeFile(path, content)
    }
  }
}

await walk(join(ROOT, "src"))
await walk(join(ROOT, "tests"))
console.log("Import migration complete")
