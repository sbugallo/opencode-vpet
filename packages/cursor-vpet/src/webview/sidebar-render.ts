import type { SidebarCardModel } from "@sbugallo/vpet-core/view-models/sidebar-view-model.ts"
import { resolveStaticMonsterArtwork } from "./static-monster-artwork.ts"

const NEXT_CHECK_PREFIX = "Next check: "
const NEXT_CHECK_BAR_WIDTH = 20
const URL_LABEL = "Encyclopedia entry"

const formatCount = (value: number): string => value.toLocaleString("en-US")

export const buildNextCheckLine = (model: SidebarCardModel): string => {
  if (model.kind === "no_partner") return ""
  if (model.isTerminal && !model.isSetOverride) return `${NEXT_CHECK_PREFIX}None`

  const progress = model.isTerminal ? 1 : Math.min(Math.max(model.gauge / model.threshold, 0), 1)
  const filled = Math.floor(progress * NEXT_CHECK_BAR_WIDTH)
  return `${NEXT_CHECK_PREFIX}[${"█".repeat(filled)}${"░".repeat(NEXT_CHECK_BAR_WIDTH - filled)}]`
}

export const buildGaugeLine = (model: SidebarCardModel): string => {
  if (model.kind !== "partner") return ""
  return model.isTerminal ? "-/-" : `${formatCount(model.gauge)}/${formatCount(model.threshold)}`
}

export type SidebarWebviewPayload =
  | { readonly type: "sidebar-model"; readonly kind: "no_partner"; readonly messageLine: string }
  | {
      readonly type: "sidebar-model"
      readonly kind: "partner"
      readonly name: string
      readonly stage: string
      readonly artwork: string
      readonly nextCheck: string
      readonly gauge: string
      readonly url: string
      readonly urlLabel: string
      readonly frozen: boolean
    }

export const toSidebarWebviewPayload = (model: SidebarCardModel): SidebarWebviewPayload => {
  if (model.kind === "no_partner") {
    return { type: "sidebar-model", kind: "no_partner", messageLine: model.messageLine }
  }

  return {
    type: "sidebar-model",
    kind: "partner",
    name: model.isSetOverride ? `${model.name} (set)` : model.name,
    stage: model.frozen ? `${model.stage} (frozen)` : model.stage,
    artwork: resolveStaticMonsterArtwork(model.sprite),
    nextCheck: buildNextCheckLine(model),
    gauge: buildGaugeLine(model),
    url: model.url,
    urlLabel: URL_LABEL,
    frozen: model.frozen,
  }
}

export const buildSidebarWebviewHtml = (nonce: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      margin: 0;
      padding: 12px;
      box-sizing: border-box;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-top: 1px solid var(--vscode-panel-border);
      border-bottom: 1px solid var(--vscode-panel-border);
      padding: 8px 0;
    }
    .artwork {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      line-height: 1;
      white-space: pre;
      min-height: 8em;
      image-rendering: pixelated;
    }
    .name { font-weight: 600; }
    .stage, .gauge, .next-check { font-size: 12px; opacity: 0.9; }
    .url {
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      text-decoration: underline;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
      text-align: left;
    }
    .empty { opacity: 0.7; font-size: 13px; }
  </style>
</head>
<body>
  <div id="content" class="empty">Loading VPet…</div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const content = document.getElementById("content");

    const escapeHtml = (value) =>
      String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

    const renderModel = (model) => {
      if (!model || model.type !== "sidebar-model") return;
      if (model.kind === "no_partner") {
        content.className = "empty";
        content.textContent = model.messageLine;
        return;
      }

      content.className = "card";
      content.innerHTML = \`
        <pre class="artwork">\${escapeHtml(model.artwork)}</pre>
        <div class="name">\${escapeHtml(model.name)}</div>
        <div class="stage">\${escapeHtml(model.stage)}</div>
        <div class="next-check">\${escapeHtml(model.nextCheck)}</div>
        <div class="gauge">\${escapeHtml(model.gauge)}</div>
        <button type="button" class="url" data-url="\${escapeHtml(model.url)}">\${escapeHtml(model.urlLabel)}</button>
      \`;

      const link = content.querySelector(".url");
      link?.addEventListener("click", () => {
        vscode.postMessage({ type: "open-url", url: model.url });
      });
    };

    window.addEventListener("message", (event) => {
      renderModel(event.data);
    });
  </script>
</body>
</html>`
