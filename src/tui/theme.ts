import type { RGBA } from "@opentui/core"

/** Structural subset of the resolved host theme that VPet surfaces consume. */
export type VpetTheme = {
  readonly current: {
    readonly text: RGBA
    readonly accent: RGBA
    readonly primary: RGBA
    readonly success: RGBA
    readonly textMuted: RGBA
  }
}

/** Structural subset of the v2 resolved theme (`context.theme`). */
export type VpetResolvedTheme = {
  readonly hue: {
    /** Named hue scales (100-900); `accent` is mandatory in every theme. */
    readonly accent: Readonly<Partial<Record<number, RGBA>>>
  }
  readonly text: {
    readonly base: RGBA
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
    text: theme.text.base,
    // Level 200 is the accent shade OpenCode's own UI uses for emphasis text; fall back to the
    // primary action color if a theme ever ships without that shade.
    accent: theme.hue.accent[200] ?? theme.text.action.primary.base,
    primary: theme.text.action.primary.base,
    success: theme.text.feedback.success.base,
    textMuted: theme.text.muted,
  },
})
