import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { createDatabaseChangeWatcher } from "../src/adapters/sqlite/database-change-watcher.ts"

const wait = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

describe("database change watcher", () => {
  let tempRoot: string | undefined
  let watcher: ReturnType<typeof createDatabaseChangeWatcher> | undefined

  afterEach(async () => {
    watcher?.dispose()
    watcher = undefined
    if (tempRoot !== undefined) {
      await rm(tempRoot, { recursive: true, force: true })
      tempRoot = undefined
    }
  })

  test("Given a pet.db write When watching the data directory Then onChange fires once after debounce", async () => {
    tempRoot = await mkdtemp(join(process.cwd(), ".tmp-cursor-vpet-watch-"))
    const appDataRoot = join(tempRoot, "app-data")
    const databasePath = join(appDataRoot, "opencode-vpet", "pet.db")
    await mkdir(dirname(databasePath), { recursive: true })

    let changeCount = 0
    watcher = createDatabaseChangeWatcher({
      appDataRoot,
      databasePath,
      debounceMs: 80,
      onChange: () => {
        changeCount += 1
      },
    })

    await writeFile(databasePath, "first")
    await wait(200)
    expect(changeCount).toBe(1)

    await writeFile(databasePath, "second")
    await wait(200)
    expect(changeCount).toBe(2)
  })

  test("Given rapid pet.db writes When watching Then onChange coalesces into one debounced callback", async () => {
    tempRoot = await mkdtemp(join(process.cwd(), ".tmp-cursor-vpet-watch-"))
    const appDataRoot = join(tempRoot, "app-data")
    const databasePath = join(appDataRoot, "opencode-vpet", "pet.db")
    await mkdir(dirname(databasePath), { recursive: true })

    let changeCount = 0
    watcher = createDatabaseChangeWatcher({
      appDataRoot,
      databasePath,
      debounceMs: 120,
      onChange: () => {
        changeCount += 1
      },
    })

    await writeFile(databasePath, "a")
    await wait(20)
    await writeFile(databasePath, "b")
    await wait(20)
    await writeFile(databasePath, "c")
    await wait(200)

    expect(changeCount).toBe(1)
  })

  test("Given another file in the data directory When it changes Then onChange is not called", async () => {
    tempRoot = await mkdtemp(join(process.cwd(), ".tmp-cursor-vpet-watch-"))
    const appDataRoot = join(tempRoot, "app-data")
    const databasePath = join(appDataRoot, "opencode-vpet", "pet.db")
    const otherPath = join(appDataRoot, "opencode-vpet", "notes.txt")
    await mkdir(dirname(databasePath), { recursive: true })

    let changeCount = 0
    watcher = createDatabaseChangeWatcher({
      appDataRoot,
      databasePath,
      debounceMs: 80,
      onChange: () => {
        changeCount += 1
      },
    })

    await writeFile(otherPath, "ignore me")
    await wait(200)
    expect(changeCount).toBe(0)
  })

  test("Given a disposed watcher When pet.db changes Then onChange is not called", async () => {
    tempRoot = await mkdtemp(join(process.cwd(), ".tmp-cursor-vpet-watch-"))
    const appDataRoot = join(tempRoot, "app-data")
    const databasePath = join(appDataRoot, "opencode-vpet", "pet.db")
    await mkdir(dirname(databasePath), { recursive: true })

    let changeCount = 0
    watcher = createDatabaseChangeWatcher({
      appDataRoot,
      databasePath,
      debounceMs: 80,
      onChange: () => {
        changeCount += 1
      },
    })
    watcher.dispose()
    watcher = undefined

    await writeFile(databasePath, "after-dispose")
    await wait(200)
    expect(changeCount).toBe(0)
  })
})
