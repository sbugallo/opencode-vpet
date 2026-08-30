# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Exported the OpenCode server plugin entrypoint so VPet commands and the sidebar load correctly.
- Updated `init` and `update` to delegate to OpenCode's native global plugin installer with the
  installed exact package version, avoiding stale bare or `@latest` cache reuse.

## [0.1.0] - 2026-08-30

### Added

- Server and TUI plugins that add a Digimon virtual pet to the OpenCode sidebar.
- Progression from completed assistant-message token usage, including reconciliation of completed 
  usage from concurrent sessions.
- Toast notifications for spawning, progression controls, and Digimon evolutions.
- A 650-Digimon catalog spanning eight evolution stages, with evolution paths and Japanese and 
  English names.
- Partner generations that can be spawned, evolved, frozen, unfrozen, or set to a catalog ID.
- Sidebar progress and status display, including frozen and manually set partner states, with 
  animated walking, action, and sleep behavior.
- Dex and History dialogs for browsing discovered Digimon and current or retired partner 
  generations, with links to external encyclopedia entries.
- `/vpet-spawn`, `/vpet-freeze`, `/vpet-unfreeze`, `/vpet-set <id>`, `/vpet-dex`, and 
  `/vpet-history` commands.
- SQLite persistence for partners, progression events, usage receipts, trainer totals, and control 
  state.
- Global settings for language, evolution thresholds, and notifications.
- `npx @sbugallo/opencode-vpet init` and `npx @sbugallo/opencode-vpet update` commands that register 
  server and TUI plugins while preserving unrelated JSON and JSONC configuration.
