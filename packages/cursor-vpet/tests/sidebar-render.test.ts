import { describe, expect, test } from "bun:test"

import { buildGaugeLine, buildNextCheckLine, toSidebarWebviewPayload } from "../src/webview/sidebar-render.ts"

describe("sidebar render", () => {
  test("builds next check bar for partner progress", () => {
    const line = buildNextCheckLine({
      kind: "partner",
      name: "Agumon",
      sprite: "agumon",
      stage: "Rookie",
      stageNumber: 3,
      url: "https://example.com",
      gauge: 50,
      threshold: 100,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
    })

    expect(line).toBe("Next check: [██████████░░░░░░░░░░]")
  })

  test("maps partner model to static artwork payload", () => {
    const payload = toSidebarWebviewPayload({
      kind: "partner",
      name: "Agumon",
      sprite: "agumon",
      stage: "Rookie",
      stageNumber: 3,
      url: "https://example.com/agumon",
      gauge: 10,
      threshold: 100,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
    })

    expect(payload.kind).toBe("partner")
    if (payload.kind !== "partner") return
    expect(payload.artwork.length).toBeGreaterThan(0)
    expect(payload.artwork).not.toBe("agumon")
    expect(buildGaugeLine({
      kind: "partner",
      name: "Agumon",
      sprite: "agumon",
      stage: "Rookie",
      stageNumber: 3,
      url: "https://example.com/agumon",
      gauge: 10,
      threshold: 100,
      isTerminal: false,
      frozen: false,
      isSetOverride: false,
    })).toBe("10/100")
  })
})
