# Cursor VPet

Digimon virtual pet for **Cursor** that evolves as you use Agent. Shares progress with
[@sbugallo/opencode-vpet](https://www.npmjs.com/package/@sbugallo/opencode-vpet) via the same `pet.db`.

## Features

- Sidebar webview with static ASCII partner artwork and evolution progress
- Dex and generation history panels
- Token tracking via Cursor hooks (`beforeSubmitPrompt` + `stop`) with API watermark fallback
- Commands: spawn, freeze, unfreeze, set Digimon, install/uninstall hooks

## Installation

### Open VSX (Cursor / VSCodium)

```text
ext install sbugallo.cursor-vpet
```

Or install from [Open VSX](https://open-vsx.org/extension/sbugallo/cursor-vpet).

### VSIX (manual)

Download the `.vsix` from [GitHub Releases](https://github.com/sbugallo/opencode-vpet/releases) and run
**Extensions → Install from VSIX**.

## First run

On first activation, the extension offers to install hooks in `~/.cursor/hooks.json`. Hooks are required
for reliable Agent token tracking.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `vpet.databasePath` | _(empty)_ | Override path to `pet.db` |
| `vpet.usage.settleDelayMs` | `4000` | Delay before API watermark fallback (ms) |

## Repository

Monorepo: [github.com/sbugallo/opencode-vpet](https://github.com/sbugallo/opencode-vpet)
