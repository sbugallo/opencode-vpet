import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, posix, win32 } from "node:path"

import {
  loadGlobalDigitalPetSettings,
  loadGlobalDigitalPetSettingsSync,
  resolveGlobalDigitalPetConfigPath,
} from "../src/config/global-digital-pet-settings.ts"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"

const tempRoots: string[] = []

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "opencode-digital-pet-config-"))
  tempRoots.push(root)
  return root
}

const resolveConfigPath = (root: string): string => join(root, ".config", "opencode-digital-pet.json")

const createConfigDirectory = async (root: string): Promise<string> => {
  const directory = join(root, ".config")
  await mkdir(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("global Digital Pet configuration paths", () => {
  test("existing legacy configuration remains readable until a new configuration is created", async () => {
    const root = await createTempRoot()
    const directory = await createConfigDirectory(root)
    const legacyPath = join(directory, "opencode-vpet.json")
    await writeFile(legacyPath, JSON.stringify({ language: "jp" }))
    expect(resolveGlobalDigitalPetConfigPath({ home: root, platform: "linux" })).toBe(legacyPath)
    expect(loadGlobalDigitalPetSettingsSync({ home: root, platform: "linux" }).language).toBe("jp")
    await writeFile(resolveConfigPath(root), JSON.stringify({ language: "en" }))
    expect(resolveGlobalDigitalPetConfigPath({ home: root, platform: "linux" })).toBe(resolveConfigPath(root))
  })

  test.each([
    ["Linux", "linux", "/home/na me/雪", "/home/na me/雪/.config/opencode-digital-pet.json"],
    ["macOS", "darwin", "/Users/na me/雪", "/Users/na me/雪/.config/opencode-digital-pet.json"],
    ["WSL", "linux", "/home/na me/雪", "/home/na me/雪/.config/opencode-digital-pet.json"],
  ] as const)(
    "Given %s with OpenCode and XDG variables When resolving with path.posix Then it uses the independent Digital Pet path",
    (_name, platform, home, expected) => {
      expect(
        resolveGlobalDigitalPetConfigPath({
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
      "C:\\App Data\\雪\\opencode-digital-pet.json",
    ],
    [
      "home fallback",
      { OPENCODE_CONFIG_DIR: "C:\\OpenCode\\雪", XDG_CONFIG_HOME: "C:\\XDG\\雪" },
      "C:\\Users\\na me\\雪",
      "C:\\Users\\na me\\雪\\AppData\\Roaming\\opencode-digital-pet.json",
    ],
  ] as const)(
    "Given native Windows with %s When resolving with path.win32 Then it uses the independent Digital Pet path",
    (_name, env, home, expected) => {
      expect(resolveGlobalDigitalPetConfigPath({ env, home, pathApi: win32, platform: "win32" })).toBe(expected)
    },
  )

  test.each([
    ["missing", async (_root: string): Promise<void> => undefined],
    [
      "unreadable directory",
      async (root: string): Promise<void> => {
        await mkdir(resolveConfigPath(root), { recursive: true })
      },
    ],
    [
      "malformed",
      async (root: string): Promise<void> => {
        await createConfigDirectory(root)
        await writeFile(resolveConfigPath(root), "{")
      },
    ],
    [
      "scalar root",
      async (root: string): Promise<void> => {
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

      const settings = loadGlobalDigitalPetSettingsSync({
        home: root,
        pathApi: posix,
      })

      expect(settings).toEqual(DEFAULT_DIGITAL_PET_SETTINGS)
      expect(await readdir(root)).toEqual(entriesBefore)
    },
  )
})

describe("global Digital Pet configuration loading", () => {
  test("Given a valid file with mixed settings When loading asynchronously Then valid siblings survive in a frozen snapshot", async () => {
    const root = await createTempRoot()
    await createConfigDirectory(root)
    await writeFile(
      resolveConfigPath(root),
      JSON.stringify({ language: "en", notifications: false, stageThresholds: { child: 777, egg: 0 } }),
    )

    const settings = await loadGlobalDigitalPetSettings({
      home: root,
      pathApi: posix,
    })

    expect(settings).toEqual({
      ...DEFAULT_DIGITAL_PET_SETTINGS,
      language: "en",
      notifications: false,
      stageThresholds: { ...DEFAULT_DIGITAL_PET_SETTINGS.stageThresholds, child: 777 },
    })
    expect(Object.isFrozen(settings)).toBeTrue()
    expect(Object.isFrozen(settings.stageThresholds)).toBeTrue()
  })

  test("Given a valid file When loading synchronously Then it returns an immutable normalized snapshot", async () => {
    const root = await createTempRoot()
    await createConfigDirectory(root)
    await writeFile(resolveConfigPath(root), JSON.stringify({ stageThresholds: { adult: 999 } }))

    const settings = loadGlobalDigitalPetSettingsSync({ home: root, pathApi: posix })

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

      expect((await loadGlobalDigitalPetSettings({ home: root, pathApi: posix })).notifications).toBeTrue()
      expect(loadGlobalDigitalPetSettingsSync({ home: root, pathApi: posix }).notifications).toBeTrue()
    },
  )

  test.each([
    ["missing", async (_root: string): Promise<void> => undefined],
    [
      "unreadable directory",
      async (root: string): Promise<void> => {
        await mkdir(resolveConfigPath(root), { recursive: true })
      },
    ],
    [
      "malformed",
      async (root: string): Promise<void> => {
        await createConfigDirectory(root)
        await writeFile(resolveConfigPath(root), "{")
      },
    ],
    [
      "scalar root",
      async (root: string): Promise<void> => {
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

      const settings = await loadGlobalDigitalPetSettings({
        home: root,
        pathApi: posix,
      })

      expect(settings).toEqual(DEFAULT_DIGITAL_PET_SETTINGS)
      expect(await readdir(root)).toEqual(entriesBefore)
    },
  )
})
