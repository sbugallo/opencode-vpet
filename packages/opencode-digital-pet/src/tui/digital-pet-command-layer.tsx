/** @jsxImportSource @opentui/solid */
import type { TuiDialogStack, TuiKeymap, TuiTheme } from "@opencode-ai/plugin/tui"

import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import type { DigitalPetArchiveReader } from "@jcendal/digital-pet-core/application/ports/digital-pet-archive.ts"
import type { ResolvedDigitalPetSettings } from "@jcendal/digital-pet-core/config/types.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/data/catalog.ts"
import { buildDexViewModel } from "@jcendal/digital-pet-core/view-models/dex-view-model.ts"
import { buildHistoryViewModel } from "@jcendal/digital-pet-core/view-models/history-view-model.ts"
import { DigitalPetDexDialog } from "./digital-pet-dex-dialog.tsx"
import { DigitalPetHistoryDialog } from "./digital-pet-history-dialog.tsx"

export type DigitalPetCommandLayerApi = {
  readonly keymap: Pick<TuiKeymap, "registerLayer">
  readonly ui: {
    readonly dialog: Pick<TuiDialogStack, "replace" | "clear" | "setSize">
  }
  readonly theme: TuiTheme
}

export type DigitalPetCommandLayerDependencies = {
  readonly api: DigitalPetCommandLayerApi
  readonly reader: DigitalPetArchiveReader
  readonly catalog: DigimonCatalog
  readonly settings: ResolvedDigitalPetSettings
  readonly isDisposed: () => boolean
}

const unavailableArchive = (): DigitalPetArchiveResult => ({
  kind: "unavailable",
  message: "Digital Pet archive is unavailable.",
})

const readArchive = (reader: DigitalPetArchiveReader): DigitalPetArchiveResult => {
  try {
    return reader.getArchive()
  } catch {
    return unavailableArchive()
  }
}

export const registerDigitalPetCommandLayer = ({
  api,
  reader,
  catalog,
  settings,
  isDisposed,
}: DigitalPetCommandLayerDependencies): ReturnType<TuiKeymap["registerLayer"]> => {
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
    api.ui.dialog.replace(
      () => <DigitalPetDexDialog theme={api.theme} model={model} onClose={closeDialog} />,
      closeDialog,
    )
    api.ui.dialog.setSize("medium")
  }
  const openHistory = (): void => {
    if (isDisposed()) return
    const model = buildHistoryViewModel(readArchive(reader), catalog, settings)
    isDialogOpen = true
    api.ui.dialog.replace(
      () => <DigitalPetHistoryDialog theme={api.theme} model={model} onClose={closeDialog} />,
      closeDialog,
    )
    api.ui.dialog.setSize("medium")
  }

  const disposeLayer = api.keymap.registerLayer({
    name: "opencode-digital-pet.layer",
    namespace: "opencode-digital-pet",
    commands: [
      {
        name: "digital-pet.dex",
        title: "Digital Pet Dex",
        description: "Browse the Digital Pet discovery archive.",
        category: "Digital Pet",
        namespace: "palette",
        slashName: "digital-pet-dex",
        run: openDex,
      },
      {
        name: "digital-pet.history",
        title: "Digital Pet History",
        description: "Browse Digital Pet generation history.",
        category: "Digital Pet",
        namespace: "palette",
        slashName: "digital-pet-history",
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
