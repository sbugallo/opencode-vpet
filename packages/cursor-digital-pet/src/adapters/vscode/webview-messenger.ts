import type * as vscode from "vscode"

import type { ExtensionToWebviewMessage } from "../../webview/sidebar/webview-messages.ts"

export type WebviewMessenger = {
  post(message: ExtensionToWebviewMessage): Promise<void>
}

export const createWebviewMessenger = (webview: vscode.Webview): WebviewMessenger => ({
  async post(message: ExtensionToWebviewMessage): Promise<void> {
    await webview.postMessage(message)
  },
})
