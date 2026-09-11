# Monorepo structure

El root (`@sbugallo/opencode-vpet-workspace`) **no se publica en npm** — solo orquesta workspaces.

```
packages/
├── vpet-core/          # @sbugallo/vpet-core (privado, compartido)
│   └── src/adapters/sqlite/   # schema, migraciones, write-store (SqliteExecutor)
├── opencode-vpet/      # @sbugallo/opencode-vpet (publicable en npm)
│   └── src/adapters/sqlite/   # bun-sqlite-driver + factory
└── cursor-vpet/        # extensión Cursor (.vsix)
    └── src/adapters/sqlite/   # sql.js driver + factory
```

## Toolchain (Node + Bun)

| Herramienta | Versión fijada | Uso |
|-------------|----------------|-----|
| **Bun** `1.3.5` | `packageManager`, `engines`, Volta | install, test, build, runtime del plugin OpenCode |
| **Node** `24.11.0` | `engines`, Volta, CI | CLI publicada (`opencode-vpet`), npm publish, VSIX, host de la extensión |

Volta en el root fija ambas versiones al trabajar en el repo:

```bash
volta install node@24.11.0 bun@1.3.5
```

Sin Volta, instala manualmente esas versiones antes de `bun install`.

## Commands (from repo root)

```bash
bun install
bun run check
bun run test
bun run test:persistence
bun run build
bun run --filter '@sbugallo/opencode-vpet' prepack
bun run --filter cursor-vpet package   # produces .vsix
```

## Publicación npm

`@sbugallo/opencode-vpet` empaqueta el JS de `vpet-core` en `dist/` y copia sus declaraciones a `dist/vpet-core/`, de modo que los `.d.ts` publicados no dependen del paquete privado del workspace.

## Cursor extension install (dev)

```bash
cd packages/cursor-vpet
bun run build
bun run package
# In Cursor: Extensions → Install from VSIX
```

## Open VSX / Marketplace (CD)

On release, if configured in GitHub Actions secrets:

- `OVSX_PAT` — publishes to [Open VSX](https://open-vsx.org/extension/sbugallo/cursor-vpet)
- `VSCE_PAT` — publishes to VS Code Marketplace (optional)
