import { join } from "node:path"
import type * as vscode from "vscode"

import { createDatabaseChangeWatcher } from "../adapters/sqlite/database-change-watcher.ts"
import {
  createSqliteDigitalPetRepository,
  type CursorSqliteDigitalPetRepository,
} from "../adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { configureSqlJsWasmPath } from "../adapters/sqlite/sqljs-config.ts"
import {
  getDigitalPetExtensionSettings,
  toDatabaseOptions,
  type DigitalPetExtensionSettings,
} from "../config/extension-settings.ts"
import { DigitalPetSidebarProvider } from "../webview/digital-pet-sidebar-provider.ts"

export type DigitalPetContainer = {
  readonly repository: CursorSqliteDigitalPetRepository
  readonly sidebarProvider: DigitalPetSidebarProvider
  readonly readSettings: () => DigitalPetExtensionSettings
  readonly databaseOptions: () => ReturnType<typeof toDatabaseOptions>
  readonly refreshSidebar: () => void
}

export const createDigitalPetContainer = async (context: vscode.ExtensionContext): Promise<DigitalPetContainer> => {
  configureSqlJsWasmPath(join(context.extensionPath, "dist", "sql-wasm.wasm"))

  const readSettings = () => getDigitalPetExtensionSettings()
  const databaseOptions = () => toDatabaseOptions(readSettings())

  const repository = await createSqliteDigitalPetRepository(databaseOptions())
  context.subscriptions.push({ dispose: () => repository.close() })

  const sidebarProvider = new DigitalPetSidebarProvider(context.extensionUri, repository, repository)
  const refreshSidebar = (): void => {
    void sidebarProvider.refresh()
  }

  const databaseWatcher = createDatabaseChangeWatcher({
    ...databaseOptions(),
    onChange: () => {
      repository.reloadFromDisk()
      if (sidebarProvider.isPresentationInProgress() !== true) {
        refreshSidebar()
      }
    },
  })
  context.subscriptions.push({ dispose: () => databaseWatcher.dispose() })

  return {
    repository,
    sidebarProvider,
    readSettings,
    databaseOptions,
    refreshSidebar,
  }
}
