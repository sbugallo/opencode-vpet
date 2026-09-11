import { copyFile, rm } from "node:fs/promises"
import { resolve } from "node:path"

const monorepoRoot = resolve(import.meta.dir, "..")

export const getMonorepoChangelogPath = (): string => resolve(monorepoRoot, "CHANGELOG.md")

export const getStagedChangelogPath = (packageRoot: string): string => resolve(packageRoot, "CHANGELOG.md")

export const stageChangelog = async (packageRoot: string): Promise<void> => {
  const changelogSource = getMonorepoChangelogPath()
  const changelogTarget = getStagedChangelogPath(packageRoot)
  const source = Bun.file(changelogSource)
  if (!(await source.exists()) || source.size === 0) {
    throw new Error(`Monorepo changelog is missing or empty: ${changelogSource}`)
  }
  await copyFile(changelogSource, changelogTarget)
}

export const removeStagedChangelog = async (packageRoot: string): Promise<void> => {
  await rm(getStagedChangelogPath(packageRoot), { force: true })
}

if (import.meta.main) {
  const arguments_ = Bun.argv.slice(2)
  if (arguments_[0] === "remove") {
    const packageRoot = arguments_[1]
    if (packageRoot === undefined) throw new Error("Expected remove <package-root>.")
    await removeStagedChangelog(resolve(packageRoot))
  } else {
    const packageRoot = arguments_[0]
    if (packageRoot === undefined) throw new Error("Expected <package-root>.")
    await stageChangelog(resolve(packageRoot))
  }
}
