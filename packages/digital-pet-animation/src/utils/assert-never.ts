export const assertNever = (value: never): never => {
  throw new Error(`Unexpected variant: ${JSON.stringify(value)}`)
}
