import { describe, expect, test } from "bun:test"

import { parseWebviewInboundMessage } from "../src/webview/sidebar/webview-messages.ts"

describe("webview messages", () => {
  test("parses open-url messages", () => {
    expect(parseWebviewInboundMessage({ type: "open-url", url: "https://example.com" })).toEqual({
      type: "open-url",
      url: "https://example.com",
    })
  })

  test("parses artwork-width messages", () => {
    expect(parseWebviewInboundMessage({ type: "artwork-width", width: 42 })).toEqual({
      type: "artwork-width",
      width: 42,
    })
  })

  test("rejects invalid payloads", () => {
    expect(parseWebviewInboundMessage(null)).toBeNull()
    expect(parseWebviewInboundMessage({ type: "open-url", url: "" })).toBeNull()
    expect(parseWebviewInboundMessage({ type: "artwork-width", width: Number.NaN })).toBeNull()
  })
})
