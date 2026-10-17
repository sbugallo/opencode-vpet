import type { ServerCommandDefinition, ServerContext } from "../src/adapters/opencode/server-plugin.ts"

export type ServerContextFixture = {
  readonly context: ServerContext
  readonly definitions: readonly ServerCommandDefinition[]
  readonly runCommand: (name: string, promptText?: string) => Promise<void>
  readonly dispatch: (event: unknown) => Promise<void>
  readonly rpcEvents: readonly { readonly name: string; readonly data: unknown }[]
}

/**
 * Builds a v2 plugin context fake whose event subscription yields queued
 * events, whose command transform captures registered definitions, and whose
 * RPC registration records emitted toast events. `dispatch` resolves once the
 * consumption loop has fully processed the delivered event.
 */
export const createServerContextFixture = (): ServerContextFixture => {
  const definitions: ServerCommandDefinition[] = []
  const queue: unknown[] = []
  const acknowledgements: Array<() => void> = []
  const waiters: Array<() => void> = []
  const rpcEvents: { name: string; data: unknown }[] = []

  const wake = (): void => {
    while (waiters.length > 0) waiters.shift()?.()
  }

  const context = {
    options: {},
    command: {
      transform: async (callback: (editor: { add(definition: ServerCommandDefinition): void }) => void) => {
        callback({
          add: (definition: ServerCommandDefinition) => {
            definitions.push(definition)
          },
        })
        return { dispose: async () => {} }
      },
    },
    event: {
      subscribe: ({ signal }: { readonly signal: AbortSignal }) => ({
        async *[Symbol.asyncIterator]() {
          const onAbort = () => wake()
          signal.addEventListener("abort", onAbort)
          try {
            while (true) {
              if (queue.length > 0) {
                yield queue.shift()
                acknowledgements.shift()?.()
                continue
              }
              if (signal.aborted) return
              await new Promise<void>((resolve) => {
                waiters.push(resolve)
              })
            }
          } finally {
            signal.removeEventListener("abort", onAbort)
          }
        },
      }),
    },
    rpc: {
      register: async () => ({
        events: {
          emit: async (name: string, data: unknown) => {
            rpcEvents.push({ name, data })
          },
        },
      }),
    },
    session: {
      context: async () => [],
    },
  } as unknown as ServerContext

  return {
    context,
    definitions,
    rpcEvents,
    runCommand: async (name: string, promptText = "") => {
      const definition = definitions.find((candidate) => candidate.name === name)
      if (definition === undefined) throw new Error(`Missing command definition: ${name}`)
      await definition.execute({ prompt: { text: promptText } })
    },
    dispatch: async (event: unknown) => {
      const acknowledgement = new Promise<void>((resolve) => {
        acknowledgements.push(resolve)
      })
      queue.push(event)
      wake()
      await acknowledgement
    },
  }
}
