import { join } from "node:path"
import type * as vscode from "vscode"

import { createDatabaseChangeWatcher } from "../adapters/sqlite/database-change-watcher.ts"
import {
  createSqliteVpetRepository,
  type CursorSqliteVpetRepository,
} from "../adapters/sqlite/sqlite-vpet-write-store.ts"
import { configureSqlJsWasmPath } from "../adapters/sqlite/sqljs-config.ts"
import {
  getVpetExtensionSettings,
  toDatabaseOptions,
  type VpetExtensionSettings,
} from "../config/extension-settings.ts"
import { VpetSidebarProvider } from "../webview/vpet-sidebar-provider.ts"

export type VpetContainer = {
  readonly repository: CursorSqliteVpetRepository
  readonly sidebarProvider: VpetSidebarProvider
  readonly readSettings: () => VpetExtensionSettings
  readonly databaseOptions: () => ReturnType<typeof toDatabaseOptions>
  readonly refreshSidebar: () => void
}

export const createVpetContainer = async (context: vscode.ExtensionContext): Promise<VpetContainer> => {
  configureSqlJsWasmPath(join(context.extensionPath, "dist", "sql-wasm.wasm"))

  const readSettings = () => getVpetExtensionSettings()
  const databaseOptions = () => toDatabaseOptions(readSettings())

  const repository = await createSqliteVpetRepository(databaseOptions())
  context.subscriptions.push({ dispose: () => repository.close() })

  const sidebarProvider = new VpetSidebarProvider(context.extensionUri, repository, repository)
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
