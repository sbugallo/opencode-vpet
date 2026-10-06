import { describe, expect, test } from "bun:test"

import type { DigitalPetControl } from "@jcendal/digital-pet-core/application/ports/digital-pet-control.ts"
import { freezeDigitalPet } from "@jcendal/digital-pet-core/application/use-cases/freeze-digital-pet.ts"
import { setDigitalPetCheatNode } from "@jcendal/digital-pet-core/application/use-cases/set-digital-pet-cheat-node.ts"
import { unfreezeDigitalPet } from "@jcendal/digital-pet-core/application/use-cases/unfreeze-digital-pet.ts"

type ControlState = {
  frozen: boolean
  cheatNodeId: string | null
}

type FakeDigitalPetControl = DigitalPetControl & {
  readonly calls: string[]
  readonly state: ControlState
}

const createDigitalPetControl = (initialState: ControlState): FakeDigitalPetControl => {
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

describe("digital-pet control application use cases", () => {
  test("Given an unfrozen Digital Pet When freeze runs twice Then the first transition applies and the second is idempotent", () => {
    const control = createDigitalPetControl({ frozen: false, cheatNodeId: null })

    const first = freezeDigitalPet(control)
    const second = freezeDigitalPet(control)

    expect(first).toEqual({ kind: "frozen" })
    expect(second).toEqual({ kind: "already_frozen" })
    expect(control.calls).toEqual(["freeze", "freeze"])
    expect(control.state).toEqual({ frozen: true, cheatNodeId: null })
  })

  test("Given a frozen Digital Pet When unfreeze runs twice Then the first transition applies and the second is idempotent", () => {
    const control = createDigitalPetControl({ frozen: true, cheatNodeId: "3-001" })

    const first = unfreezeDigitalPet(control)
    const second = unfreezeDigitalPet(control)

    expect(first).toEqual({ kind: "unfrozen" })
    expect(second).toEqual({ kind: "already_unfrozen" })
    expect(control.calls).toEqual(["unfreeze", "unfreeze"])
    expect(control.state).toEqual({ frozen: false, cheatNodeId: "3-001" })
  })

  test("Given a frozen Digital Pet and a catalog-validated node ID When set runs Then it preserves freeze and returns typed set outcomes", () => {
    const control = createDigitalPetControl({ frozen: true, cheatNodeId: "2-001" })

    const first = setDigitalPetCheatNode(control, "3-001")
    const second = setDigitalPetCheatNode(control, "3-001")

    expect(first).toEqual({ kind: "set", cheatNodeId: "3-001" })
    expect(second).toEqual({ kind: "already_set", cheatNodeId: "3-001" })
    expect(control.calls).toEqual(["set:3-001", "set:3-001"])
    expect(control.state).toEqual({ frozen: true, cheatNodeId: "3-001" })
  })

  test("Given a Digital Pet control that throws during freeze When freeze runs Then the error propagates and no other transition is called", () => {
    const failure = new Error("freeze failed")
    const calls: string[] = []
    const control: DigitalPetControl = {
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

    expect(() => freezeDigitalPet(control)).toThrow(failure)
    expect(calls).toEqual(["freeze"])
  })
})
