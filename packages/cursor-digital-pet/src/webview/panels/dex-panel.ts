import * as vscode from "vscode"

import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { buildDexViewModel } from "@jcendal/digital-pet-core/view-models/dex-view-model.ts"

import { readArchive } from "../../adapters/sqlite/sqlite-digital-pet-archive-reader.ts"
import type { CreateSqliteDigitalPetArchiveReaderOptions } from "../../adapters/sqlite/sqlite-digital-pet-archive-reader.ts"
import { escapeHtml } from "../../shared/escape-html.ts"

export const openDexPanel = async (
  context: vscode.ExtensionContext,
  options: CreateSqliteDigitalPetArchiveReaderOptions = {},
): Promise<void> => {
  const archive = await readArchive(options)
  const model = buildDexViewModel(archive, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)

  const panel = vscode.window.createWebviewPanel("cursorDigitalPetDex", "Digital Pet Dex", vscode.ViewColumn.One, {})
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
    <h2>Digital Pet Dex</h2>
    <p>Discovered: ${discoveredCount} / ${model.rows.length}</p>
    <table><thead><tr><th>Name</th><th>Stage</th><th>Found</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`
  context.subscriptions.push(panel)
}
