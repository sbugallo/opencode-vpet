import * as vscode from "vscode"

export type NotificationPort = {
  showInformation(message: string): void
}

export const createVsCodeNotificationPort = (): NotificationPort => ({
  showInformation(message: string): void {
    void vscode.window.showInformationMessage(message)
  },
})
