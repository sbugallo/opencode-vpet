import type { RGBA } from "@opentui/core"

/** Structural subset of the resolved host theme that VPet surfaces consume. */
export type VpetTheme = {
  readonly current: {
    readonly primary: RGBA
    readonly success: RGBA
    readonly textMuted: RGBA
  }
}

/** Structural subset of the v2 resolved theme (`context.theme`). */
export type VpetResolvedTheme = {
  readonly text: {
    readonly muted: RGBA
    readonly action: {
      readonly primary: { readonly base: RGBA }
    }
    readonly feedback: {
      readonly success: { readonly base: RGBA }
    }
  }
}

export const toVpetTheme = (theme: VpetResolvedTheme): VpetTheme => ({
  current: {
    primary: theme.text.action.primary.base,
    success: theme.text.feedback.success.base,
    textMuted: theme.text.muted,
  },
})
