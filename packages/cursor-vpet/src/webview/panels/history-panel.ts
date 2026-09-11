import * as vscode from "vscode"

import { DEFAULT_VPET_SETTINGS } from "@sbugallo/vpet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { buildHistoryViewModel } from "@sbugallo/vpet-core/view-models/history-view-model.ts"

import { readArchive } from "../../adapters/sqlite/sqlite-vpet-archive-reader.ts"
import type { CreateSqliteVpetArchiveReaderOptions } from "../../adapters/sqlite/sqlite-vpet-archive-reader.ts"
import { escapeHtml } from "../../shared/escape-html.ts"

export const openHistoryPanel = async (
  context: vscode.ExtensionContext,
  options: CreateSqliteVpetArchiveReaderOptions = {},
): Promise<void> => {
  const archive = await readArchive(options)
  const model = buildHistoryViewModel(archive, DIGIMON_CATALOG, DEFAULT_VPET_SETTINGS)

  const panel = vscode.window.createWebviewPanel("cursorVpetHistory", "VPet History", vscode.ViewColumn.One, {})
  if (model.kind !== "available") {
    const message = model.kind === "empty" ? "No history yet." : escapeHtml(model.message)
    panel.webview.html = `<!DOCTYPE html><html><body>${message}</body></html>`
    context.subscriptions.push(panel)
    return
  }

  const rows = model.generations
    .map(
      (generation) =>
        `<tr><td>Gen ${generation.generation}</td><td>${escapeHtml(generation.path.join(" → "))}</td><td>${escapeHtml(generation.createdAt)}</td></tr>`,
    )
    .join("")
  panel.webview.html = `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);color:var(--vscode-foreground)">
    <h2>VPet History</h2>
    <table><thead><tr><th>Gen</th><th>Path</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`
  context.subscriptions.push(panel)
}
