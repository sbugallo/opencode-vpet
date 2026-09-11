import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { join } from "node:path"

import { spawnPartner } from "@sbugallo/vpet-core/application/use-cases/spawn-partner.ts"

import { readArchive } from "../../src/adapters/sqlite/sqlite-vpet-archive-reader.ts"
import { createSqliteVpetRepository } from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { applyTokenUsage, createTempTestRoot, removeTempTestRoot, type TempTestRoot } from "./persistence-fixtures.ts"

let tempRoot: TempTestRoot | undefined

beforeEach(async () => {
  tempRoot = await createTempTestRoot()
})

afterEach(async () => {
  if (tempRoot === undefined) return
  await removeTempTestRoot(tempRoot)
  tempRoot = undefined
})

describe("sql.js vpet archive reader persistence", () => {
  test("Given no database file When reading an archive Then it returns empty", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const databasePath = join(tempRoot.appDataRoot, "missing", "pet.db")
    expect(await readArchive({ databasePath })).toEqual({ kind: "empty" })
  })

  test("Given a spawned partner with usage events When reading an archive Then partners and events are available", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      applyTokenUsage(repository, "receipt-archive", 9)

      const archive = await readArchive({ appDataRoot: tempRoot.appDataRoot })
      expect(archive.kind).toBe("available")
      if (archive.kind !== "available") return

      expect(archive.partners).toHaveLength(1)
      expect(archive.partners[0]?.generation).toBe(1)
      expect(archive.partners[0]?.events.length).toBeGreaterThan(0)
      expect(archive.partners[0]?.events.some((event) => event.currentNodeId === "0-001")).toBe(true)
    } finally {
      repository.close()
    }
  })
})
