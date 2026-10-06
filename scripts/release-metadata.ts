import { readFile, writeFile } from "node:fs/promises"

import semver from "semver"

const RELEASE_BUMPS = ["patch", "minor", "major"] as const

export type ReleaseBump = (typeof RELEASE_BUMPS)[number]

type ReleaseMetadataCliOptions = {
  readonly bump: ReleaseBump
  readonly changelogPath: string
  readonly date: string
  readonly legacyTagPrefix?: string
  readonly packageJsonPath: string
  readonly tagPrefix: string
}

type JsonObject = {
  readonly [key: string]: unknown
}

type PackageMetadata = JsonObject & {
  readonly version: string
}

const isReleaseBump = (value: string): value is ReleaseBump =>
  value === "patch" || value === "minor" || value === "major"

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isStableVersion = (value: string): boolean => semver.valid(value) === value && semver.prerelease(value) === null

const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return false
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
}

const getPackageVersion = (value: JsonObject): string | undefined => {
  const version = Object.getOwnPropertyDescriptor(value, "version")?.value
  return typeof version === "string" ? version : undefined
}

const parseReleaseBump = (value: string | undefined): ReleaseBump => {
  if (value === undefined || !isReleaseBump(value)) throw new Error("Expected --bump patch|minor|major.")
  return value
}

const getStableTagVersions = (tags: readonly string[], prefix: string): readonly string[] =>
  tags.flatMap((tag) => {
    if (!tag.startsWith(prefix)) return []
    const version = tag.slice(prefix.length)
    return semver.valid(version) === version && semver.prerelease(version) === null ? [version] : []
  })

const getLatestStableVersion = (tags: readonly string[], prefix: string): string | undefined =>
  semver.rsort([...getStableTagVersions(tags, prefix)])[0]

const getReleaseLineVersion = (tags: readonly string[], prefix: string, legacyPrefix?: string): string | undefined =>
  getLatestStableVersion(tags, prefix) ??
  (legacyPrefix === undefined ? undefined : getLatestStableVersion(tags, legacyPrefix))

const parsePackageMetadata = (source: string): PackageMetadata => {
  const value: unknown = JSON.parse(source)
  if (!isJsonObject(value)) {
    throw new Error("package.json must contain an object with a string version.")
  }
  const version = getPackageVersion(value)
  if (version === undefined || semver.valid(version) !== version) {
    throw new Error("package.json must contain an exact SemVer version.")
  }
  return { ...value, version }
}

const parseCliOptions = (arguments_: readonly string[]): ReleaseMetadataCliOptions => {
  const values = new Map<string, string>()
  for (let index = 0; index < arguments_.length; index += 2) {
    const option = arguments_[index]
    const value = arguments_[index + 1]
    if (option === undefined || value === undefined || !option.startsWith("--")) {
      throw new Error("Expected --option value pairs.")
    }
    values.set(option, value)
  }

  const bump = parseReleaseBump(values.get("--bump"))
  const packageJsonPath = values.get("--package-json")
  const changelogPath = values.get("--changelog")
  const date = values.get("--date")
  const tagPrefix = values.get("--tag-prefix") ?? "v"
  const legacyTagPrefix = values.get("--legacy-tag-prefix")
  if (packageJsonPath === undefined || changelogPath === undefined || date === undefined) {
    throw new Error("Expected --package-json, --changelog, and --date.")
  }
  if (tagPrefix.length === 0 || legacyTagPrefix === "") throw new Error("Tag prefixes must not be empty.")

  return { bump, changelogPath, date, legacyTagPrefix, packageJsonPath, tagPrefix }
}

export const calculateReleaseVersion = (tags: readonly string[], bump: ReleaseBump, prefix = "v"): string => {
  const latestVersion = getLatestStableVersion(tags, prefix) ?? "0.0.0"
  const releaseVersion = semver.inc(latestVersion, bump)
  if (releaseVersion === null) throw new Error(`Cannot calculate ${bump} release from ${latestVersion}.`)
  return releaseVersion
}

export const calculateNextDevelopmentVersion = (releaseVersion: string): string => {
  if (!isStableVersion(releaseVersion)) throw new Error(`Release version must be stable SemVer: ${releaseVersion}.`)
  const nextDevVersion = semver.inc(releaseVersion, "prepatch", "dev")
  if (nextDevVersion === null) throw new Error(`Cannot calculate next development version from ${releaseVersion}.`)
  return nextDevVersion
}

const resolveReleaseVersion = (
  sourceVersion: string,
  tags: readonly string[],
  options: ReleaseMetadataCliOptions,
): string => {
  const latestProductVersion = getLatestStableVersion(tags, options.tagPrefix)
  const latestStableVersion =
    latestProductVersion ?? getReleaseLineVersion(tags, options.tagPrefix, options.legacyTagPrefix)
  if (latestStableVersion === undefined) {
    if (isStableVersion(sourceVersion)) return calculateReleaseVersion([], options.bump)
    const initialVersion = sourceVersion.replace(/-dev\.0$/, "")
    if (initialVersion === sourceVersion || !isStableVersion(initialVersion)) {
      throw new Error(`Initial release source must be stable SemVer or an exact -dev.0 candidate: ${sourceVersion}.`)
    }
    return initialVersion
  }
  const expectedSourceVersion = calculateNextDevelopmentVersion(latestStableVersion)
  const legacySourceVersion = semver.inc(latestStableVersion, "preminor", "dev")
  const migratingLegacyTags = latestProductVersion === undefined && options.legacyTagPrefix !== undefined
  if (sourceVersion !== expectedSourceVersion && !(migratingLegacyTags && sourceVersion === legacySourceVersion)) {
    throw new Error(`Release source version must match the expected development version: ${expectedSourceVersion}.`)
  }
  const releaseVersion = semver.inc(latestStableVersion, options.bump)
  if (releaseVersion === null) throw new Error(`Cannot calculate ${options.bump} release from ${latestStableVersion}.`)
  if (migratingLegacyTags && sourceVersion === legacySourceVersion && sourceVersion !== `${releaseVersion}-dev.0`) {
    throw new Error(`The first product release must match its existing development candidate: ${sourceVersion}.`)
  }
  return releaseVersion
}

export const insertReleaseIntoChangelog = (changelog: string, version: string, date: string): string => {
  const unreleasedHeading = "## [Unreleased]"
  const unreleasedHeadings = changelog.match(/^## \[Unreleased\]$/gm) ?? []
  if (unreleasedHeadings.length !== 1) throw new Error("CHANGELOG.md must contain exactly one ## [Unreleased] section.")
  if (!isStableVersion(version)) throw new Error(`Release version must be stable SemVer: ${version}.`)
  if (!isIsoDate(date)) throw new Error(`Release date must be YYYY-MM-DD: ${date}.`)
  const releaseHeading = `## [${version}] -`
  if (changelog.includes(releaseHeading)) throw new Error(`CHANGELOG.md already contains release ${version}.`)
  const offset = changelog.indexOf(unreleasedHeading)
  const insertionPoint = offset + unreleasedHeading.length
  return `${changelog.slice(0, insertionPoint)}\n\n## [${version}] - ${date}${changelog.slice(insertionPoint)}`
}

export const extractReleaseNotes = (changelog: string, version: string): string => {
  if (!isStableVersion(version)) throw new Error(`Release version must be stable SemVer: ${version}.`)
  const heading = new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\] - \\d{4}-\\d{2}-\\d{2}$`, "m")
  const match = heading.exec(changelog)
  if (match === null) throw new Error(`CHANGELOG.md is missing release ${version}.`)
  const rest = changelog.slice(match.index + match[0].length)
  const nextHeading = /^## /m.exec(rest)
  const notes = rest.slice(0, nextHeading?.index).trim()
  if (notes.length === 0) throw new Error(`CHANGELOG.md has no notes for release ${version}.`)
  return `${notes}\n`
}

export const runReleaseMetadataCli = async (
  arguments_: readonly string[],
): Promise<{ readonly nextDevVersion: string; readonly releaseVersion: string }> => {
  const options = parseCliOptions(arguments_)
  let tagInput = ""
  for await (const chunk of process.stdin) tagInput += chunk.toString()
  const [packageJsonSource, changelog, tags] = await Promise.all([
    readFile(options.packageJsonPath, "utf8"),
    readFile(options.changelogPath, "utf8"),
    Promise.resolve(tagInput),
  ])
  const stableTags = tags.split(/\r?\n/).filter(Boolean)
  const packageMetadata = parsePackageMetadata(packageJsonSource)
  const releaseVersion = resolveReleaseVersion(packageMetadata.version, stableTags, options)
  const nextDevVersion = calculateNextDevelopmentVersion(releaseVersion)
  const releasePackageJson = `${JSON.stringify({ ...packageMetadata, version: releaseVersion }, null, 2)}\n`
  const releaseChangelog = insertReleaseIntoChangelog(changelog, releaseVersion, options.date)
  await Promise.all([
    writeFile(options.packageJsonPath, releasePackageJson),
    writeFile(options.changelogPath, releaseChangelog),
  ])
  return { nextDevVersion, releaseVersion }
}

export const setStablePackageVersion = async (packageJsonPath: string, version: string): Promise<void> => {
  if (!isStableVersion(version)) {
    throw new Error(`Package version must be stable SemVer: ${version}.`)
  }
  const packageMetadata = parsePackageMetadata(await readFile(packageJsonPath, "utf8"))
  if (packageMetadata.version === version) return
  await writeFile(packageJsonPath, `${JSON.stringify({ ...packageMetadata, version }, null, 2)}\n`)
}

export const setPackageVersion = async (packageJsonPath: string, version: string): Promise<void> => {
  if (semver.valid(version) !== version || semver.prerelease(version) === null) {
    throw new Error(`Package version must be an exact prerelease SemVer version: ${version}.`)
  }
  const packageMetadata = parsePackageMetadata(await readFile(packageJsonPath, "utf8"))
  if (!isStableVersion(packageMetadata.version)) {
    throw new Error(`Current package version must be stable SemVer: ${packageMetadata.version}.`)
  }
  await writeFile(packageJsonPath, `${JSON.stringify({ ...packageMetadata, version }, null, 2)}\n`)
}

const writeGithubOutputs = async (result: {
  readonly nextDevVersion: string
  readonly releaseVersion: string
}): Promise<void> => {
  const { GITHUB_OUTPUT: outputPath } = process.env
  if (outputPath === undefined) return
  await writeFile(outputPath, `release_version=${result.releaseVersion}\nnext_dev_version=${result.nextDevVersion}\n`, {
    flag: "a",
  })
}

if (import.meta.main) {
  const [command, ...arguments_] = process.argv.slice(2)
  if (command === "release-notes") {
    const [changelogPath, version] = arguments_
    if (changelogPath === undefined || version === undefined || arguments_.length !== 2) {
      throw new Error("Expected release-notes <changelog-path> <version>.")
    }
    process.stdout.write(extractReleaseNotes(await readFile(changelogPath, "utf8"), version))
  } else if (command === "set-package-stable-version") {
    const [packageJsonPath, version] = arguments_
    if (packageJsonPath === undefined || version === undefined || arguments_.length !== 2) {
      throw new Error("Expected set-package-stable-version <package-json-path> <version>.")
    }
    await setStablePackageVersion(packageJsonPath, version)
  } else if (command === "set-package-version") {
    const [packageJsonPath, version] = arguments_
    if (packageJsonPath === undefined || version === undefined || arguments_.length !== 2) {
      throw new Error("Expected set-package-version <package-json-path> <version>.")
    }
    await setPackageVersion(packageJsonPath, version)
  } else {
    const result = await runReleaseMetadataCli(process.argv.slice(2))
    await writeGithubOutputs(result)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
}
