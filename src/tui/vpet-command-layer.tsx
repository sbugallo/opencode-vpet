/** @jsxImportSource @opentui/solid */
import type { JSX } from "@opentui/solid"

import type { VpetArchiveResult } from "../application/models/vpet-archive.ts"
import type { VpetArchiveReader } from "../application/ports/vpet-archive.ts"
import type { ResolvedVpetSettings } from "../config/types.ts"
import type { DigimonCatalog } from "../data/catalog.ts"
import { buildDexViewModel } from "./dex-view-model.ts"
import { buildHistoryViewModel } from "./history-view-model.ts"
import type { VpetTheme } from "./theme.ts"
import { VpetDexDialog } from "./vpet-dex-dialog.tsx"
import { VpetHistoryDialog } from "./vpet-history-dialog.tsx"

export type VpetKeymapCommand = {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly group: string
  readonly palette: true
  readonly slash: { readonly name: string }
  readonly run: () => void
}

export type VpetKeymapLayer = {
  /** Limits the layer to one input mode; "global" opts out of host input-mode scoping. */
  readonly mode?: string
  /** Resolves conflicts with other active layers. */
  readonly priority?: number
  readonly commands: readonly VpetKeymapCommand[]
}

export type VpetDialogSize = "medium" | "large" | "xlarge"

export type VpetDialogStack = {
  readonly replace: (render: () => JSX.Element, onClose?: () => void) => void
  readonly setSize: (size: VpetDialogSize) => void
  readonly clear: () => void
}

export type VpetCommandLayerApi = {
  readonly keymap: { readonly registerLayer: (layer: VpetKeymapLayer) => () => void }
  readonly ui: { readonly dialog: VpetDialogStack }
  readonly theme: VpetTheme
}

export type VpetCommandLayerDependencies = {
  readonly api: VpetCommandLayerApi
  readonly reader: VpetArchiveReader
  readonly catalog: DigimonCatalog
  readonly settings: ResolvedVpetSettings
  readonly isDisposed: () => boolean
}

const unavailableArchive = (): VpetArchiveResult => ({
  kind: "unavailable",
  message: "VPet archive is unavailable.",
})

const readArchive = (reader: VpetArchiveReader): VpetArchiveResult => {
  try {
    return reader.getArchive()
  } catch {
    return unavailableArchive()
  }
}

export const registerVpetCommandLayer = ({
  api,
  reader,
  catalog,
  settings,
  isDisposed,
}: VpetCommandLayerDependencies): (() => void) => {
  let isDialogOpen = false
  const closeDialog = (): void => {
    if (isDisposed() || !isDialogOpen) return
    isDialogOpen = false
    api.ui.dialog.clear()
  }

  const openDex = (): void => {
    if (isDisposed()) return
    const model = buildDexViewModel(readArchive(reader), catalog, settings)
    isDialogOpen = true
    api.ui.dialog.replace(() => <VpetDexDialog theme={api.theme} model={model} onClose={closeDialog} />, closeDialog)
    api.ui.dialog.setSize("medium")
  }
  const openHistory = (): void => {
    if (isDisposed()) return
    const model = buildHistoryViewModel(readArchive(reader), catalog, settings)
    isDialogOpen = true
    api.ui.dialog.replace(
      () => <VpetHistoryDialog theme={api.theme} model={model} onClose={closeDialog} />,
      closeDialog,
    )
    api.ui.dialog.setSize("medium")
  }

  const disposeLayer = api.keymap.registerLayer({
    mode: "global",
    priority: 10,
    commands: [
      {
        id: "vpet.dex",
        title: "VPet Dex",
        description: "Browse the VPet discovery archive.",
        group: "VPet",
        palette: true,
        slash: { name: "vpet-dex" },
        run: openDex,
      },
      {
        id: "vpet.history",
        title: "VPet History",
        description: "Browse VPet generation history.",
        group: "VPet",
        palette: true,
        slash: { name: "vpet-history" },
        run: openHistory,
      },
    ],
  })

  return () => {
    if (isDialogOpen) {
      api.ui.dialog.clear()
      isDialogOpen = false
    }
    disposeLayer()
  }
}
