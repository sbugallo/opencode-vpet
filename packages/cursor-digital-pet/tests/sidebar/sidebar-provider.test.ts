import { beforeAll, describe, expect, mock, test } from "bun:test"

const openedUrls: string[] = []

beforeAll(() => {
  mock.module("vscode", () => ({
    env: {
      openExternal: async (uri: { toString: () => string }) => {
        openedUrls.push(uri.toString())
      },
    },
    Uri: {
      parse: (value: string) => ({ toString: () => value }),
    },
  }))
})

const loadProvider = async () => {
  const { DigitalPetSidebarProvider } = await import("../../src/webview/sidebar/provider.ts")
  return DigitalPetSidebarProvider
}

const extensionUri = { fsPath: "/extension", scheme: "file", path: "/extension" }

const createStubWebviewView = (visible = true) => {
  let messageHandler: ((message: unknown) => void) | undefined
  const posted: unknown[] = []
  const webview = {
    options: {},
    html: "",
    postMessage: async (message: unknown) => {
      posted.push(message)
    },
    onDidReceiveMessage: (handler: (message: unknown) => void) => {
      messageHandler = handler
      return { dispose: () => undefined }
    },
  }
  const webviewView = {
    visible,
    webview,
    onDidChangeVisibility: () => ({ dispose: () => undefined }),
  }
  return {
    webviewView,
    posted,
    sendMessage: (message: unknown) => messageHandler?.(message),
  }
}

describe("sidebar provider", () => {
  test("resolveWebviewView sets CSP html with a nonce", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    const stub = createStubWebviewView()
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      { getSidebarSnapshot: () => null },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler: { start: () => () => undefined } },
    )
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    expect(stub.webviewView.webview.html).toContain("Content-Security-Policy")
    expect(stub.webviewView.webview.html).toMatch(/script nonce="[^"]+"/)
  })

  test("open-url message opens the link through vscode", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    openedUrls.length = 0
    const stub = createStubWebviewView()
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      { getSidebarSnapshot: () => null },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler: { start: () => () => undefined } },
    )
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    stub.sendMessage({ type: "open-url", url: "https://example.com/agumon" })
    await Promise.resolve()
    expect(openedUrls).toEqual(["https://example.com/agumon"])
  })

  test("invalid inbound messages are ignored", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    const stub = createStubWebviewView()
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      { getSidebarSnapshot: () => null },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler: { start: () => () => undefined } },
    )
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    stub.sendMessage({ type: "unknown" })
    expect(stub.posted).toHaveLength(0)
  })

  test("cached payload is posted when webview resolves", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    const stub = createStubWebviewView()
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      {
        getSidebarSnapshot: () => ({
          currentNodeId: "3-001",
          gauge: 10,
          isTerminal: false,
          frozen: false,
          isSetOverride: false,
          trainerTotalTokens: 100,
          pendingEvolutionTargetId: null,
          battleOpponentNodeId: null,
        }),
      },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler: { start: () => () => undefined } },
    )
    await provider.refresh()
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    await Promise.resolve()
    expect(stub.posted.some((message) => (message as { kind?: string }).kind === "partner")).toBe(true)
  })

  test("dispose stops the animation host scheduler", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    const state = { stopped: false }
    const scheduler = {
      start: () => () => {
        state.stopped = true
      },
    }
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      { getSidebarSnapshot: () => null },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler },
    )
    const stub = createStubWebviewView()
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    provider.dispose()
    expect(state.stopped).toBe(true)
  })
})
