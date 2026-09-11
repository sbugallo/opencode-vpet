import type { SidebarCardModel } from "@sbugallo/vpet-core/view-models/sidebar-view-model.ts"

const NEXT_CHECK_PREFIX = "Next check: "
const NEXT_CHECK_BAR_WIDTH = 20
const URL_LABEL = "Encyclopedia entry"

export const MIN_ARTWORK_WIDTH = 16
export const DEFAULT_ARTWORK_WIDTH = 32

export const pixelWidthToArtworkColumns = (pixelWidth: number, charWidthPx: number): number => {
  if (!Number.isFinite(pixelWidth) || pixelWidth <= 0) return DEFAULT_ARTWORK_WIDTH
  if (!Number.isFinite(charWidthPx) || charWidthPx <= 0) return DEFAULT_ARTWORK_WIDTH
  return Math.max(MIN_ARTWORK_WIDTH, Math.floor(pixelWidth / charWidthPx))
}

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
      readonly nextCheck: string
      readonly gauge: string
      readonly url: string
      readonly urlLabel: string
      readonly frozen: boolean
    }

export type AnimationFramePayload = {
  readonly type: "animation-frame"
  readonly artwork: string
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
    .artwork-wrap {
      width: 100%;
      min-height: 8em;
      overflow: hidden;
    }
    .artwork {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      line-height: 1;
      white-space: pre;
      margin: 0;
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
    let currentModel = null;
    let currentArtwork = "";

    const escapeHtml = (value) =>
      String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

    const MIN_ARTWORK_WIDTH = ${MIN_ARTWORK_WIDTH};
    let cachedCharWidth = 0;

    const measureCharWidth = () => {
      if (cachedCharWidth > 0) return cachedCharWidth;
      const probe = document.createElement("span");
      probe.className = "artwork";
      probe.textContent = "MMMMMMMMMM";
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      document.body.appendChild(probe);
      cachedCharWidth = probe.getBoundingClientRect().width / 10;
      probe.remove();
      return cachedCharWidth;
    };

    const reportArtworkWidth = () => {
      const pixelWidth = content.querySelector(".artwork-wrap")?.clientWidth ?? content.clientWidth;
      if (pixelWidth <= 0) return;
      const charWidth = measureCharWidth();
      if (charWidth <= 0) return;
      const width = Math.max(MIN_ARTWORK_WIDTH, Math.floor(pixelWidth / charWidth));
      vscode.postMessage({ type: "artwork-width", width });
    };

    const renderPartnerCard = () => {
      if (!currentModel || currentModel.kind !== "partner") return;
      content.className = "card";
      content.innerHTML = \`
        <div class="artwork-wrap"><pre class="artwork">\${escapeHtml(currentArtwork)}</pre></div>
        <div class="name">\${escapeHtml(currentModel.name)}</div>
        <div class="stage">\${escapeHtml(currentModel.stage)}</div>
        <div class="next-check">\${escapeHtml(currentModel.nextCheck)}</div>
        <div class="gauge">\${escapeHtml(currentModel.gauge)}</div>
        <button type="button" class="url" data-url="\${escapeHtml(currentModel.url)}">\${escapeHtml(currentModel.urlLabel)}</button>
      \`;

      const link = content.querySelector(".url");
      link?.addEventListener("click", () => {
        vscode.postMessage({ type: "open-url", url: currentModel.url });
      });
      reportArtworkWidth();
    };

    const render = () => {
      if (!currentModel || currentModel.type !== "sidebar-model") return;
      if (currentModel.kind === "no_partner") {
        content.className = "empty";
        content.textContent = currentModel.messageLine;
        return;
      }
      renderPartnerCard();
    };

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (!message || typeof message.type !== "string") return;
      if (message.type === "sidebar-model") {
        currentModel = message;
        render();
        return;
      }
      if (message.type === "animation-frame" && typeof message.artwork === "string") {
        currentArtwork = message.artwork;
        if (currentModel?.kind === "partner") {
          const artwork = content.querySelector(".artwork");
          if (artwork) {
            artwork.textContent = message.artwork;
          } else {
            renderPartnerCard();
          }
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => reportArtworkWidth());
    resizeObserver.observe(document.body);
    window.addEventListener("load", reportArtworkWidth);
  </script>
</body>
</html>`
