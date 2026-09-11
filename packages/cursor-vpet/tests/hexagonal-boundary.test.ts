import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import {
  FORBIDDEN_CURSOR_ADAPTER_IMPORTS,
  FORBIDDEN_SQLITE_ADAPTER_IMPORTS,
  FORBIDDEN_VSCODE_ADAPTER_IMPORTS,
  PROJECT_ROOT,
  findForbiddenImports,
  scanForbiddenImports,
  scanPresentationImports,
  scanSharedImports,
  scanSidebarImports,
} from "./architecture-boundary-helpers.ts"

describe("cursor-vpet hexagonal dependency direction", () => {
  test("Given the presentation source tree When scanned Then it has no forbidden dependencies", async () =>
    expect(await scanPresentationImports(join(PROJECT_ROOT, "src", "webview", "presentation"))).toEqual([]))

  test("Given the shared source tree When scanned Then it has no forbidden dependencies", async () =>
    expect(await scanSharedImports(join(PROJECT_ROOT, "src", "shared"))).toEqual([]))

  test("Given the sqlite adapter tree When scanned Then it has no vscode dependency", async () =>
    expect(
      await scanForbiddenImports(join(PROJECT_ROOT, "src", "adapters", "sqlite"), FORBIDDEN_SQLITE_ADAPTER_IMPORTS),
    ).toEqual([]))

  test("Given the vscode adapter tree When scanned Then it points inward", async () =>
    expect(
      await scanForbiddenImports(join(PROJECT_ROOT, "src", "adapters", "vscode"), FORBIDDEN_VSCODE_ADAPTER_IMPORTS),
    ).toEqual([]))

  test("Given the cursor adapter tree When scanned Then it has no webview or vscode dependency", async () =>
    expect(
      await scanForbiddenImports(join(PROJECT_ROOT, "src", "adapters", "cursor"), FORBIDDEN_CURSOR_ADAPTER_IMPORTS),
    ).toEqual([]))

  test("Given the sidebar source tree When scanned Then only provider imports vscode", async () =>
    expect(await scanSidebarImports(join(PROJECT_ROOT, "src", "webview", "sidebar"))).toEqual([]))

  test("Given sidebar presenter When scanned Then it remains free of adapter imports", async () => {
    const path = join(PROJECT_ROOT, "src", "webview", "sidebar", "sidebar-presenter.ts")
    expect(findForbiddenImports(path, await readFile(path, "utf8"), ["/adapters/", "vscode"])).toEqual([])
  })

  test("Given extension composition When scanned Then it wires the usage pipeline", async () => {
    const path = join(PROJECT_ROOT, "src", "extension.ts")
    const source = await readFile(path, "utf8")
    expect(source.includes("application/usage-pipeline")).toBe(true)
  })
})
