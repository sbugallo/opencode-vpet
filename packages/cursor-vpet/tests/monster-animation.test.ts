import { describe, expect, test } from "bun:test"

import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"
import { MonsterAnimationController } from "../src/webview/monster-animation.ts"

describe("monster animation", () => {
  test("dispatches partner_changed without performance.now binding errors", () => {
    const controller = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
    const output = controller.dispatch({
      kind: "partner_changed",
      partner: { sprite: "agumon", isDigitama: false },
    })

    expect(output.result.kind).toBe("frame")
  })
})
