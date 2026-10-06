import { describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  FORBIDDEN_PRESENTATION_IMPORTS,
  FORBIDDEN_SHARED_IMPORTS,
  findForbiddenImports,
  scanForbiddenImports,
  scanPresentationImports,
  scanSharedImports,
} from "./architecture-boundary-helpers.ts"

describe("cursor-digital-pet architecture boundary fixtures", () => {
  test("Given presentation source importing vscode When scanned Then it is rejected", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cursor-digital-pet-presentation-"))
    const path = join(directory, "forbidden.ts")
    try {
      await writeFile(path, 'import * as vscode from "vscode"\n')
      expect(await scanPresentationImports(directory)).toEqual([`${path}: vscode`])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("Given presentation source importing sqlite adapters When scanned Then it is rejected", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cursor-digital-pet-presentation-"))
    const path = join(directory, "forbidden.ts")
    try {
      await writeFile(path, 'import { openReadonlySqliteDatabase } from "../../adapters/sqlite/sqlite-driver.ts"\n')
      expect(await scanPresentationImports(directory)).toEqual([`${path}: ../../adapters/sqlite/sqlite-driver.ts`])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("Given shared source importing vscode When scanned Then it is rejected", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cursor-digital-pet-shared-"))
    const path = join(directory, "forbidden.ts")
    try {
      await writeFile(path, 'import * as vscode from "vscode"\n')
      expect(await scanSharedImports(directory)).toEqual([`${path}: vscode`])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("Given malformed source When scanned Then valid imports are still found", () =>
    expect(
      findForbiddenImports("malformed.ts", 'import { broken\nimport "vscode"\n', FORBIDDEN_SHARED_IMPORTS),
    ).toEqual(["malformed.ts: vscode"]))

  test("Given sqlite adapter fixtures importing vscode When scanned Then violations are reported", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cursor-digital-pet-sqlite-"))
    const path = join(directory, "forbidden.ts")
    try {
      await writeFile(path, 'import * as vscode from "vscode"\n')
      expect(await scanForbiddenImports(directory, ["vscode"])).toEqual([`${path}: vscode`])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("Given presentation fixtures importing sidebar modules When scanned Then violations are reported", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cursor-digital-pet-presentation-sidebar-"))
    const path = join(directory, "forbidden.ts")
    try {
      await writeFile(path, 'import { buildSidebarPresentation } from "../webview/sidebar/sidebar-presenter.ts"\n')
      expect(await scanForbiddenImports(directory, FORBIDDEN_PRESENTATION_IMPORTS)).toEqual([
        `${path}: ../webview/sidebar/sidebar-presenter.ts`,
      ])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
