import type { SidebarWebviewPayload } from "../../webview/sidebar/webview-messages.ts"
import type { WebviewMessenger } from "./webview-messenger.ts"

export type AnimationSink = {
  postArtwork(artwork: string): Promise<void>
  postModel(payload: SidebarWebviewPayload): Promise<void>
}

export const createAnimationSink = (messenger: WebviewMessenger): AnimationSink => ({
  async postArtwork(artwork: string): Promise<void> {
    await messenger.post({ type: "animation-frame", artwork })
  },
  async postModel(payload: SidebarWebviewPayload): Promise<void> {
    await messenger.post(payload)
  },
})
