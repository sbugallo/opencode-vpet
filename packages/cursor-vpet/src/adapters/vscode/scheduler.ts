export type IntervalScheduler = {
  start(callback: () => void, intervalMs: number): () => void
}

export const createIntervalScheduler = (): IntervalScheduler => ({
  start(callback: () => void, intervalMs: number): () => void {
    const handle = setInterval(callback, intervalMs)
    return () => clearInterval(handle)
  },
})
