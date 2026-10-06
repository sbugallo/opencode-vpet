# Monorepo

The root workspace is private and coordinates four packages:

| Package | Purpose |
| --- | --- |
| `packages/digital-pet-core` | Shared catalog, evolution rules, and SQLite schema |
| `packages/digital-pet-animation` | Shared animation and artwork logic |
| `packages/opencode-digital-pet` | OpenCode plugin published on npm |
| `packages/cursor-digital-pet` | Cursor extension published on Open VSX |

Cursor and OpenCode use the same local `pet.db` by default. The shared packages are bundled into the products and are not published separately.

## Development

Use Node `24.11.0`, npm `11.6.1`, and Bun `1.3.5`. From the repository root:

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

The two products have independent versions and changelogs:

| Product | Changelog |
| --- | --- |
| OpenCode | [`packages/opencode-digital-pet/CHANGELOG.md`](../packages/opencode-digital-pet/CHANGELOG.md) |
| Cursor | [`packages/cursor-digital-pet/CHANGELOG.md`](../packages/cursor-digital-pet/CHANGELOG.md) |

The release workflows are in [`.github/workflows`](../.github/workflows). The Cursor workflow publishes to Open VSX and attaches the VSIX to a GitHub Release.

## Development tools

The development commands in each host preview feeding, activity, and evolution animations without waiting for live agent usage.

For Cursor, run the extension in an Extension Development Host or enable the `digital-pet.devTools` setting. The command palette then offers **Cursor Digital Pet: Dev Tools**.

For OpenCode, set `OPENCODE_DIGITAL_PET_DEV=1` before starting OpenCode. Its development commands appear under **Digital Pet Dev**.
