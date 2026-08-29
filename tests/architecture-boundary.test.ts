import { describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  FORBIDDEN_APPLICATION_IMPORTS,
  PROJECT_ROOT,
  findForbiddenImports,
  scanApplicationImports,
  scanDuplicateCorePartnerDeclarations,
  scanTechnicalLifecyclePorts,
  scanTuiPresentationImports,
} from "./architecture-boundary-helpers.ts"

const assertRemoved = async (path: string): Promise<void> => expect(await Bun.file(path).exists()).toBeFalse()

describe("application architecture boundary", () => {
  test("Given an application source importing a SQLite adapter When scanned Then its path and forbidden import are reported", async () => {
    const directory = await mkdtemp(join(tmpdir(), "opencode-vpet-architecture-"))
    const path = join(directory, "forbidden.ts")
    try {
      await writeFile(path, 'import { openWritableDatabase } from "../adapters/sqlite/bun-sqlite-driver.ts"\n')
      expect(await scanApplicationImports(directory)).toEqual([`${path}: ../adapters/sqlite/bun-sqlite-driver.ts`])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
    await assertRemoved(path)
  })
  test("Given an application source importing a SQLite write-store type When scanned Then its type-only import is reported", async () => {
    const directory = await mkdtemp(join(tmpdir(), "opencode-vpet-architecture-"))
    const path = join(directory, "forbidden.ts")
    try {
      await writeFile(path, 'import type { SqliteVpetWriteStore } from "../adapters/sqlite/sqlite-vpet-types.ts"\n')
      expect(await scanApplicationImports(directory)).toEqual([`${path}: ../adapters/sqlite/sqlite-vpet-types.ts`])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
    await assertRemoved(path)
  })
  test("Given application fixtures importing filesystem, adapters, and frameworks When scanned Then each forbidden boundary import is reported", async () => {
    const directory = await mkdtemp(join(tmpdir(), "opencode-vpet-application-architecture-"))
    const fixtures = [
      ["filesystem.ts", 'import { readFile } from "node:fs"\n'],
      ["framework.ts", 'import type { Plugin } from "@opencode-ai/plugin"\n'],
      ["sqlite.ts", 'import { Database } from "bun:sqlite"\n'],
    ] as const
    try {
      await Promise.all(fixtures.map(async ([name, source]) => writeFile(join(directory, name), source)))
      expect(await scanApplicationImports(directory)).toEqual([
        `${join(directory, "filesystem.ts")}: node:fs`,
        `${join(directory, "framework.ts")}: @opencode-ai/plugin`,
        `${join(directory, "sqlite.ts")}: bun:sqlite`,
      ])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
    await assertRemoved(directory)
  })
  test("Given a fixture redeclaring Partner core state When scanned Then it is rejected", async () => {
    const directory = await mkdtemp(join(tmpdir(), "opencode-vpet-partner-contract-"))
    const path = join(directory, "duplicate.ts")
    try {
      await writeFile(
        path,
        "export type Partner = { partnerId: string; generation: number; currentNodeId: string; gauge: number; isTerminal: boolean; createdAt: string; retiredAt: string | null }\n",
      )
      expect(await scanDuplicateCorePartnerDeclarations(directory)).toEqual([`${path}: duplicate Partner core state`])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
    await assertRemoved(path)
  })
  test("Given an application port declaring technical resource shutdown When scanned Then it is rejected", async () => {
    const directory = await mkdtemp(join(tmpdir(), "opencode-vpet-lifecycle-port-"))
    const path = join(directory, "resource-lifecycle.ts")
    try {
      await writeFile(path, "export type ResourceLifecycle = { close: () => Promise<void> }\n")
      expect(await scanTechnicalLifecyclePorts(directory)).toEqual([`${path}: technical lifecycle port`])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
    await assertRemoved(path)
  })
  test("Given a TUI presentation source importing a SQLite schema When scanned Then it is rejected", async () => {
    const directory = await mkdtemp(join(tmpdir(), "opencode-vpet-architecture-"))
    const path = join(directory, "forbidden.ts")
    try {
      await writeFile(path, 'import { ACTIVE_PARTNER_SELECT } from "../adapters/sqlite/sqlite-vpet-schema.ts"\n')
      expect(await scanTuiPresentationImports(directory)).toEqual([`${path}: ../adapters/sqlite/sqlite-vpet-schema.ts`])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
    await assertRemoved(path)
  })
  test("Given malformed application source When scanned Then valid imports are still found", () =>
    expect(
      findForbiddenImports("malformed.ts", 'import { broken\nimport "bun:sqlite"\n', FORBIDDEN_APPLICATION_IMPORTS),
    ).toEqual(["malformed.ts: bun:sqlite"]))
  test("Given the application source tree When scanned Then it contains no forbidden imports", async () =>
    expect(await scanApplicationImports(join(PROJECT_ROOT, "src", "application"))).toEqual([]))
  test("Given the application models When scanned Then they do not redeclare Partner core state", async () =>
    expect(await scanDuplicateCorePartnerDeclarations(join(PROJECT_ROOT, "src", "application", "models"))).toEqual([]))
  test("Given the application port tree When scanned Then it has no technical lifecycle contract", async () =>
    expect(await scanTechnicalLifecyclePorts(join(PROJECT_ROOT, "src", "application", "ports"))).toEqual([]))
})
