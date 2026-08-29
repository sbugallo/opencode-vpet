import { describe, expect, test } from "bun:test"

import type { VpetControl } from "../src/application/ports/vpet-control.ts"
import { freezeVpet } from "../src/application/use-cases/freeze-vpet.ts"
import { setVpetCheatNode } from "../src/application/use-cases/set-vpet-cheat-node.ts"
import { unfreezeVpet } from "../src/application/use-cases/unfreeze-vpet.ts"

type ControlState = {
  frozen: boolean
  cheatNodeId: string | null
}

type FakeVpetControl = VpetControl & {
  readonly calls: string[]
  readonly state: ControlState
}

const createVpetControl = (initialState: ControlState): FakeVpetControl => {
  const calls: string[] = []
  const state = { ...initialState }

  return {
    calls,
    state,
    freeze() {
      calls.push("freeze")
      if (state.frozen) return { kind: "already_frozen" }
      state.frozen = true
      return { kind: "frozen" }
    },
    unfreeze() {
      calls.push("unfreeze")
      if (!state.frozen) return { kind: "already_unfrozen" }
      state.frozen = false
      return { kind: "unfrozen" }
    },
    setCheatNode(cheatNodeId) {
      calls.push(`set:${cheatNodeId}`)
      if (state.cheatNodeId === cheatNodeId) return { kind: "already_set", cheatNodeId }
      state.cheatNodeId = cheatNodeId
      return { kind: "set", cheatNodeId }
    },
  }
}

describe("vpet control application use cases", () => {
  test("Given an unfrozen VPet When freeze runs twice Then the first transition applies and the second is idempotent", () => {
    const control = createVpetControl({ frozen: false, cheatNodeId: null })

    const first = freezeVpet(control)
    const second = freezeVpet(control)

    expect(first).toEqual({ kind: "frozen" })
    expect(second).toEqual({ kind: "already_frozen" })
    expect(control.calls).toEqual(["freeze", "freeze"])
    expect(control.state).toEqual({ frozen: true, cheatNodeId: null })
  })

  test("Given a frozen VPet When unfreeze runs twice Then the first transition applies and the second is idempotent", () => {
    const control = createVpetControl({ frozen: true, cheatNodeId: "3-001" })

    const first = unfreezeVpet(control)
    const second = unfreezeVpet(control)

    expect(first).toEqual({ kind: "unfrozen" })
    expect(second).toEqual({ kind: "already_unfrozen" })
    expect(control.calls).toEqual(["unfreeze", "unfreeze"])
    expect(control.state).toEqual({ frozen: false, cheatNodeId: "3-001" })
  })

  test("Given a frozen VPet and a catalog-validated node ID When set runs Then it preserves freeze and returns typed set outcomes", () => {
    const control = createVpetControl({ frozen: true, cheatNodeId: "2-001" })

    const first = setVpetCheatNode(control, "3-001")
    const second = setVpetCheatNode(control, "3-001")

    expect(first).toEqual({ kind: "set", cheatNodeId: "3-001" })
    expect(second).toEqual({ kind: "already_set", cheatNodeId: "3-001" })
    expect(control.calls).toEqual(["set:3-001", "set:3-001"])
    expect(control.state).toEqual({ frozen: true, cheatNodeId: "3-001" })
  })

  test("Given a VPet control that throws during freeze When freeze runs Then the error propagates and no other transition is called", () => {
    const failure = new Error("freeze failed")
    const calls: string[] = []
    const control: VpetControl = {
      freeze: () => {
        calls.push("freeze")
        throw failure
      },
      unfreeze: () => {
        calls.push("unfreeze")
        return { kind: "unfrozen" }
      },
      setCheatNode: (cheatNodeId) => {
        calls.push(`set:${cheatNodeId}`)
        return { kind: "set", cheatNodeId }
      },
    }

    expect(() => freezeVpet(control)).toThrow(failure)
    expect(calls).toEqual(["freeze"])
  })
})
