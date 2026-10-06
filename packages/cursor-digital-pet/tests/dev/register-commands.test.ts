import { describe, expect, test } from "bun:test"

import { CURSOR_DEV_ACTIONS, DEV_SHOW_MENU_COMMAND, DEV_TOOLS_COMMAND_PALETTE_WHEN } from "../../src/dev/catalog.ts"

describe("cursor-digital-pet dev register-commands", () => {
  test("Given the dev catalog When inspected Then it exposes three dev tool actions and one palette command", () => {
    expect(DEV_SHOW_MENU_COMMAND).toBe("cursorDigitalPet.dev.showMenu")
    expect(DEV_TOOLS_COMMAND_PALETTE_WHEN).toBe("cursorDigitalPet.devToolsEnabled")
    expect(CURSOR_DEV_ACTIONS.map((action) => action.id)).toEqual(["feed", "evolution_reveal", "evolution_battle"])
  })
})
