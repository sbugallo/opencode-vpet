import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  FORBIDDEN_ADAPTER_IMPORTS,
  FORBIDDEN_DOMAIN_IMPORTS,
  FORBIDDEN_LEGACY_IMPORTS,
  FORBIDDEN_SERVER_HOOK_IMPORTS,
  FORBIDDEN_TUI_ANIMATION_IMPORTS,
  PROJECT_ROOT,
  TUI_PRIVATE_ANIMATION_MODULES,
  findForbiddenImports,
  scanForbiddenImports,
  scanTuiPresentationImports,
} from "./architecture-boundary-helpers.ts"

describe("hexagonal dependency direction", () => {
  test("Given domain fixtures importing data, config, application, and frameworks When scanned Then each exact violation is reported", async () => {
    const directory = await mkdtemp(join(tmpdir(), "opencode-vpet-domain-architecture-"))
    const fixtures = [
      ["data.ts", 'import type { DigimonCatalog } from "../data/catalog.ts"\n'],
      ["config.ts", 'import type { ResolvedVpetSettings } from "../config/types.ts"\n'],
      ["application.ts", 'import type { Partner } from "../application/models/partner.ts"\n'],
      ["framework.ts", 'import type { Plugin } from "@opencode-ai/plugin"\n'],
    ] as const
    try {
      await Promise.all(fixtures.map(async ([name, source]) => writeFile(join(directory, name), source)))
      expect(await scanForbiddenImports(directory, FORBIDDEN_DOMAIN_IMPORTS)).toEqual([
        `${join(directory, "application.ts")}: ../application/models/partner.ts`,
        `${join(directory, "config.ts")}: ../config/types.ts`,
        `${join(directory, "data.ts")}: ../data/catalog.ts`,
        `${join(directory, "framework.ts")}: @opencode-ai/plugin`,
      ])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
    expect(await Bun.file(directory).exists()).toBeFalse()
  })
  test("Given the domain source tree When scanned Then it has no forbidden dependencies", async () =>
    expect(await scanForbiddenImports(join(PROJECT_ROOT, "src", "domain"), FORBIDDEN_DOMAIN_IMPORTS)).toEqual([]))
  test("Given the inner TUI source tree When scanned Then it has no persistence or SQLite dependencies", async () =>
    expect(await scanTuiPresentationImports(join(PROJECT_ROOT, "src", "tui"))).toEqual([]))
  test("Given animation policy and mirror modules When scanned Then they remain TUI-private without domain, application, or SQLite dependencies", async () => {
    const paths = TUI_PRIVATE_ANIMATION_MODULES.map((module) => join(PROJECT_ROOT, "src", "tui", module))
    expect(await Promise.all(paths.map((path) => Bun.file(path).exists()))).toEqual([true, true, true, true])
    expect(
      await Promise.all(
        paths.map(async (path) =>
          findForbiddenImports(path, await readFile(path, "utf8"), FORBIDDEN_TUI_ANIMATION_IMPORTS),
        ),
      ),
    ).toEqual([[], [], [], []])
  })
  test("Given inner TUI fixtures importing raw config and SQLite When scanned Then both violations are reported", async () => {
    const directory = await mkdtemp(join(tmpdir(), "opencode-vpet-tui-architecture-"))
    const fixtures = [
      ["config.ts", 'import { loadGlobalVpetSettings } from "../config/global-vpet-settings.ts"\n'],
      ["sqlite.ts", 'import { Database } from "bun:sqlite"\n'],
    ] as const
    try {
      await Promise.all(fixtures.map(async ([name, source]) => writeFile(join(directory, name), source)))
      expect(await scanTuiPresentationImports(directory)).toEqual([
        `${join(directory, "config.ts")}: ../config/global-vpet-settings.ts`,
        `${join(directory, "sqlite.ts")}: bun:sqlite`,
      ])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
    expect(await Bun.file(directory).exists()).toBeFalse()
  })
  test("Given the adapter source tree When scanned Then it points inward", async () =>
    expect(await scanForbiddenImports(join(PROJECT_ROOT, "src", "adapters"), FORBIDDEN_ADAPTER_IMPORTS)).toEqual([]))
  test("Given production sources When scanned Then no import references a removed legacy seam", async () =>
    expect(await scanForbiddenImports(join(PROJECT_ROOT, "src"), FORBIDDEN_LEGACY_IMPORTS)).toEqual([]))
  test("Given composition roots When scanned Then they avoid removed legacy seams", async () => {
    const roots = [join(PROJECT_ROOT, "src", "index.ts"), join(PROJECT_ROOT, "src", "tui.tsx")]
    const violations = await Promise.all(
      roots.map(async (path) => findForbiddenImports(path, await readFile(path, "utf8"), FORBIDDEN_LEGACY_IMPORTS)),
    )
    expect(violations.flat()).toEqual([])
  })
  test("Given the server hook composition When scanned Then it has no SQLite or application lifecycle port dependency", async () => {
    const hook = join(PROJECT_ROOT, "src", "adapters", "opencode", "create-server-hooks.ts")
    expect(
      await Bun.file(join(PROJECT_ROOT, "src", "application", "ports", "resource-lifecycle.ts")).exists(),
    ).toBeFalse()
    expect(findForbiddenImports(hook, await readFile(hook, "utf8"), FORBIDDEN_SERVER_HOOK_IMPORTS)).toEqual([])
  })
})
