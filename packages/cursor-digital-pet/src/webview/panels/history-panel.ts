import * as vscode from "vscode"

import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { buildHistoryViewModel } from "@jcendal/digital-pet-core/view-models/history-view-model.ts"

import { readArchive } from "../../adapters/sqlite/sqlite-digital-pet-archive-reader.ts"
import type { CreateSqliteDigitalPetArchiveReaderOptions } from "../../adapters/sqlite/sqlite-digital-pet-archive-reader.ts"
import { escapeHtml } from "../../shared/escape-html.ts"

export const openHistoryPanel = async (
  context: vscode.ExtensionContext,
  options: CreateSqliteDigitalPetArchiveReaderOptions = {},
): Promise<void> => {
  const archive = await readArchive(options)
  const model = buildHistoryViewModel(archive, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)

  const panel = vscode.window.createWebviewPanel(
    "cursorDigitalPetHistory",
    "Digital Pet History",
    vscode.ViewColumn.One,
    {},
  )
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
    <h2>Digital Pet History</h2>
    <table><thead><tr><th>Gen</th><th>Path</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`
  context.subscriptions.push(panel)
}
