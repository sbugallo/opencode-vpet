<div align="center">
  <img
    src="icon.png"
    alt="Cursor VPet logo"
    width="160"
    style="image-rendering: pixelated"
  >
  <h1>Cursor VPet</h1>
  <p>
    <strong>Digimon virtual pet for Cursor that evolves as you use Agent — shares progress with OpenCode VPet</strong>
  </p>

[![Version](https://img.shields.io/open-vsx/v/sbugallo/cursor-vpet?style=flat-square&label=Version)](https://open-vsx.org/extension/sbugallo/cursor-vpet)
[![Downloads](https://img.shields.io/open-vsx/dt/sbugallo/cursor-vpet?style=flat-square&label=Downloads)](https://open-vsx.org/extension/sbugallo/cursor-vpet)
[![Rating](https://img.shields.io/open-vsx/rating/sbugallo/cursor-vpet?style=flat-square&label=Rating)](https://open-vsx.org/extension/sbugallo/cursor-vpet)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue?style=flat-square)](LICENSE)

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) •
[Commands](#-commands) • [Settings](#%EF%B8%8F-settings) • [Storage](#-storage) •
[How It Works](#-how-it-works) • [Authors](#-authors)

[![Install from Open VSX](https://img.shields.io/badge/Open%20VSX-Install-764ABC?style=for-the-badge&logo=eclipse&logoColor=white)](https://open-vsx.org/extension/sbugallo/cursor-vpet)
&nbsp;&nbsp;
[![Download VSIX](https://img.shields.io/badge/GitHub-Releases-24292f?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sbugallo/opencode-vpet/releases)

---

</div>

## 📖 About

**Cursor Agent** turns every prompt into real work — but what if that effort also fed a partner
that grows with you? **Cursor VPet** adds a Digimon virtual pet to the Explorer sidebar. Your
partner gains experience from Agent token usage and evolves through classic Digimon stages.

It shares the same `pet.db` database as
[@sbugallo/opencode-vpet](https://www.npmjs.com/package/@sbugallo/opencode-vpet), so progress
carries over between Cursor and OpenCode.

<div align="center">
<img
  src="https://github.com/sbugallo/opencode-vpet/raw/main/_images/vpet-overview.png"
  alt="VPet sidebar with partner artwork and evolution progress (OpenCode preview)"
  width="700"
/>
</div>

### 🎯 Key Highlights

- 🐣 **Evolves with Agent usage** — Input, output, and cache tokens from Agent turns count
- 🔄 **Shared with OpenCode** — Same `pet.db`, Dex, and generation history across tools
- 🎮 **650 Digimon** — Evolution lines extracted from the original V-Pets
- 📊 **Sidebar + panels** — Live partner view, Dex browser, and generation history
- 🪝 **Reliable tracking** — Cursor hooks with API watermark fallback
- 🔒 **Privacy-first** — Local SQLite storage, no telemetry
- ⏸️ **Freeze anytime** — Pause progression without losing your partner

---

## ✨ Features

| Feature | Description |
| --- | --- |
| **Sidebar webview** | Animated ASCII partner artwork with stage gauge and evolution progress |
| **Dex panel** | Browse discovered Digimon from your collection |
| **History panel** | Review current and retired partner generations |
| **Token tracking** | Cursor hooks (`beforeSubmitPrompt` + `stop`) with API watermark fallback |
| **Shared database** | Compatible `pet.db` with the OpenCode VPet plugin |
| **Partner commands** | Spawn, freeze, unfreeze, and set Digimon by catalog ID |
| **Hook management** | Install or uninstall hooks from the Command Palette |

---

## 📦 Installation

### Open VSX (Cursor / VSCodium)

Open Quick Open (`Ctrl+P` / `Cmd+P`) and run:

```
ext install sbugallo.cursor-vpet
```

Or search for **Cursor VPet** in the Extensions sidebar, or install from
[Open VSX](https://open-vsx.org/extension/sbugallo/cursor-vpet).

### VSIX (manual)

Download the `.vsix` from
[GitHub Releases](https://github.com/sbugallo/opencode-vpet/releases) and run
**Extensions → Install from VSIX…**.

---

## 🚀 Usage

### First run — install hooks

On first activation, the extension prompts you to register hooks in `~/.cursor/hooks.json`.
Hooks are required for reliable Agent token tracking.

You can also run **Cursor VPet: Install Hooks** from the Command Palette at any time.

### Sidebar

Open the **VPet** view in the Explorer sidebar to see your active partner, evolution gauge,
and animated artwork.

### Hatch a partner

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run **Cursor VPet: Spawn Partner**

Your partner starts as an egg and evolves as you complete Agent turns.

### Other access methods

- **Command Palette** — all `Cursor VPet:` commands
- **Explorer sidebar** — **VPet** webview panel

---

## 🎮 Commands

| Command | Description |
| --- | --- |
| **Cursor VPet: Spawn Partner** | Hatches a new egg |
| **Cursor VPet: Freeze** | Pauses partner progression |
| **Cursor VPet: Unfreeze** | Resumes partner progression |
| **Cursor VPet: Set Digimon** | Overrides the partner with a catalog ID (e.g. `3-001`) |
| **Cursor VPet: Open Dex** | Opens the partner Dex panel |
| **Cursor VPet: Open History** | Opens the generation history panel |
| **Cursor VPet: Install Hooks** | Registers hooks in `~/.cursor/hooks.json` |
| **Cursor VPet: Uninstall Hooks** | Removes VPet hooks from `~/.cursor/hooks.json` |

> **Note:** Using **Set Digimon** does not count toward Dex completion.

---

## 📝 Examples

### Shared database with OpenCode

By default, both Cursor VPet and OpenCode VPet use the same `pet.db` location. To share a
custom file, set the same path in both tools:


```json
{
  "vpet.databasePath": "/path/to/shared/pet.db"
}
```

### Slower API watermark fallback

If token deltas are not captured immediately after Agent turns, increase the settle delay:

```json
{
  "vpet.usage.settleDelayMs": 8000
}
```

---

## ⚙️ Settings

Configure via **File → Preferences → Settings** and search for `vpet`.

| Setting | Default | Description |
| --- | --- | --- |
| `databasePath` | _(empty)_ | Override path to `pet.db` (default: shared opencode-vpet location) |
| `usage.settleDelayMs` | `4000` | Initial delay before API watermark fallback (ms) |

> Changing `databasePath` requires reloading the Cursor window.

Stage labels and evolution thresholds use the built-in defaults from `@sbugallo/vpet-core`
(Japanese naming by default). The OpenCode plugin can override these via
[`opencode-vpet.json`](https://github.com/sbugallo/opencode-vpet#settings); Cursor VPet does
not read that file yet.

---

## 🔧 Requirements

| Requirement | Details |
| --- | --- |
| **Cursor** | Token tracking requires Cursor (`state.vscdb` must be present) |
| **Node.js** | Required to run `hook-bridge.js` from Cursor hooks |
| **Hooks** | `beforeSubmitPrompt` and `stop` entries in `~/.cursor/hooks.json` |

The extension shows a warning if it cannot detect the Cursor runtime. VS Code alone is not
enough for token tracking, though the sidebar and panels still work with an existing `pet.db`.

---

## 💾 Storage

Partner state, Dex discoveries, and generation history are stored in a SQLite database named
`pet.db`. By default it uses the same location as OpenCode VPet:

| Platform | Default path |
| --- | --- |
| **macOS** | `~/Library/Application Support/opencode-vpet/pet.db` |
| **Linux / WSL** | `~/.local/share/opencode-vpet/pet.db` |
| **Windows** | `%APPDATA%\opencode-vpet\pet.db` |

Override with `vpet.databasePath` to use a custom file.

---

## 🏗️ How It Works

```
┌──────────────┐     ┌───────────────┐     ┌────────────────────┐     ┌─────────┐
│ Cursor hooks │ ──▶ │ hook-bridge.js│ ──▶ │ vpet-hook-events   │ ──▶ │ pet.db  │
│ before/stop  │     │ (Node)        │     │ .jsonl             │     │ SQLite  │
└──────────────┘     └───────────────┘     └────────────────────┘     └─────────┘
                                                    │
                                                    ▼
                                           ┌─────────────────┐
                                           │ Sidebar webview │
                                           │ Dex · History   │
                                           └─────────────────┘
```

1. Cursor hooks fire on `beforeSubmitPrompt` and `stop` for each Agent turn
2. `hook-bridge.js` appends structured events to `~/.cursor/vpet-hook-events.jsonl`
3. The extension watches the event log and maps stop payloads to completed usage
4. If stop tokens are missing, it falls back to Cursor's usage API (watermark delta)
5. Usage is applied through `@sbugallo/vpet-core` evolution logic into `pet.db`
6. The sidebar webview refreshes with updated partner state and artwork

---

## 🔒 Privacy

- ✅ No extension telemetry or analytics
- ✅ Partner data stays in your local `pet.db`
- ✅ Hook events are written only to `~/.cursor/vpet-hook-events.jsonl`
- ⚠️ API watermark fallback reads your Cursor access token from local `state.vscdb` and
  queries `cursor.com/api/dashboard/get-filtered-usage-events` to compute token deltas
- ⚠️ When stop hooks include token counts, no network request is needed for that turn

---

## 🐛 Known Issues

| Issue | Workaround |
| --- | --- |
| Tokens not recorded after Agent turns | Run **Cursor VPet: Install Hooks** and retry |
| Missing token data in stop hook | Increase `vpet.usage.settleDelayMs` (e.g. `8000`) |
| Running in VS Code instead of Cursor | Token tracking is unavailable; use Cursor for Agent usage |
| Database path change not applied | Reload the Cursor window after changing settings |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome in the monorepo!

1. Fork the [repository](https://github.com/sbugallo/opencode-vpet)
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Package path: [`packages/cursor-vpet`](https://github.com/sbugallo/opencode-vpet/tree/main/packages/cursor-vpet)

---

## 👤 Authors

| Role | Name |
| --- | --- |
| **Author** | [Sergio Bugallo](https://github.com/sbugallo) |
| **Collaborator** | [Jorge Cendal](https://github.com/jcendal) |

---

## 📜 License

[Apache-2.0](LICENSE)

Part of the [opencode-vpet](https://github.com/sbugallo/opencode-vpet) monorepo. Digimon
sprites were derived from community sources — see the
[root README attributions](https://github.com/sbugallo/opencode-vpet#attributions).

---

<div align="center">

**Built with ❤️ for the developer community**

[⬆ Back to Top](#cursor-vpet)

</div>
