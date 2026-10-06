import * as vscode from "vscode"

import { DigitalPetSidebarProvider } from "../webview/digital-pet-sidebar-provider.ts"
import type { DigitalPetContainer } from "./container.ts"

export const registerSidebar = (context: vscode.ExtensionContext, container: DigitalPetContainer): void => {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DigitalPetSidebarProvider.viewType, container.sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    { dispose: () => container.sidebarProvider.dispose() },
  )
}
