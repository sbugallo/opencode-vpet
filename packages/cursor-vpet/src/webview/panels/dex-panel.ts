import * as vscode from "vscode"

import { DEFAULT_VPET_SETTINGS } from "@sbugallo/vpet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { buildDexViewModel } from "@sbugallo/vpet-core/view-models/dex-view-model.ts"

import { readArchive } from "../../adapters/sqlite/sqlite-vpet-archive-reader.ts"
import type { CreateSqliteVpetArchiveReaderOptions } from "../../adapters/sqlite/sqlite-vpet-archive-reader.ts"
import { escapeHtml } from "../../shared/escape-html.ts"

export const openDexPanel = async (
  context: vscode.ExtensionContext,
  options: CreateSqliteVpetArchiveReaderOptions = {},
): Promise<void> => {
  const archive = await readArchive(options)
  const model = buildDexViewModel(archive, DIGIMON_CATALOG, DEFAULT_VPET_SETTINGS)

  const panel = vscode.window.createWebviewPanel("cursorVpetDex", "VPet Dex", vscode.ViewColumn.One, {})
  if (model.kind !== "available") {
    const message = model.kind === "empty" ? "No discoveries yet." : escapeHtml(model.message)
    panel.webview.html = `<!DOCTYPE html><html><body>${message}</body></html>`
    context.subscriptions.push(panel)
    return
  }

  const discoveredCount = model.rows.filter((row) => row.discovered).length
  const rows = model.rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.stage)}</td><td>${row.discovered ? "✓" : "—"}</td></tr>`,
    )
    .join("")
  panel.webview.html = `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);color:var(--vscode-foreground)">
    <h2>VPet Dex</h2>
    <p>Discovered: ${discoveredCount} / ${model.rows.length}</p>
    <table><thead><tr><th>Name</th><th>Stage</th><th>Found</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`
  context.subscriptions.push(panel)
}
