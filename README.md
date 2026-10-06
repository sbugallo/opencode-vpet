<div align="center">
  <img src="_images/logo.png" alt="Digital Pet logo" width="160" style="image-rendering: pixelated">
  <h1>Digital Pet</h1>
  <p>A Digimon virtual pet that evolves with AI token usage in Cursor and OpenCode.</p>
</div>

Digital Pet has two apps in one monorepo: a Cursor extension and an OpenCode plugin. Both use the same local SQLite database, so your partner, Dex discoveries, and generation history carry across the two tools. You can use either app on its own.

## Choose your app

| App | What it does | Get started |
| --- | --- | --- |
| [Cursor Digital Pet](packages/cursor-digital-pet/README.md) | Shows your partner in the Explorer sidebar and tracks Cursor Agent usage through hooks, with an API fallback. | [Install from Open VSX](https://open-vsx.org/extension/jcendal/cursor-digital-pet) or use a VSIX from [GitHub Releases](https://github.com/jcendal/digital-pet/releases). Follow the [Cursor setup guide](packages/cursor-digital-pet/README.md#-usage) to install hooks and hatch a partner. |
| [OpenCode Digital Pet](packages/opencode-digital-pet/README.md) | Adds a TUI sidebar and `/digital-pet-*` commands; completed assistant messages provide experience. | Run `npx @jcendal/opencode-digital-pet init`, restart OpenCode, then run `/digital-pet-spawn`. See the [OpenCode guide](packages/opencode-digital-pet/README.md#quick-start). |

The [illustrative OpenCode preview](_images/digital-pet-overview.png) shows the partner, Dex, and history views. Each app's README describes its own commands, requirements, settings, and storage behavior.

## Shared progress and migration

Both apps resolve the same `pet.db` location by default:

| Platform | Database |
| --- | --- |
| macOS | `~/Library/Application Support/opencode-digital-pet/pet.db` |
| Linux / WSL | `~/.local/share/opencode-digital-pet/pet.db` |
| Windows | `%APPDATA%\opencode-digital-pet\pet.db` |

If the new database does not exist but an older `opencode-vpet/pet.db` does, both apps continue using that older database. OpenCode also continues reading an older `opencode-vpet.json` settings file until a new `opencode-digital-pet.json` is created.

If you previously installed `@sbugallo/opencode-vpet` or unscoped `opencode-vpet`, remove its OpenCode registration to avoid loading both plugins. The [OpenCode guide](packages/opencode-digital-pet/README.md#update) has the update command; the [Cursor guide](packages/cursor-digital-pet/README.md#-storage) covers its database override.

## Repository layout

| Workspace | Role |
| --- | --- |
| [`packages/cursor-digital-pet`](packages/cursor-digital-pet) | Cursor extension, packaged as a VSIX |
| [`packages/opencode-digital-pet`](packages/opencode-digital-pet) | `@jcendal/opencode-digital-pet`, npm plugin and CLI |
| [`packages/digital-pet-core`](packages/digital-pet-core) | Shared catalog, evolution rules, use cases, and SQLite schema; private workspace |
| [`packages/digital-pet-animation`](packages/digital-pet-animation) | Shared animation logic; private workspace |

The root workspace is private. The two shared packages are bundled into the products and are not published separately. Cursor and OpenCode have [separate changelogs](CHANGELOG.md) and release versions. See [monorepo documentation](docs/monorepo.md) for development tools and release details.

## Development

Use Node `24.11.0`, npm `11.6.1`, and Bun `1.3.5` (the versions declared by the workspace). npm installs dependencies and runs workspace scripts; Bun runs the tests and the OpenCode plugin at runtime. Builds use Node and esbuild.

```sh
npm ci
npm run check
npm run test
npm run test:persistence
npm run build
```

To create local distributables:

```sh
npm run pack:opencode
npm run package --workspace cursor-digital-pet
```

Contributions and issues belong in the [repository](https://github.com/jcendal/digital-pet). The two product READMEs provide their user guides; [docs/monorepo.md](docs/monorepo.md) lists package-specific development commands.

## Maintainer and credits

- [Jorge Cendal](https://github.com/jcendal), maintainer
- [Sergio Bugallo](https://github.com/sbugallo), original author and contributor

The project is licensed under [Apache 2.0](LICENSE). The bundled sprites were derived from [sundeth/omnipet](https://github.com/sundeth/omnipet/tree/main) and [Tortoiseshel's Full Color Digimon Dot Sprites post](https://withthewill.net/threads/full-color-digimon-dot-sprites.25843/), then edited and processed for this project.
