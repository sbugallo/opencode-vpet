import { Rpc } from "@opencode/plugin/rpc"

/**
 * Server-to-TUI notifications. The server plugin emits `toast` events; the TUI
 * plugin subscribes through its OpenCode client and renders them as toasts.
 */
export const VpetRpc = Rpc.define({
  id: "vpet",
  methods: {},
  events: {
    toast: {
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          message: { type: "string" },
          variant: { enum: ["info", "success", "warning"] },
          duration: { type: "number" },
        },
        required: ["title", "message", "variant", "duration"],
        additionalProperties: false,
      },
    },
  },
})
