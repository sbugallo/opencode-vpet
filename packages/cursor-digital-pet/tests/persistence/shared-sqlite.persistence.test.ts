import { test, expect } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { build } from "esbuild"

test("Cursor and OpenCode retain each other's writes in one SQLite database", async () => {
  const root = await mkdtemp(join(tmpdir(), "digital-pet-shared-sqlite-"))
  const driverPath = join(root, "cursor-sqlite-driver.cjs")
  const scriptPath = join(root, "verify.cjs")
  const databasePath = join(root, "pet.db")

  try {
    await build({
      entryPoints: [resolve(import.meta.dir, "../../src/adapters/sqlite/sqlite-driver.ts")],
      outfile: driverPath,
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["bun:sqlite"],
      logLevel: "silent",
    })
    await writeFile(
      scriptPath,
      `
const { spawnSync } = require("node:child_process")
const { openReadonlySqliteDatabase, openWritableSqliteDatabase } = require(process.argv[2])
const databasePath = process.argv[3]
const cursor = openWritableSqliteDatabase(databasePath)
cursor.executor.run("CREATE TABLE events (name TEXT)")
cursor.executor.run("INSERT INTO events VALUES (?)", ["cursor"])
const opencode = spawnSync("bun", ["-e", 'import { Database } from "bun:sqlite"; const db = new Database(process.argv[1]); db.run("PRAGMA journal_mode=WAL"); db.run("INSERT INTO events VALUES (?)", ["opencode"]); db.close()', databasePath], { encoding: "utf8" })
if (opencode.status !== 0) throw new Error(opencode.stderr)
const beforeClose = cursor.executor.all("SELECT name FROM events ORDER BY name")
const reader = openReadonlySqliteDatabase(databasePath)
const readonlyView = reader.executor.all("SELECT name FROM events ORDER BY name")
reader.close()
cursor.close()
const reopened = openWritableSqliteDatabase(databasePath)
const afterClose = reopened.executor.all("SELECT name FROM events ORDER BY name")
reopened.close()
process.stdout.write(JSON.stringify({ beforeClose, readonlyView, afterClose }))
`,
    )

    const result = spawnSync("node", ["--no-warnings", scriptPath, driverPath, databasePath], { encoding: "utf8" })
    if (result.status !== 0) throw new Error(result.stderr)
    expect(JSON.parse(result.stdout)).toEqual({
      beforeClose: [{ name: "cursor" }, { name: "opencode" }],
      readonlyView: [{ name: "cursor" }, { name: "opencode" }],
      afterClose: [{ name: "cursor" }, { name: "opencode" }],
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
