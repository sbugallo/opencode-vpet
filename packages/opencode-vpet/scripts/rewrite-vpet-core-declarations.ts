import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"

const packageRoot = resolve(import.meta.dir, "..")
const distRoot = resolve(packageRoot, "dist")
const vpetCoreImportPattern = /(?<=(?:from|export)\s+["'])@sbugallo\/vpet-core\/([^"']+)(?=["'])/g

const toPublishedSubpath = (importPath: string): string => importPath.replace(/\.ts$/, ".js")

const rewriteImportPath = (filePath: string, importPath: string): string => {
  const target = join(distRoot, "vpet-core", toPublishedSubpath(importPath))
  const relativePath = relative(dirname(filePath), target).replace(/\\/g, "/")
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`
}

const rewriteFile = async (filePath: string): Promise<void> => {
  const original = await readFile(filePath, "utf8")
  const rewritten = original.replace(vpetCoreImportPattern, (_match, importPath: string) =>
    rewriteImportPath(filePath, importPath),
  )
  if (rewritten !== original) {
    await writeFile(filePath, rewritten)
  }
}

const walkDeclarationFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "vpet-core") continue
      files.push(...(await walkDeclarationFiles(entryPath)))
      continue
    }
    if (entry.name.endsWith(".d.ts")) files.push(entryPath)
  }
  return files
}

const declarationFiles = await walkDeclarationFiles(distRoot)
for (const declarationFile of declarationFiles) {
  await rewriteFile(declarationFile)
}
