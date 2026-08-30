import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"

import { openReadonlyDatabase, openWritableDatabase } from "../../src/adapters/sqlite/bun-sqlite-driver.ts"
import { createSqliteVpetRepository } from "../../src/adapters/sqlite/sqlite-vpet-write-store.ts"
import { isBunSqliteAvailable } from "../sqlite-capability.ts"

type TempTestRoot = {
  readonly root: string
  readonly appDataRoot: string
}

type ControlState = {
  readonly frozen: number
  readonly cheat_node_id: string | null
}

type SpawnControlCase = {
  readonly name: string
  readonly freeze: boolean
  readonly cheatNodeId: string | null
}

const SPAWNED_AT = "2026-07-30T12:00:00.000Z"

const spawn = (repository: Awaited<ReturnType<typeof createSqliteVpetRepository>>, createdAt = SPAWNED_AT) =>
  repository.spawnPartner({
    currentNodeId: "0-001",
    gauge: 0,
    isTerminal: false,
    createdAt,
  })

const getControlState = (databasePath: string): ControlState => {
  const database = openReadonlyDatabase(databasePath)

  try {
    const controlState = database
      .query<ControlState, []>("SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1")
      .get()
    if (controlState === null) throw new Error("Expected singleton VPet control state")
    return controlState
  } finally {
    database.close()
  }
}

const spawnControlCases: SpawnControlCase[] = [
  { name: "normal", freeze: false, cheatNodeId: null },
  { name: "frozen", freeze: true, cheatNodeId: null },
  { name: "cheat", freeze: false, cheatNodeId: "6-001" },
  { name: "frozen and cheat", freeze: true, cheatNodeId: "6-001" },
]

describe.if(isBunSqliteAvailable)("sqlite vpet control persistence", () => {
  let tempRoot: TempTestRoot

  beforeEach(async () => {
    const root = await mkdtemp(join(process.cwd(), ".tmp-vpet-control-"))
    const appDataRoot = join(root, "app-data")
    await mkdir(appDataRoot, { recursive: true })
    tempRoot = { root, appDataRoot }
  })

  afterEach(async () => {
    await rm(tempRoot.root, { recursive: true, force: true })
  })

  test("Given SQLite control state When freeze and unfreeze repeat Then each single-row transition is idempotent and unfreeze preserves cheat", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })

    try {
      expect(repository.freeze()).toEqual({ kind: "frozen" })
      expect(repository.freeze()).toEqual({ kind: "already_frozen" })
      expect(repository.setCheatNode("3-001")).toEqual({ kind: "set", cheatNodeId: "3-001" })
      expect(repository.unfreeze()).toEqual({ kind: "unfrozen" })
      expect(repository.unfreeze()).toEqual({ kind: "already_unfrozen" })
      expect(getControlState(repository.databasePath)).toEqual({ frozen: 0, cheat_node_id: "3-001" })
    } finally {
      await repository.close()
    }
  })

  test("Given no active partner When cheat is set to the same and different IDs Then only the cheat control changes with typed idempotent outcomes", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })

    try {
      expect(repository.setCheatNode("2-001")).toEqual({ kind: "set", cheatNodeId: "2-001" })
      expect(repository.setCheatNode("2-001")).toEqual({ kind: "already_set", cheatNodeId: "2-001" })
      expect(repository.setCheatNode("3-001")).toEqual({ kind: "set", cheatNodeId: "3-001" })
      expect(repository.getActivePartner()).toBeNull()
      expect(getControlState(repository.databasePath)).toEqual({ frozen: 0, cheat_node_id: "3-001" })
    } finally {
      await repository.close()
    }
  })

  test("Given coexisting frozen and cheat controls When the repository reopens Then both values persist and set preserves freeze", async () => {
    const databasePath = join(tempRoot.root, "control-reopen.db")
    const repository = await createSqliteVpetRepository({ databasePath })

    try {
      expect(repository.freeze()).toEqual({ kind: "frozen" })
      expect(repository.setCheatNode("3-001")).toEqual({ kind: "set", cheatNodeId: "3-001" })
    } finally {
      await repository.close()
    }

    const reopenedRepository = await createSqliteVpetRepository({ databasePath })

    try {
      expect(getControlState(databasePath)).toEqual({ frozen: 1, cheat_node_id: "3-001" })
      expect(reopenedRepository.setCheatNode("4-001")).toEqual({ kind: "set", cheatNodeId: "4-001" })
      expect(getControlState(databasePath)).toEqual({ frozen: 1, cheat_node_id: "4-001" })
    } finally {
      await reopenedRepository.close()
    }
  })

  test.each(spawnControlCases)(
    "Given $name controls When a replacement spawns Then it resets controls and creates the next egg atomically",
    async ({ freeze, cheatNodeId }) => {
      const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })

      try {
        const firstPartner = spawn(repository)
        if (freeze) repository.freeze()
        if (cheatNodeId !== null) repository.setCheatNode(cheatNodeId)

        const nextPartner = spawn(repository, "2026-07-30T12:10:00.000Z")

        expect(nextPartner).toMatchObject({ generation: 2, currentNodeId: "0-001", gauge: 0, isTerminal: false })
        expect(repository.getActivePartner()).toEqual(nextPartner)
        expect(repository.getPartnerByGeneration(firstPartner.generation)).toMatchObject({
          retiredAt: "2026-07-30T12:10:00.000Z",
        })
        expect(getControlState(repository.databasePath)).toEqual({ frozen: 0, cheat_node_id: null })
      } finally {
        await repository.close()
      }
    },
  )

  test("Given frozen and cheat controls When the egg insert fails after spawn reset Then the immediate transaction restores controls and the active partner", async () => {
    const repository = await createSqliteVpetRepository({ appDataRoot: tempRoot.appDataRoot })

    try {
      const firstPartner = spawn(repository)
      repository.freeze()
      repository.setCheatNode("6-001")
      const database = openWritableDatabase(repository.databasePath)
      database.run(
        "CREATE TRIGGER fail_spawn_egg BEFORE INSERT ON partners WHEN NEW.generation > 1 BEGIN SELECT RAISE(FAIL, 'egg insert failed'); END",
      )
      database.close()

      expect(() => spawn(repository, "2026-07-30T12:10:00.000Z")).toThrow("egg insert failed")
      expect(getControlState(repository.databasePath)).toEqual({ frozen: 1, cheat_node_id: "6-001" })
      expect(repository.getActivePartner()).toEqual(firstPartner)
    } finally {
      await repository.close()
    }
  })
})
