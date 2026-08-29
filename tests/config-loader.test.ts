import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, posix, win32 } from "node:path"

import {
  loadGlobalVpetSettings,
  loadGlobalVpetSettingsSync,
  resolveGlobalVpetConfigPath,
} from "../src/config/global-vpet-settings.ts"
import { DEFAULT_VPET_SETTINGS } from "../src/config/defaults.ts"

const tempRoots: string[] = []

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "opencode-vpet-config-"))
  tempRoots.push(root)
  return root
}

const resolveConfigPath = (root: string): string => join(root, ".config", "opencode-vpet.json")

const createConfigDirectory = async (root: string): Promise<string> => {
  const directory = join(root, ".config")
  await mkdir(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("global VPet configuration paths", () => {
  test.each([
    ["Linux", "linux", "/home/na me/雪", "/home/na me/雪/.config/opencode-vpet.json"],
    ["macOS", "darwin", "/Users/na me/雪", "/Users/na me/雪/.config/opencode-vpet.json"],
    ["WSL", "linux", "/home/na me/雪", "/home/na me/雪/.config/opencode-vpet.json"],
  ] as const)(
    "Given %s with OpenCode and XDG variables When resolving with path.posix Then it uses the independent VPet path",
    (_name, platform, home, expected) => {
      expect(
        resolveGlobalVpetConfigPath({
          env: {
            APPDATA: "/app-data/雪",
            OPENCODE_CONFIG_DIR: "/open-code-config/雪",
            XDG_CONFIG_HOME: "/xdg-config/雪",
          },
          home,
          pathApi: posix,
          platform,
        }),
      ).toBe(expected)
    },
  )

  test.each([
    [
      "APPDATA",
      { APPDATA: "C:\\App Data\\雪", OPENCODE_CONFIG_DIR: "C:\\OpenCode\\雪", XDG_CONFIG_HOME: "C:\\XDG\\雪" },
      "C:\\Users\\ignored",
      "C:\\App Data\\雪\\opencode-vpet.json",
    ],
    [
      "home fallback",
      { OPENCODE_CONFIG_DIR: "C:\\OpenCode\\雪", XDG_CONFIG_HOME: "C:\\XDG\\雪" },
      "C:\\Users\\na me\\雪",
      "C:\\Users\\na me\\雪\\AppData\\Roaming\\opencode-vpet.json",
    ],
  ] as const)(
    "Given native Windows with %s When resolving with path.win32 Then it uses the independent VPet path",
    (_name, env, home, expected) => {
      expect(resolveGlobalVpetConfigPath({ env, home, pathApi: win32, platform: "win32" })).toBe(expected)
    },
  )

  test.each([
    ["missing", async (_root: string) => undefined],
    [
      "unreadable directory",
      async (root: string) => {
        await mkdir(resolveConfigPath(root), { recursive: true })
      },
    ],
    [
      "malformed",
      async (root: string) => {
        await createConfigDirectory(root)
        await writeFile(resolveConfigPath(root), "{")
      },
    ],
    [
      "scalar root",
      async (root: string) => {
        await createConfigDirectory(root)
        await writeFile(resolveConfigPath(root), '"jp"')
      },
    ],
  ] as const)(
    "Given a %s file When loading synchronously Then it returns exact defaults without changing the filesystem",
    async (_name, createPath) => {
      const root = await createTempRoot()
      await createPath(root)
      const entriesBefore = await readdir(root)

      const settings = loadGlobalVpetSettingsSync({
        home: root,
        pathApi: posix,
      })

      expect(settings).toEqual(DEFAULT_VPET_SETTINGS)
      expect(await readdir(root)).toEqual(entriesBefore)
    },
  )
})

describe("global VPet configuration loading", () => {
  test("Given a valid file with mixed settings When loading asynchronously Then valid siblings survive in a frozen snapshot", async () => {
    const root = await createTempRoot()
    await createConfigDirectory(root)
    await writeFile(
      resolveConfigPath(root),
      JSON.stringify({ language: "en", notifications: false, stageThresholds: { child: 777, egg: 0 } }),
    )

    const settings = await loadGlobalVpetSettings({
      home: root,
      pathApi: posix,
    })

    expect(settings).toEqual({
      ...DEFAULT_VPET_SETTINGS,
      language: "en",
      notifications: false,
      stageThresholds: { ...DEFAULT_VPET_SETTINGS.stageThresholds, child: 777 },
    })
    expect(Object.isFrozen(settings)).toBeTrue()
    expect(Object.isFrozen(settings.stageThresholds)).toBeTrue()
  })

  test("Given a valid file When loading synchronously Then it returns an immutable normalized snapshot", async () => {
    const root = await createTempRoot()
    await createConfigDirectory(root)
    await writeFile(resolveConfigPath(root), JSON.stringify({ stageThresholds: { adult: 999 } }))

    const settings = loadGlobalVpetSettingsSync({ home: root, pathApi: posix })

    expect(settings.stageThresholds.adult).toBe(999)
    expect(Object.isFrozen(settings)).toBeTrue()
    expect(Object.isFrozen(settings.stageThresholds)).toBeTrue()
  })

  test.each([
    ["missing", {}],
    ["string", { notifications: "false" }],
    ["number", { notifications: 0 }],
    ["object", { notifications: {} }],
  ] as const)(
    "Given %s notifications in a file When loading Then it falls back to the enabled preference",
    async (_name, config) => {
      const root = await createTempRoot()
      await createConfigDirectory(root)
      await writeFile(resolveConfigPath(root), JSON.stringify(config))

      expect((await loadGlobalVpetSettings({ home: root, pathApi: posix })).notifications).toBeTrue()
      expect(loadGlobalVpetSettingsSync({ home: root, pathApi: posix }).notifications).toBeTrue()
    },
  )

  test.each([
    ["missing", async (_root: string) => undefined],
    [
      "unreadable directory",
      async (root: string) => {
        await mkdir(resolveConfigPath(root), { recursive: true })
      },
    ],
    [
      "malformed",
      async (root: string) => {
        await createConfigDirectory(root)
        await writeFile(resolveConfigPath(root), "{")
      },
    ],
    [
      "scalar root",
      async (root: string) => {
        await createConfigDirectory(root)
        await writeFile(resolveConfigPath(root), '"jp"')
      },
    ],
  ] as const)(
    "Given a %s file When loading Then it returns exact defaults without changing the filesystem",
    async (_name, createPath) => {
      const root = await createTempRoot()
      await createPath(root)
      const entriesBefore = await readdir(root)

      const settings = await loadGlobalVpetSettings({
        home: root,
        pathApi: posix,
      })

      expect(settings).toEqual(DEFAULT_VPET_SETTINGS)
      expect(await readdir(root)).toEqual(entriesBefore)
    },
  )
})
