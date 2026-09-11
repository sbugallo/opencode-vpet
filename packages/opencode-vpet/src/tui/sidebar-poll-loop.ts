export type SidebarPollLoopOptions<TModel, THandle> = {
  readonly intervalMs: number
  readonly load: () => Promise<TModel>
  readonly apply: (model: TModel) => void
  readonly schedule: (callback: () => void, intervalMs: number) => THandle
  readonly clear: (handle: THandle) => void
}

export type SidebarPollLoop = {
  readonly start: () => void
  readonly refresh: () => void
  readonly dispose: () => void
}

export const createSidebarPollLoop = <TModel, THandle>(
  options: SidebarPollLoopOptions<TModel, THandle>,
): SidebarPollLoop => {
  let disposed = false
  let loading = false
  let refreshPending = false
  let scheduled: THandle | undefined

  const scheduleNext = (): void => {
    if (disposed || scheduled !== undefined) return
    scheduled = options.schedule(() => {
      scheduled = undefined
      void poll()
    }, options.intervalMs)
  }

  const poll = async (): Promise<void> => {
    if (disposed || loading) return
    loading = true
    let model: TModel
    try {
      model = await options.load()
    } catch (error) {
      loading = false
      if (!disposed && refreshPending) {
        refreshPending = false
        void poll()
      } else if (!disposed) {
        scheduleNext()
      }
      console.error(error)
      return
    }
    loading = false
    if (disposed) return
    options.apply(model)
    if (refreshPending) {
      refreshPending = false
      void poll()
      return
    }
    scheduleNext()
  }

  return {
    start() {
      void poll()
    },
    refresh() {
      if (disposed) return
      if (loading) {
        refreshPending = true
        return
      }
      if (scheduled !== undefined) {
        options.clear(scheduled)
        scheduled = undefined
      }
      void poll()
    },
    dispose() {
      disposed = true
      if (scheduled !== undefined) options.clear(scheduled)
    },
  }
}
