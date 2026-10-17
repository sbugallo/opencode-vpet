export type SessionMessagesFetcher = (sessionID: string) => Promise<readonly unknown[]>

export type SessionMessagesClient = {
  readonly session: {
    context: (input: { readonly sessionID: string }) => Promise<readonly unknown[]>
  }
}

export const createSessionMessagesFetcher = (client: SessionMessagesClient): SessionMessagesFetcher => {
  return async (sessionID) => client.session.context({ sessionID })
}
