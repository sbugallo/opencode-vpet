import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

type JsonObject = { readonly [key: string]: unknown }

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const INTERNAL_PACKAGES = new Set(["@jcendal/digital-pet-core", "@jcendal/digital-pet-animation"])

const withoutInternalDependencies = (dependencies: unknown): JsonObject | undefined => {
  if (!isJsonObject(dependencies)) return undefined
  const filtered = Object.fromEntries(Object.entries(dependencies).filter(([name]) => !INTERNAL_PACKAGES.has(name)))
  return Object.keys(filtered).length > 0 ? filtered : undefined
}

export const stripInternalDependencies = async (packageRoot: string): Promise<string> => {
  const packageJsonPath = resolve(packageRoot, "package.json")
  const originalSource = await readFile(packageJsonPath, "utf8")
  const packageMetadata = JSON.parse(originalSource) as JsonObject
  if (!isJsonObject(packageMetadata)) throw new Error("package.json must contain an object.")

  const dependencies = withoutInternalDependencies(packageMetadata["dependencies"])
  const publishMetadata = { ...packageMetadata } as Record<string, unknown>
  if (dependencies === undefined) {
    delete publishMetadata["dependencies"]
  } else {
    publishMetadata["dependencies"] = dependencies
  }

  await writeFile(packageJsonPath, `${JSON.stringify(publishMetadata, null, 2)}\n`)
  return originalSource
}

export const restorePackageJson = async (packageRoot: string, originalSource: string): Promise<void> => {
  await writeFile(resolve(packageRoot, "package.json"), originalSource)
}
