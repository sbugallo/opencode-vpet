import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { createDatabaseChangeWatcher, type WatchDirectory } from "../src/adapters/sqlite/database-change-watcher.ts"

const wait = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const waitForChangeCount = async (count: () => number, expected: number): Promise<void> => {
  const deadline = Date.now() + 1_000
  while (count() < expected && Date.now() < deadline) await wait(10)
  expect(count()).toBe(expected)
}

const createFakeWatchDirectory = () => {
  let listener: ((eventType: string, filename: string | null) => void) | undefined
  let directory: string | undefined
  let closed = false

  const watchDirectory: WatchDirectory = (path, onEvent) => {
    directory = path
    listener = onEvent
    return {
      close: () => {
        closed = true
      },
    }
  }

  return {
    watchDirectory,
    watchedDirectory: () => directory,
    isClosed: () => closed,
    emit: (eventType: string, filename: string | null) => {
      if (!closed) listener?.(eventType, filename)
    },
  }
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

  const startWatcher = async (debounceMs: number) => {
    tempRoot = await mkdtemp(join(tmpdir(), "cursor-digital-pet-watch-"))
    const databasePath = join(tempRoot, "opencode-digital-pet", "pet.db")
    const fake = createFakeWatchDirectory()
    let changeCount = 0

    watcher = createDatabaseChangeWatcher(
      {
        databasePath,
        debounceMs,
        onChange: () => {
          changeCount += 1
        },
      },
      fake.watchDirectory,
    )

    return { fake, databasePath, count: () => changeCount }
  }

  test("Given a pet.db event When watching the data directory Then each separate change fires once", async () => {
    const { fake, databasePath, count } = await startWatcher(40)
    expect(fake.watchedDirectory()).toBe(dirname(databasePath))

    fake.emit("rename", "pet.db")
    await waitForChangeCount(count, 1)

    fake.emit("change", "pet.db")
    await waitForChangeCount(count, 2)
  })

  test("Given rapid pet.db events When watching Then onChange coalesces into one debounced callback", async () => {
    const { fake, count } = await startWatcher(60)

    fake.emit("change", "pet.db")
    fake.emit("change", "pet.db")
    fake.emit("rename", "pet.db")
    await waitForChangeCount(count, 1)
    await wait(100)

    expect(count()).toBe(1)
  })

  test("Given another file in the data directory When it changes Then onChange is not called", async () => {
    const { fake, count } = await startWatcher(40)

    fake.emit("change", "notes.txt")
    await wait(100)

    expect(count()).toBe(0)
  })

  test("Given no filename in a watch event When it changes Then the database is refreshed", async () => {
    const { fake, count } = await startWatcher(40)

    fake.emit("rename", null)
    await waitForChangeCount(count, 1)
  })

  test("Given a SQLite WAL write When watching Then the shared database is refreshed", async () => {
    const { fake, count } = await startWatcher(40)

    fake.emit("change", "pet.db-wal")
    await waitForChangeCount(count, 1)
  })

  test("Given a disposed watcher When pet.db changes Then onChange is not called", async () => {
    const { fake, count } = await startWatcher(40)

    watcher?.dispose()
    watcher = undefined
    fake.emit("change", "pet.db")
    await wait(100)

    expect(fake.isClosed()).toBe(true)
    expect(count()).toBe(0)
  })
})
