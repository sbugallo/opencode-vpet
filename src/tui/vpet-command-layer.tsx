/** @jsxImportSource @opentui/solid */
import type { TuiDialogStack, TuiKeymap, TuiTheme } from "@opencode-ai/plugin/tui"

import type { VpetArchiveResult } from "../application/models/vpet-archive.ts"
import type { VpetArchiveReader } from "../application/ports/vpet-archive.ts"
import type { ResolvedVpetSettings } from "../config/types.ts"
import type { DigimonCatalog } from "../data/catalog.ts"
import { buildDexViewModel } from "./dex-view-model.ts"
import { buildHistoryViewModel } from "./history-view-model.ts"
import { VpetDexDialog } from "./vpet-dex-dialog.tsx"
import { VpetHistoryDialog } from "./vpet-history-dialog.tsx"

export type VpetCommandLayerApi = {
  readonly keymap: Pick<TuiKeymap, "registerLayer">
  readonly ui: {
    readonly dialog: Pick<TuiDialogStack, "replace" | "clear" | "setSize">
  }
  readonly theme: TuiTheme
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
}: VpetCommandLayerDependencies): ReturnType<TuiKeymap["registerLayer"]> => {
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
    name: "opencode-vpet.layer",
    namespace: "opencode-vpet",
    commands: [
      {
        name: "vpet.dex",
        title: "VPet Dex",
        description: "Browse the VPet discovery archive.",
        category: "VPet",
        namespace: "palette",
        slashName: "vpet-dex",
        run: openDex,
      },
      {
        name: "vpet.history",
        title: "VPet History",
        description: "Browse VPet generation history.",
        category: "VPet",
        namespace: "palette",
        slashName: "vpet-history",
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
