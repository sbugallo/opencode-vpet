#!/usr/bin/env node
/**
 * Cursor hook bridge — reads hook JSON from stdin, appends to events file, responds {}.
 * Fail-open: never blocks Cursor on errors.
 */
import { appendFileSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { Readable } from "node:stream"

const EVENTS_PATH =
  process.env.VPET_HOOK_EVENTS_PATH ?? join(homedir(), ".cursor", "vpet-hook-events.jsonl")

const readStdin = async () => {
  const chunks = []
  for await (const chunk of Readable.toWeb(process.stdin)) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString("utf8")
}

const main = async () => {
  const raw = await readStdin()
  if (raw.trim().length === 0) {
    process.stdout.write("{}")
    return
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    process.stdout.write("{}")
    return
  }

  const hookEventName =
    typeof payload.hook_event_name === "string" ? payload.hook_event_name : process.argv[2] ?? "unknown"

  const record = {
    receivedAt: new Date().toISOString(),
    hookEventName,
    payload,
  }

  try {
    mkdirSync(dirname(EVENTS_PATH), { recursive: true })
    appendFileSync(EVENTS_PATH, `${JSON.stringify(record)}\n`, "utf8")
  } catch (error) {
    console.error("[vpet-hook-bridge]", error)
  }

  process.stdout.write("{}")
}

main().catch((error) => {
  console.error("[vpet-hook-bridge]", error)
  process.stdout.write("{}")
})
