import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"

import { spawnPartner } from "@sbugallo/vpet-core/application/use-cases/spawn-partner.ts"
import { readSidebarSnapshot } from "../../src/adapters/sqlite/sqlite-sidebar-snapshot-reader.ts"
import { createSqliteVpetRepository } from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"

type TempTestRoot = { readonly root: string; readonly appDataRoot: string }

let tempRoot: TempTestRoot | undefined

const createTempTestRoot = async (): Promise<TempTestRoot> => {
  const root = await mkdtemp(join(process.cwd(), ".tmp-cursor-vpet-persistence-"))
  const appDataRoot = join(root, "app-data")
  await mkdir(appDataRoot, { recursive: true })
  return { root, appDataRoot }
}

beforeEach(async () => {
  tempRoot = await createTempTestRoot()
})

afterEach(async () => {
  if (tempRoot === undefined) return
  await rm(tempRoot.root, { recursive: true, force: true })
  tempRoot = undefined
})

describe("sql.js vpet repository persistence", () => {
  test("Given a spawned partner When reading the sidebar snapshot Then it returns the active partner", async () => {
    if (tempRoot === undefined) throw new Error("Missing temp root.")

    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })
    try {
      spawnPartner(repository, "2026-09-09T12:00:00.000Z")
      const snapshot = await readSidebarSnapshot({ appDataRoot: tempRoot.appDataRoot })
      expect(snapshot?.currentNodeId).toBe("0-001")
      expect(snapshot?.frozen).toBe(false)
    } finally {
      repository.close()
    }
  })
})
