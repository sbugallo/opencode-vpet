import { mkdirSync } from "node:fs"
import { watch } from "node:fs"
import { basename, dirname } from "node:path"

import {
  resolveHostDatabasePath,
  type HostPathOptions,
} from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"

export type DatabaseChangeWatcherOptions = HostPathOptions & {
  readonly databasePath?: string
  readonly onChange: () => void
  readonly debounceMs?: number
}

export type DatabaseChangeWatcher = {
  dispose(): void
}

type DirectoryWatcher = { close(): void }
export type WatchDirectory = (
  directory: string,
  listener: (eventType: string, filename: string | null) => void,
) => DirectoryWatcher

const isPetDatabaseFilename = (filename: string | null | undefined, databaseFileName: string): boolean => {
  if (filename === undefined || filename === null) return true
  return filename === databaseFileName || filename === `${databaseFileName}-wal`
}

export const createDatabaseChangeWatcher = (
  options: DatabaseChangeWatcherOptions,
  watchDirectory: WatchDirectory = watch,
): DatabaseChangeWatcher => {
  const databasePath = options.databasePath ?? resolveHostDatabasePath(options)
  const databaseDirectory = dirname(databasePath)
  const databaseFileName = basename(databasePath)
  const debounceMs = options.debounceMs ?? 200

  let disposed = false
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let watcher: DirectoryWatcher | undefined

  const scheduleChange = (): void => {
    if (disposed) return
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      if (!disposed) options.onChange()
    }, debounceMs)
  }

  const handleWatchEvent = (filename: string | null | undefined): void => {
    if (disposed) return
    if (!isPetDatabaseFilename(filename, databaseFileName)) return
    scheduleChange()
  }

  mkdirSync(databaseDirectory, { recursive: true })
  watcher = watchDirectory(databaseDirectory, (eventType, filename) => {
    if (eventType !== "change" && eventType !== "rename") return
    handleWatchEvent(filename)
  })

  return {
    dispose() {
      disposed = true
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer)
        debounceTimer = undefined
      }
      watcher?.close()
      watcher = undefined
    },
  }
}
