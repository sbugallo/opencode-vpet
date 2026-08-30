import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import {
  calculateNextDevelopmentVersion,
  calculateReleaseVersion,
  insertReleaseIntoChangelog,
} from "../scripts/release-metadata.ts"

const tempRoots: string[] = []

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "opencode-vpet-release-metadata-"))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("release metadata", () => {
  test("Given stable, prerelease, and noncanonical tags When calculating a minor release Then it increments the highest canonical stable tag", () => {
    const releaseVersion = calculateReleaseVersion(
      ["v1.2.0", "v2.0.0-rc.1", "release-9.9.9", "v1.10.3", "v01.20.0"],
      "minor",
    )

    expect(releaseVersion).toBe("1.11.0")
  })

  test.each([
    ["patch", "0.0.1"],
    ["minor", "0.1.0"],
    ["major", "1.0.0"],
  ] as const)(
    "Given no stable tags When calculating a %s release Then it increments 0.0.0",
    (bump, expectedVersion) => {
      expect(calculateReleaseVersion([], bump)).toBe(expectedVersion)
    },
  )

  test.each([
    ["1.4.3", "1.5.0-dev.0"],
    ["2.0.0", "2.1.0-dev.0"],
  ] as const)(
    "Given a stable release %s When calculating its next development version Then it is %s",
    (releaseVersion, expectedVersion) => {
      expect(calculateNextDevelopmentVersion(releaseVersion)).toBe(expectedVersion)
    },
  )

  test("Given an unreleased changelog section When inserting a release Then it places the dated version before its existing entries", () => {
    const changelog = "# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Feature\n"

    expect(insertReleaseIntoChangelog(changelog, "1.2.3", "2026-08-30")).toBe(
      "# Changelog\n\n## [Unreleased]\n\n## [1.2.3] - 2026-08-30\n\n### Added\n\n- Feature\n",
    )
  })

  test.each([
    ["# Changelog\n", "1.2.3", "2026-08-30"],
    ["## [Unreleased]\n\n## [Unreleased]\n", "1.2.3", "2026-08-30"],
    ["## [Unreleased]\n\n## [1.2.3] - 2026-08-01\n", "1.2.3", "2026-08-30"],
    ["## [Unreleased]\n", "1.2.3-dev.0", "2026-08-30"],
    ["## [Unreleased]\n", "1.2.3", "2026-13-30"],
    ["## [Unreleased]\n", "1.2.3", "2026-02-31"],
  ] as const)(
    "Given invalid release changelog metadata When inserting a release Then it rejects the mutation",
    (changelog, version, date) => {
      expect(() => insertReleaseIntoChangelog(changelog, version, date)).toThrow()
    },
  )

  test("Given a prerelease version When calculating the next development version Then it rejects a nonstable release source", () => {
    expect(() => calculateNextDevelopmentVersion("1.2.3-dev.0")).toThrow()
  })

  test("Given newline-separated tags on stdin When the helper CLI prepares a patch release Then it updates only the fixture metadata and reports stable versions", async () => {
    const root = await createTempRoot()
    const packageJsonPath = join(root, "package.json")
    const changelogPath = join(root, "CHANGELOG.md")
    const outputPath = join(root, "github-output")
    await Promise.all([
      writeFile(packageJsonPath, '{\n  "name": "fixture",\n  "version": "1.5.0-dev.0"\n}\n'),
      writeFile(changelogPath, "# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Fixture\n"),
    ])

    const result = Bun.spawnSync(
      [
        "bun",
        resolve(import.meta.dir, "../scripts/release-metadata.ts"),
        "--package-json",
        packageJsonPath,
        "--changelog",
        changelogPath,
        "--bump",
        "minor",
        "--date",
        "2026-08-30",
      ],
      {
        env: { ...process.env, GITHUB_OUTPUT: outputPath },
        stdin: new Blob(["v1.2.3\nv1.9.0-dev.2\nv1.4.5\n"]),
      },
    )

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(new TextDecoder().decode(result.stdout))).toEqual({
      nextDevVersion: "1.6.0-dev.0",
      releaseVersion: "1.5.0",
    })
    expect(await readFile(packageJsonPath, "utf8")).toContain('"version": "1.5.0"')
    expect(await readFile(changelogPath, "utf8")).toContain("## [1.5.0] - 2026-08-30")
    expect(await readFile(outputPath, "utf8")).toBe("release_version=1.5.0\nnext_dev_version=1.6.0-dev.0\n")
  })

  test("Given a latest stable tag and its expected development source When the helper CLI prepares a minor release Then it releases from that development source", async () => {
    const root = await createTempRoot()
    const packageJsonPath = join(root, "package.json")
    const changelogPath = join(root, "CHANGELOG.md")
    await Promise.all([
      writeFile(packageJsonPath, '{"name":"fixture","version":"1.5.0-dev.0"}\n'),
      writeFile(changelogPath, "# Changelog\n\n## [Unreleased]\n"),
    ])

    const result = Bun.spawnSync(
      [
        "bun",
        resolve(import.meta.dir, "../scripts/release-metadata.ts"),
        "--package-json",
        packageJsonPath,
        "--changelog",
        changelogPath,
        "--bump",
        "minor",
        "--date",
        "2026-08-30",
      ],
      { stdin: new Blob(["v1.4.3\n"]) },
    )

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(new TextDecoder().decode(result.stdout))).toEqual({
      nextDevVersion: "1.6.0-dev.0",
      releaseVersion: "1.5.0",
    })
  })

  test("Given a latest stable tag and mismatched development source When the helper CLI prepares a release Then it rejects the package source", async () => {
    const root = await createTempRoot()
    const packageJsonPath = join(root, "package.json")
    const changelogPath = join(root, "CHANGELOG.md")
    await Promise.all([
      writeFile(packageJsonPath, '{"name":"fixture","version":"1.5.1-dev.0"}\n'),
      writeFile(changelogPath, "# Changelog\n\n## [Unreleased]\n"),
    ])

    const result = Bun.spawnSync(
      [
        "bun",
        resolve(import.meta.dir, "../scripts/release-metadata.ts"),
        "--package-json",
        packageJsonPath,
        "--changelog",
        changelogPath,
        "--bump",
        "patch",
        "--date",
        "2026-08-30",
      ],
      { stdin: new Blob(["v1.4.3\n"]) },
    )

    expect(result.exitCode).not.toBe(0)
    expect(await readFile(packageJsonPath, "utf8")).toBe('{"name":"fixture","version":"1.5.1-dev.0"}\n')
  })
})
