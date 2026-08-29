import { describe, expect, test } from "bun:test"
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { normalizeOpenCodeConfigs } from "../src/cli/config.ts"

const createRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "opencode-vpet-cli-"))

describe("OpenCode CLI configuration", () => {
  test("Given legacy and duplicate plugin entries When init normalizes global JSONC configs Then it preserves unrelated content and registers one scoped plugin per root", async () => {
    const root = await createRoot()
    const configDirectory = join(root, "opencode")
    const serverPath = join(configDirectory, "opencode.jsonc")
    const tuiPath = join(configDirectory, "tui.json")
    try {
      await mkdir(configDirectory, { recursive: true })
      await writeFile(
        serverPath,
        '{\n  // keep this comment\n  "theme": "night",\n  "plugin": ["opencode-vpet", "@sbugallo/opencode-vpet", "@sbugallo/opencode-vpet"]\n}\n',
      )
      await writeFile(tuiPath, '{"plugin":["opencode-vpet"],"keymap":"vim"}\n')

      const result = await normalizeOpenCodeConfigs({
        env: { OPENCODE_CONFIG_DIR: configDirectory },
      })

      expect(result.changedPaths).toEqual([serverPath, tuiPath])
      expect(await readFile(serverPath, "utf8")).toContain("// keep this comment")
      expect(await readFile(serverPath, "utf8")).toContain('"theme": "night"')
      expect(await readFile(serverPath, "utf8")).toContain('"plugin": [\n    "@sbugallo/opencode-vpet"\n  ]')
      expect(await readFile(tuiPath, "utf8")).toContain('[\n    "@sbugallo/opencode-vpet"\n  ]')
      expect(await readFile(tuiPath, "utf8")).toContain('"keymap":"vim"')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given a malformed TUI config When init plans both global changes Then neither configuration is written", async () => {
    const root = await createRoot()
    const serverPath = join(root, "server.json")
    const tuiPath = join(root, "tui.json")
    const serverSource = '{"plugin":["opencode-vpet"]}\n'
    try {
      await writeFile(serverPath, serverSource)
      await writeFile(tuiPath, "{ invalid")

      await expect(
        normalizeOpenCodeConfigs({ env: { OPENCODE_CONFIG: serverPath, OPENCODE_TUI_CONFIG: tuiPath } }),
      ).rejects.toThrow("Cannot parse OpenCode configuration")

      expect(await readFile(serverPath, "utf8")).toBe(serverSource)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given a non-array plugin property When init plans both global changes Then it rejects the malformed config without writing either file", async () => {
    const root = await createRoot()
    const serverPath = join(root, "server.json")
    const tuiPath = join(root, "tui.json")
    const serverSource = '{"plugin":"opencode-vpet"}\n'
    const tuiSource = '{"plugin":["opencode-vpet"]}\n'
    try {
      await writeFile(serverPath, serverSource)
      await writeFile(tuiPath, tuiSource)

      await expect(
        normalizeOpenCodeConfigs({ env: { OPENCODE_CONFIG: serverPath, OPENCODE_TUI_CONFIG: tuiPath } }),
      ).rejects.toThrow("OpenCode plugin configuration must be an array")

      expect(await readFile(serverPath, "utf8")).toBe(serverSource)
      expect(await readFile(tuiPath, "utf8")).toBe(tuiSource)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given whitespace environment overrides When init resolves config paths Then it uses the non-empty config directory", async () => {
    const root = await createRoot()
    const configDirectory = join(root, ".config", "opencode")
    try {
      const result = await normalizeOpenCodeConfigs({
        dryRun: true,
        env: {
          OPENCODE_CONFIG: " ",
          OPENCODE_CONFIG_DIR: "\t",
          OPENCODE_TUI_CONFIG: "\n",
          XDG_CONFIG_HOME: "  ",
        },
        home: root,
      })

      expect(result.changedPaths).toEqual([join(configDirectory, "opencode.json"), join(configDirectory, "tui.json")])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given empty global config paths When update runs in dry-run mode Then it plans canonical entries without creating files", async () => {
    const root = await createRoot()
    const configDirectory = join(root, "opencode")
    try {
      const result = await normalizeOpenCodeConfigs({
        dryRun: true,
        env: { OPENCODE_CONFIG_DIR: configDirectory },
      })

      expect(result.changedPaths).toEqual([join(configDirectory, "opencode.json"), join(configDirectory, "tui.json")])
      expect(
        (await Promise.all(result.changedPaths.map((path) => Bun.file(path).exists()))).every((exists) => !exists),
      ).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given existing and new config files When init writes them Then existing modes are preserved and new files are owner-only", async () => {
    const root = await createRoot()
    const serverPath = join(root, "server.json")
    const tuiPath = join(root, "tui.json")
    try {
      await writeFile(serverPath, '{"plugin":["opencode-vpet"]}\n')
      await chmod(serverPath, 0o600)

      await normalizeOpenCodeConfigs({ env: { OPENCODE_CONFIG: serverPath, OPENCODE_TUI_CONFIG: tuiPath } })

      expect((await stat(serverPath)).mode & 0o777).toBe(0o600)
      expect((await stat(tuiPath)).mode & 0o777).toBe(0o600)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("Given a symlinked explicit config When init writes it Then it atomically updates the selected target without replacing the symlink", async () => {
    const root = await createRoot()
    const targetPath = join(root, "server-target.json")
    const serverPath = join(root, "server.json")
    const tuiPath = join(root, "tui.json")
    try {
      await writeFile(targetPath, '{"plugin":["opencode-vpet"]}\n')
      await symlink(targetPath, serverPath)

      await normalizeOpenCodeConfigs({ env: { OPENCODE_CONFIG: serverPath, OPENCODE_TUI_CONFIG: tuiPath } })

      expect((await lstat(serverPath)).isSymbolicLink()).toBe(true)
      expect(await readFile(targetPath, "utf8")).toContain('"@sbugallo/opencode-vpet"')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
