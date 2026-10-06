export type AsyncRefreshQueue = {
  run(task: () => Promise<void>): Promise<void>
}

export const createAsyncRefreshQueue = (): AsyncRefreshQueue => {
  let inFlight = false
  let pending = false

  const run = async (task: () => Promise<void>): Promise<void> => {
    if (inFlight) {
      pending = true
      return
    }

    inFlight = true
    try {
      do {
        pending = false
        await task()
      } while (pending)
    } finally {
      inFlight = false
    }
  }

  return { run }
}
