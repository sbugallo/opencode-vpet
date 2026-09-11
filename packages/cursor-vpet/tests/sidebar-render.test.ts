import { describe, expect, test } from "bun:test"

import {
  buildGaugeLine,
  buildNextCheckLine,
  pixelWidthToArtworkColumns,
  toSidebarWebviewPayload,
} from "../src/webview/sidebar-render.ts"

describe("sidebar render", () => {
  test("converts pixel width to monospace artwork columns", () => {
    expect(pixelWidthToArtworkColumns(250, 7.5)).toBe(33)
    expect(pixelWidthToArtworkColumns(120, 7.5)).toBe(16)
    expect(pixelWidthToArtworkColumns(10, 7.5)).toBe(16)
  })

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

  test("maps partner model to sidebar payload without artwork", () => {
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
    expect(payload.name).toBe("Agumon")
    expect(payload.stage).toBe("Rookie")
    expect("artwork" in payload).toBe(false)
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
