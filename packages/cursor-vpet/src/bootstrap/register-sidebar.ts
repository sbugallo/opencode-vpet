import * as vscode from "vscode"

import { VpetSidebarProvider } from "../webview/vpet-sidebar-provider.ts"
import type { VpetContainer } from "./container.ts"

export const registerSidebar = (context: vscode.ExtensionContext, container: VpetContainer): void => {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VpetSidebarProvider.viewType, container.sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    { dispose: () => container.sidebarProvider.dispose() },
  )
}
