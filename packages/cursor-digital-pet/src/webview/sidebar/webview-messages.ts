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

export type ExtensionToWebviewMessage = SidebarWebviewPayload | AnimationFramePayload

export type WebviewToExtensionMessage =
  | { readonly type: "open-url"; readonly url: string }
  | { readonly type: "artwork-width"; readonly width: number }

export const parseWebviewInboundMessage = (raw: unknown): WebviewToExtensionMessage | null => {
  if (raw === null || typeof raw !== "object") return null
  const message = raw as { readonly type?: unknown; readonly url?: unknown; readonly width?: unknown }
  if (message.type === "open-url" && typeof message.url === "string" && message.url.length > 0) {
    return { type: "open-url", url: message.url }
  }
  if (message.type === "artwork-width" && typeof message.width === "number" && Number.isFinite(message.width)) {
    return { type: "artwork-width", width: message.width }
  }
  return null
}
