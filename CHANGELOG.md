# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Stage is now a string (`digitama`, `babyI`, `babyII`, `child`, `adult`, `perfect`, `ultimate`,
  `superUltimate`, `hybrid`, `armor`, `unknown`) instead of the old `0`–`7` numbering, everywhere:
  catalog data, evolution thresholds, settings, sidebar, and Dex. Armor (`AR-`) and hybrid (`H-`)
  entries are no longer collapsed into the adult stage, and Calumon (`UN-001`) is filed as
  `unknown`.
- `stageThresholds` config keys follow the stage ids: `egg` was renamed to `digitama` and
  `hybrid`, `armor`, and `unknown` were added. **This is a breaking change for existing
  `opencode-vpet.json` files**: the old `egg` key is ignored and falls back to the default
  threshold.
- The Japanese `superUltimate` stage label is now displayed as `Super Ultimate`.

## [0.4.0] - 2026-10-26

### Added

- The Digimon roster now covers the full vpet-2.0 dataset (1,168 monsters) with canonical dataset
  ids (`D-`, `BI-`, `BII-`, `C-`, `A-`, `AR-`, `H-`, `P-`, `U-`, `SU-`, `UN-`), replacing the legacy
  stage-number ids. Existing SQLite databases are migrated automatically.
- `/vpet-spawn` now accepts an optional Digitama field argument, and one `/vpet-spawn-<field>`
  command is registered per field: `deep-savers`, `dragons-roar`, `jungle-troopers`, `metal-empire`,
  `nature-spirits`, `nightmare-soldiers`, `virus-busters`, and `wind-guardians`. Without an
  argument, a random Digiegg is spawned.

### Changed

- The sidebar card now renders full-color 16x16 pixel sprites (half-block glyphs with per-pixel
  foreground/background colors) instead of monochrome Unicode artwork, using the color pose frames
  shipped with the dataset. Cosmetic actions play `angry`, `happy`, and `sick` single frames plus a
  two-frame `attack` clip.

### Removed

- The monochrome frame dataset and string-based sprite rendering, including the legacy artwork
  mirror module. There is no fallback to the old rendering path.

## [0.3.0] - 2026-10-22

### Changed

- The sidebar card now paints the Digimon artwork, name, stage, progress bar, and gauge with the host
  theme's base text color instead of the terminal default, and the "Encyclopedia entry" link with the
  theme's accent color (`hue.accent[200]`). Colors are read from the theme on every render, so
  switching the OpenCode theme (e.g. to `matrix`) recolors the card live, without a restart. Dex and
  history dialogs also resolve the theme at open time instead of plugin load.

## [0.2.0] - 2026-10-17

### Changed

- **Breaking:** migrated to the OpenCode v2 plugin API. OpenCode `>=2.0.18` is now required, and
  OpenCode v1 is no longer supported.
- Command results from `/vpet-spawn`, `/vpet-freeze`, `/vpet-unfreeze`, and `/vpet-set` now surface
  exclusively as TUI toasts; the session transcript no longer receives command output.
- Usage progression now reconciles completed usage from the v2 session context when a session goes
  idle, instead of reacting to individual message events.
- `init` and `update` now delegate to `opencode plugin add <package>`, replacing
  `opencode plugin <package> --global --force`.
- The build emits a private `dist/package.json` so the built `dist` directory can be registered as
  a local plugin package.

### Removed

- OpenCode v1 plugin hooks and the `@opencode-ai/*` dependencies.

## [0.1.1] - 2026-08-30

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
