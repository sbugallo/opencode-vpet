export type ProcessSpawner = (command: readonly string[]) => void

const spawnDetached: ProcessSpawner = (command) => {
  Bun.spawn([...command], { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
}

const openerCommand = (platform: NodeJS.Platform, url: string): readonly string[] => {
  switch (platform) {
    case "darwin":
      return ["open", url]
    case "win32":
      return ["cmd", "/c", "start", "", url]
    case "linux":
      return ["xdg-open", url]
    default:
      throw new Error(`Unsupported platform for opening URLs: ${platform}`)
  }
}

export const openInBrowser = (url: string, spawner: ProcessSpawner = spawnDetached): void => {
  if (url === "") return
  try {
    spawner(openerCommand(process.platform, url))
  } catch {
    // Best-effort affordance: a missing platform opener must never break rendering.
  }
}
