import { describe, expect, test } from "bun:test"

import { escapeHtml } from "../src/shared/escape-html.ts"

describe("escapeHtml", () => {
  test("escapes HTML special characters", () => {
    expect(escapeHtml(`<script>"&"</script>`)).toBe("&lt;script&gt;&quot;&amp;&quot;&lt;/script&gt;")
  })
})
