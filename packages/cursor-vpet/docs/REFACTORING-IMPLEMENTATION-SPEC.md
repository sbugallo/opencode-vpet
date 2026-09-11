# Especificación técnica de refactorización — `cursor-vpet`

| Campo | Valor |
|-------|-------|
| **Paquete** | `packages/cursor-vpet` |
| **Versión del documento** | 1.2 |
| **Fecha** | 2026-09-11 |
| **Estado** | En progreso — ~70 % del plan de refactor completado; `vpet-animation` extraído y consumido por ambos hosts |
| **Alcance** | Refactorización de `cursor-vpet`, cambios coordinados en `vpet-core`, `vpet-animation` y `opencode-vpet` |
| **Último commit relevante** | `324f654` — *refactor: migrate OpenCode and Cursor hosts to vpet-animation* |

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
   - [1.4 Estado de implementación (snapshot)](#14-estado-de-implementación-snapshot)
2. [Contexto y arquitectura actual](#2-contexto-y-arquitectura-actual)
3. [Diferencias entre hosts (OpenCode vs Cursor)](#3-diferencias-entre-hosts-opencode-vs-cursor)
4. [Inventario de problemas por subsistema](#4-inventario-de-problemas-por-subsistema)
5. [Decisiones de diseño](#5-decisiones-de-diseño)
6. [Arquitectura objetivo](#6-arquitectura-objetivo)
7. [Plan de implementación por PR](#7-plan-de-implementación-por-pr)
8. [Especificaciones de módulos nuevos](#8-especificaciones-de-módulos-nuevos)
9. [Estructura de carpetas objetivo](#9-estructura-de-carpetas-objetivo)
10. [Plan de pruebas](#10-plan-de-pruebas)
11. [Riesgos y mitigaciones](#11-riesgos-y-mitigaciones)
12. [Criterios de aceptación globales](#12-criterios-de-aceptación-globales)
13. [Apéndices](#13-apéndices)

---

## 1. Resumen ejecutivo

### 1.1 Objetivo

Refactorizar `cursor-vpet` para:

- Eliminar duplicación de código (interna y cross-package con `opencode-vpet`).
- Aplicar patrones modernos: responsabilidad única, inyección de dependencias, composición explícita.
- Mejorar rendimiento (lectura SQLite, coordinación de refrescos).
- Mantener paridad funcional y compatibilidad con `pet.db` compartida.

### 1.2 Principio rector: separar lógica pura de presentación host-specific

| Capa | Compartir entre hosts | Mantener host-specific |
|------|----------------------|------------------------|
| Dominio y use cases | ✅ `vpet-core` (ya existe) | — |
| Animación idle (state machine) | ✅ `vpet-animation` | — |
| Render ASCII posicionado → `string` | ✅ `vpet-animation` | — |
| Queries SQLite de lectura | ✅ `vpet-core` (parcial) | Drivers (`sql.js` / `bun:sqlite`) |
| Batalla/evolución/derrota visual (ASCII) | ✅ `vpet-animation` | Entrega: OpenTUI vs Webview |
| Entrega al usuario | ❌ | OpenTUI vs Webview |
| HTML / componentes UI | ❌ | Por host |

### 1.3 Estimación

| Fase | PRs | Duración estimada |
|------|-----|-------------------|
| Fundamentos | PR-0, PR-1 | 5–6 días |
| Hooks y animación compartida | PR-2, PR-3 | 7–8 días |
| UI Cursor y artworks | PR-4, PR-5 | 8–10 días |
| Bootstrap y calidad | PR-6, PR-7 | 4–5 días |
| **Total** | **7 PRs** | **~4–6 semanas** |

Cada PR debe ser mergeable de forma independiente, con tests pasando.

### 1.4 Estado de implementación (snapshot)

**Fecha del snapshot:** 2026-09-11  
**Progreso global del plan de refactor (PR-0 … PR-7):** ~70 %

#### Matriz de PRs

| PR | Título | Estado | Notas |
|----|--------|--------|-------|
| PR-0 | Fundamentos y utilidades (`shared/`, eliminar `sqljs-runtime`) | ✅ Completado | `src/shared/{sleep,random,assert-never}.ts`, `adapters/sqlite/{options,errors}.ts`; `sqljs-runtime.ts` eliminado; `CompletedUsage` re-exportado desde vpet-core |
| PR-1 | Capa SQLite | 🟡 Parcial | **Hecho:** repository único con `getSidebarSnapshot()` en memoria; `bootstrap/container.ts` cablea un solo `repository`. **Pendiente:** `sqljs-statement-executor`, mover queries a `vpet-core`, deprecar lectura disco en runtime de paneles |
| PR-2 | Capa Cursor — hooks y usage | 🟡 Parcial | **Hecho:** fix "Not now" en `bootstrap/ensure-hooks.ts`. **Pendiente:** `hook-events-reader`, `onActivity` → animación, caché TTL en `cursor-auth.ts`, desacoplar `DIGIMON_CATALOG` del usage source |
| PR-3 | Paquete `vpet-animation` | ✅ Completado | `packages/vpet-animation/` creado; hosts importan `@sbugallo/vpet-animation`; tests de animación/artwork centralizados en el paquete |
| PR-4 | Artworks de batalla/evolución | 🟡 Parcial | Artworks y sessions viven en `vpet-animation` (sin duplicación cross-host). **Pendiente:** `evolution-battle-artwork.ts` sigue en 480 líneas (objetivo &lt;400); sin `frame-utils.ts` / `animation-runner.ts` |
| PR-5 | Webview y sidebar — descomposición | 🟡 Parcial | **Hecho:** `sidebar-presenter.ts`, `sidebar-animation-host.ts`, `sidebar-orchestrator.ts`, `shared/escape-html.ts`, cola `async-refresh-queue.ts`, tests de sidebar. **Pendiente:** `sidebar/provider.ts` = 143 líneas (objetivo &lt;100); sin `panel-factory.ts` ni template HTML separado |
| PR-6 | Extension bootstrap | 🟡 Parcial | **Hecho:** `extension.ts` = 41 líneas; `bootstrap/{container,register-commands,register-sidebar,ensure-hooks}.ts`. **Pendiente:** `create-vpet-services.ts` unificado, poll loop coordinado (sigue `setInterval` 30s), usage pipeline aún en `extension.ts` |
| PR-7 | Calidad y architecture boundaries | 🟡 Parcial | **Hecho:** `tests/architecture-boundary.test.ts`, `tests/hexagonal-boundary.test.ts`, helpers compartidos. **Pendiente:** `hook-events-reader.test.ts`, `register-commands.test.ts` |

#### Presentación compartida (`vpet-animation`)

La duplicación cross-host de animación idle, artworks y sessions se resolvió en `324f654`:

| Módulo | Ubicación actual | Hosts |
|--------|------------------|-------|
| `monster-animation`, policies, mirror | `vpet-animation/src/idle/` | Import vía `@sbugallo/vpet-animation/idle/*` |
| `positioned-artwork` | `vpet-animation/src/render/` | Cursor: `sidebar-animation-host`; OpenCode: `sidebar-card.tsx` |
| `evolution-*`, `defeat-artwork` | `vpet-animation/src/sequences/` | Orquestación en `sidebar-orchestrator` / `tui.tsx` |
| `evolution-battle-session`, `evolution-reveal-session` | `vpet-animation/src/sessions/` | Ambos hosts |

OpenCode empaqueta fuentes staged en `build/vpet-animation-src/` para `npm pack` sin monorepo.

#### Problemas del inventario §4 — resueltos o mitigados

| ID | Estado | Evidencia |
|----|--------|-----------|
| EXT-01 | ✅ Mitigado | `extension.ts` delega en `bootstrap/*` (41 líneas) |
| EXT-03 | ✅ Resuelto | Un solo `repository` en `bootstrap/container.ts` |
| EXT-08 | 🟡 Parcial | "Not now" no marca hooks instalados; aún se marca `true` sin verificar éxito de `installVpetHooks` |
| SQL-04 | 🟡 Parcial | Runtime del sidebar lee del executor en memoria; paneles Dex/History siguen abriendo DB en disco |
| SQL-13 | 🟡 Parcial | Watcher llama `reloadFromDisk()`; snapshot coherente vía mismo executor tras reload |
| WV-01 | ✅ Mitigado | Provider descompuesto en presenter + animation-host + orchestrator |
| WV-02 | ✅ Mitigado | `refresh()` usa cola `async-refresh-queue` sin recursión |
| WV-03 | 🟡 Parcial | Notificaciones VS Code siguen en orchestrator (aceptable por ahora) |

#### Tests actuales (`packages/cursor-vpet/tests/`)

| Archivo | Cubre |
|---------|-------|
| `architecture-boundary.test.ts`, `hexagonal-boundary.test.ts` | Límites hexagonales y dependencias prohibidas |
| `sidebar-presenter.test.ts`, `sidebar/sidebar-orchestrator.test.ts` | Presentación y orquestación sidebar |
| `sidebar/sidebar-animation-host.test.ts`, `sidebar/sidebar-provider.test.ts` | Tick animación y provider |
| `escape-html.test.ts` | Escape HTML en paneles |
| `sidebar-render.test.ts`, `webview-messages.test.ts` | Render webview y mensajes |
| `cursor-*`, `database-change-watcher.test.ts`, `record-usage.test.ts` | Hooks, watermark, watcher, usage |
| `persistence/*.test.ts` | Persistencia sql.js |

**Tests de animación/artwork:** viven en `packages/vpet-animation/tests/` (no duplicados en cursor-vpet).

**Ausentes respecto al plan:** `hook-events-reader`, `register-commands.test.ts`.

---

## 2. Contexto y arquitectura actual

### 2.1 Estructura del paquete (45 archivos `.ts` en `src/`)

```
packages/cursor-vpet/
├── src/
│   ├── extension.ts                    # Composition root delgado (41 líneas)
│   ├── bootstrap/
│   │   ├── container.ts                # DI: repository, sidebar, refresh
│   │   ├── register-commands.ts
│   │   ├── register-sidebar.ts
│   │   └── ensure-hooks.ts
│   ├── application/
│   │   └── usage-pipeline.ts
│   ├── config/
│   │   └── extension-settings.ts
│   ├── shared/
│   │   ├── sleep.ts, random.ts, assert-never.ts, escape-html.ts
│   │   ├── async-refresh-queue.ts
│   │   └── constants/                  # Solo host-specific (sidebar-ui, sqlite, cursor)
│   ├── adapters/
│   │   ├── cursor/                     # Hooks, API watermark, auth
│   │   ├── sqlite/                     # sql.js driver, readers, watcher, write-store
│   │   └── vscode/                     # notification-port, webview-messenger, scheduler
│   └── webview/
│       ├── vpet-sidebar-provider.ts    # Reexport de sidebar/provider.ts
│       ├── sidebar/
│       │   ├── provider.ts             # WebviewView (143 líneas)
│       │   ├── sidebar-presenter.ts
│       │   ├── sidebar-animation-host.ts
│       │   ├── sidebar-orchestrator.ts
│       │   ├── sidebar-render.ts
│       │   └── webview-messages.ts
│       └── panels/                       # dex-panel, history-panel (HTML escapado)
├── tests/                              # 22 archivos de test
├── hook-bridge.js
├── scripts/build.ts
└── package.json
```

**Dependencia de presentación:** `@sbugallo/vpet-animation` (idle, render, sequences, sessions).

### 2.2 Dependencias

| Dependencia | Uso |
|-------------|-----|
| `@sbugallo/vpet-core` | Dominio, use cases, view models, catálogo |
| `@sbugallo/vpet-animation` | Animación idle, artworks ASCII, sessions batalla/reveal |
| `sql.js` | SQLite en memoria (VS Code extension, sin native modules) |
| `vscode` | API de extensión (external en build) |

### 2.3 Flujo de datos actual

```
Cursor Hooks (hook-bridge.js)
    → vpet-hook-events.jsonl
    → cursor-usage-event-source (file watcher)
    → recordUsage (vpet-core)
    → sqlite repository (sql.js, writable, única conexión)
    → database-change-watcher (reloadFromDisk + refresh si no hay presentación)
    → refresh sidebar

Sidebar refresh (VpetSidebarProvider.refresh):
    → repository.getSidebarSnapshot()          # executor en memoria, sin readFileSync
    → resolvePendingBattleIfNeeded
        → runEvolutionBattleSession
            → runEvolutionBattleAnimation
            → runEvolutionRevealSession | runDefeatAnimation
            → resolveEvolutionBattleForPartner
    → playPendingEvolutionReveal               # evolución directa (p. ej. Digitama)
        → runEvolutionRevealSession
    → publishSidebarModel
    → postMessage → webview

Usage con evolución directa (sin batalla):
    → onApplied callback en extension.ts
    → sidebarProvider.queueEvolutionReveal(evolution)
    → refresh → playPendingEvolutionReveal

Animación idle:
    → MonsterAnimationController (tick 500ms, pausado durante presentación)
    → renderPositionedArtwork
    → postMessage { type: "animation-frame" }

Lectura one-shot (paneles Dex/History, tests persistencia):
    → readArchive / readSidebarSnapshot / createSqliteSidebarSnapshotReader
    → abre sql.js desde disco en cada llamada  # pendiente de eliminar en runtime
```

### 2.4 Lo que ya está bien

- Dominio delegado correctamente a `vpet-core`.
- Presentación ASCII compartida en `@sbugallo/vpet-animation` (sin duplicación cross-host).
- Puertos/adaptadores: `UsageLedger`, `SidebarSnapshotReader`, `EvolutionBattleRepository`.
- `MonsterAnimationController` y artworks como lógica pura en `vpet-animation`.
- Tests de animación/artwork centralizados en `packages/vpet-animation/tests/`.
- Separación `adapters/` vs `webview/sidebar/` vs `bootstrap/`.
- Repository único en `bootstrap/container.ts` (escritura + snapshot + batalla).
- Sidebar descompuesto: presenter, animation-host, orchestrator.
- Refresh del sidebar con cola y sin recursión; presentaciones bloquean watcher y tick idle.
- Paneles Dex/History con `escapeHtml`.
- Sincronización multi-ventana de `pet.db` vía `database-change-watcher` + `reloadFromDisk`.

---

## 3. Diferencias entre hosts (OpenCode vs Cursor)

### 3.1 Tabla comparativa tecnológica

| Aspecto | OpenCode (`opencode-vpet`) | Cursor (`cursor-vpet`) |
|---------|---------------------------|------------------------|
| **Runtime** | Bun + `bun:sqlite` | Node 24 + `sql.js` (WASM) |
| **UI** | SolidJS + OpenTUI (`<text>`, `<box>`) | VS Code Webview (HTML/CSS/JS) |
| **Estado animación** | `createSignal<MonsterAnimationOutput>` | Campos privados + `postMessage` |
| **Tick visual** | `setInterval` 500ms → `requestRender()` | `setInterval` 500ms → `postMessage` |
| **Ancho viewport** | `onSizeChange` en `BoxRenderable` | `ResizeObserver` + medición char width en cliente |
| **Actividad usuario** | Eventos `message.updated`, `session.status` → `dispatch(activity)` | ❌ No implementado |
| **Poll de datos** | `createSidebarPollLoop` (con `refreshPending`) | `setInterval` 30s bruto + eventos ad hoc |
| **Batalla evolución** | `runEvolutionBattleSession` en `tui.tsx` + toast | `runEvolutionBattleSession` en sidebar provider |
| **Evolución visual** | `runEvolutionRevealSession` tras victoria o evolución directa | Igual vía webview + `queueEvolutionReveal` |
| **Derrota visual** | `runDefeatAnimation` tras derrota en batalla | Igual vía webview |
| **Usage tracking** | OpenCode SDK events + `reconcileUsage` | Cursor hooks + API watermark fallback |
| **Dex / History** | Diálogos OpenTUI | Webview panels |

### 3.2 Divergencia de producto: batalla de evolución (actualizada 2026-09)

**Estado actual:** Ambos hosts reproducen batalla visual ASCII antes de persistir el resultado. La divergencia es de **entrega** (OpenTUI vs Webview), no de producto.

**OpenCode** (`tui.tsx` + `@sbugallo/vpet-animation/sessions/evolution-battle-session.ts`):

```typescript
await runEvolutionBattleSession(snapshot, artworkWidth, {
  frameCatalog, digimonCatalog, repository,
  onArtwork: (artwork) => setCustomArtwork(artwork),
})
// Toast de notificación vía server hooks; animación en sidebar TUI
```

**Cursor** (`webview/sidebar/sidebar-orchestrator.ts` + `@sbugallo/vpet-animation/sessions/evolution-battle-session.ts`):

```typescript
await runEvolutionBattleSession(snapshot, this.artworkWidth, {
  frameCatalog, digimonCatalog, repository,
  onArtwork: async (artwork) => this.postArtwork(artwork),
  onResolved: async (result) => { /* VS Code notifications */ },
})
```

**Server hooks OpenCode** (`create-server-hooks.ts`): solo emiten toast `evolution_battle` cuando `evolutionBattlePending`; la animación la ejecuta el TUI en el siguiente refresh.

**Decisión vigente:** Mantener orquestación host-specific; presentación ASCII compartida en `@sbugallo/vpet-animation` (completado en `324f654`).

### 3.3 Código extraído a `vpet-animation` (completado)

| Módulo anterior (cursor / opencode) | Ubicación actual | Estado |
|-------------------------------------|------------------|--------|
| `monster-animation.ts`, policies, mirror | `vpet-animation/src/idle/` | ✅ Extraído |
| `animated-artwork.ts` / `artworkRows` | `vpet-animation/src/render/positioned-artwork.ts` | ✅ Unificado |
| `evolution-battle-session.ts`, `evolution-reveal-session.ts` | `vpet-animation/src/sessions/` | ✅ Extraído |
| `evolution-battle-artwork.ts` (480 líneas) | `vpet-animation/src/sequences/` | ✅ Extraído; 🟡 refactor interno pendiente (&lt;400 líneas) |
| `evolution-artwork.ts`, `defeat-artwork.ts` | `vpet-animation/src/sequences/` | ✅ Extraído |
| Constantes `presentation-timing`, `evolution-battle`, `monster-artwork` | `vpet-animation/src/constants/` | ✅ Extraído |

### 3.4 Código exclusivo por host (NO compartir tal cual)

| Módulo | Host | Líneas aprox. | Razón |
|--------|------|---------------|-------|
| `sidebar-render.ts` | Cursor | ~214 | HTML/CSS/JS webview |
| `webview/sidebar/provider.ts` | Cursor | 143 | Orquestación VS Code WebviewView |
| `webview/sidebar/sidebar-orchestrator.ts` | Cursor | — | Batalla/reveal/defeat vía `vpet-animation` |
| `dex-panel.ts`, `history-panel.ts` | Cursor | ~35 c/u | Webview panels |
| `adapters/cursor/*` | Cursor | — | Integración Cursor-specific |
| `tui.tsx`, `sidebar-card.tsx` | OpenCode | — | Composición OpenTUI / SolidJS |
| `adapters/opencode/*` | OpenCode | — | Server hooks, toasts, SDK |

---

## 4. Inventario de problemas por subsistema

### 4.1 `extension.ts` — Composition root

**Archivo:** `src/extension.ts` (41 líneas)

| ID | Problema | Severidad | Impacto | Estado |
|----|----------|-----------|---------|--------|
| EXT-01 | Monolito de wiring; difícil de testear `activate` | Media | Mantenibilidad | ✅ Mitigado — `bootstrap/*` + `usage-pipeline.ts` |
| EXT-02 | 8 comandos con patrón repetido: `run → showInformationMessage → refreshSidebar` | Baja | Duplicación | 🟡 Parcial — `register-commands.ts` centraliza registro |
| EXT-03 | Dos conexiones DB: `repository` + `snapshotReader` independientes | Alta | Rendimiento, consistencia | ✅ Resuelto — un solo `repository` en `container.ts` |
| EXT-04 | Triple fuente de refresh sin coordinación: usage events + DB watcher + poll 30s | Media | Renders redundantes | 🟡 Parcial — watcher respeta `isPresentationInProgress()`; poll 30s sin coordinar |
| EXT-05 | `onDidChangeConfiguration` avisa "reload window" pero no recarga DB | Media | UX incorrecta | ❌ Pendiente |
| EXT-06 | `sidebarProvider` como variable module-level mutable | Baja | Testabilidad | ✅ Mitigado — vive en `VpetContainer`, no en module scope |
| EXT-07 | Instalación hooks duplicada: `ensureHooksInstalled` vs comando `installHooks` | Media | Duplicación | 🟡 Parcial — `ensure-hooks.ts` separado; lógica aún duplicada con comando |
| EXT-08 | **Bug:** `ensureHooksInstalled` marca `hooksInstalled=true` incorrectamente | Alta | Estado incorrecto | 🟡 Parcial — "Not now" OK; falta validar éxito del install |

**Código problemático EXT-08:**

```typescript
// extension.ts líneas 25-39
const choice = await vscode.window.showInformationMessage(...)
if (choice !== "Install hooks") return
// ...
await context.globalState.update(key, true)  // OK — solo tras install

// Pero si el usuario elige "Install hooks", se marca true incluso si install falla silenciosamente
```

Corrección: marcar `true` solo tras `installVpetHooks` exitoso; nunca marcar en "Not now".

---

### 4.2 Capa SQLite (`adapters/sqlite/`)

#### 4.2.1 `sqljs-driver.ts`

| ID | Problema | Severidad |
|----|----------|-----------|
| SQL-01 | `createWritableExecutor` y `createReadonlyExecutor` duplican ~40 líneas de `prepare/bind/step/getAsObject/free` | Media |
| SQL-02 | Writable hace `reloadIfStale` en cada operación; costoso pero necesario para multi-proceso | Info |
| SQL-03 | Sin `PRAGMA busy_timeout` ni WAL (diferente a bun driver) | Baja |

#### 4.2.2 `sqlite-sidebar-snapshot-reader.ts`

| ID | Problema | Severidad | Estado |
|----|----------|-----------|--------|
| SQL-04 | **Abre nueva conexión sql.js y lee archivo completo en cada lectura disco** | Alta | 🟡 Mitigado en runtime sidebar (repository); persiste en `readSidebarSnapshot` / paneles |
| SQL-05 | `readSidebarSnapshotFromExecutor` es correcta pero lógica duplicada inline en opencode-vpet | Alta |
| SQL-06 | `isRecoverableSqliteReadError` con string matching frágil en mensajes de error | Media |
| SQL-07 | `createSqliteSidebarSnapshotReader` y `readSidebarSnapshot` — dos APIs para lo mismo | Baja |

**Código problemático SQL-04:**

```typescript
const readSidebarSnapshotWithRuntime = (SQL, databasePath) => {
  const database = new SQL.Database(readFileSync(databasePath))  // I/O + parse cada vez
  try { ... } finally { database.close() }
}
```

#### 4.2.3 `sqlite-vpet-archive-reader.ts`

| ID | Problema | Severidad |
|----|----------|-----------|
| SQL-08 | `toArchiveEvent`, `groupEventsByPartnerId`, `readSqliteVpetArchive` duplicados en opencode-vpet | Alta |
| SQL-09 | `dex-panel` / `history-panel` usan `readArchive` one-shot (abre DB cada vez) | Media |
| SQL-10 | `createSqliteVpetArchiveReader` vs `readArchive` — APIs redundantes | Baja |

#### 4.2.4 `sqljs-runtime.ts`

| ID | Problema | Severidad |
|----|----------|-----------|
| SQL-11 | **Código muerto:** `openDatabaseFromPath` no importado en ningún sitio | Baja |

#### 4.2.5 `database-change-watcher.ts`

| ID | Problema | Severidad |
|----|----------|-----------|
| SQL-12 | Bien diseñado (debounce 200ms, dispose) | — |
| SQL-13 | Al cambiar DB llama `repository.reloadFromDisk()` pero snapshotReader sigue leyendo disco aparte | Alta |

#### 4.2.6 Tipos repetidos

| ID | Problema |
|----|----------|
| SQL-14 | `CreateSqliteVpetRepositoryOptions`, `CreateSqliteSidebarSnapshotReaderOptions`, `CreateSqliteVpetArchiveReaderOptions`, `DatabaseChangeWatcherOptions` — todos alias de `HostPathOptions & { databasePath?: string }` |

---

### 4.3 Capa Cursor (`adapters/cursor/`)

#### 4.3.1 `cursor-usage-event-source.ts`

| ID | Problema | Severidad |
|----|----------|-----------|
| CUR-01 | Acoplamiento directo a `DIGIMON_CATALOG`, `STAGE_GAUGE_THRESHOLDS` — debería inyectarse | Media |
| CUR-02 | File watcher por offset; corrupto si archivo se trunca/rota | Media |
| CUR-03 | `processedReceipts` Set sin límite — crece en sesiones largas | Media |
| CUR-04 | `console.log` en producción sin nivel configurable | Baja |
| CUR-05 | No dispara evento `activity` al animation controller | Alta |

#### 4.3.2 `cursor-api-watermark.ts`

| ID | Problema | Severidad |
|----|----------|-----------|
| CUR-06 | Bien estructurado; funciones puras testeables | — |
| CUR-07 | `sleep` duplicado (también en artwork files) | Baja |
| CUR-08 | `captureWatermark` fallback `Date.now()` puede dar watermarks inconsistentes sin token | Media |

#### 4.3.3 `cursor-auth.ts`

| ID | Problema | Severidad |
|----|----------|-----------|
| CUR-09 | Abre `state.vscdb` con sql.js en cada llamada API | Media |
| CUR-10 | Sin caché de access token | Media |
| CUR-11 | `queryItemTable` duplica patrón prepare/bind del driver | Baja |

#### 4.3.4 `types.ts`

| ID | Problema | Severidad |
|----|----------|-----------|
| CUR-12 | `CompletedUsage` duplica `vpet-core/application/use-cases/record-usage.ts` | Media |

#### 4.3.5 `install-hooks.ts` + `hook-bridge.js`

| ID | Problema | Severidad |
|----|----------|-----------|
| CUR-13 | Ruta eventos duplicada: `paths.ts` vs constante en `hook-bridge.js` | Media |
| CUR-14 | `hook-bridge.js` fuera del bundle; puede desincronizarse del paquete | Media |

---

### 4.4 Webview — Sidebar (`webview/`)

#### 4.4.1 `webview/sidebar/provider.ts` (143 líneas)

| ID | Problema | Severidad | Estado |
|----|----------|-----------|--------|
| WV-01 | Responsabilidades mezcladas en una clase | Alta | ✅ Mitigado — presenter, animation-host y orchestrator extraídos |
| WV-02 | `refresh()` recursivo tras batalla | Media | ✅ Resuelto — `async-refresh-queue` |
| WV-03 | Notificaciones VS Code mezcladas con lógica de animación | Baja | 🟡 Parcial — notificaciones en orchestrator |
| WV-04 | `Math.random()` inline para outcome de batalla | Baja | 🟡 Parcial — inyectable en session |

**Responsabilidades restantes en `provider.ts`:**

1. Ciclo de vida `WebviewView` (VS Code API)
2. Cache `cachedPayload` / `cachedArtwork`
3. Handlers mensajes webview (`open-url`, `artwork-width`)
4. Delegación a presenter, animation-host y orchestrator

#### 4.4.2 `sidebar-render.ts`

| ID | Problema | Severidad |
|----|----------|-----------|
| WV-05 | ~140 líneas HTML/JS inline sin syntax highlighting | Media |
| WV-06 | CSP nonce = `String(Date.now())` — no es nonce criptográfico | Baja |
| WV-07 | `pixelWidthToArtworkColumns` duplicado en TS y en `<script>` cliente | Media |
| WV-08 | `buildNextCheckLine` barra fija 20 chars; OpenCode usa ancho adaptativo | Info |
| WV-09 | Sin tests del script cliente | Media |

#### 4.4.3 `dex-panel.ts` + `history-panel.ts`

| ID | Problema | Severidad |
|----|----------|-----------|
| WV-10 | Copy-paste estructural entre ambos paneles | Media |
| WV-11 | **XSS:** `${row.name}` sin escapar HTML | Alta | ✅ Resuelto — `escapeHtml` |
| WV-12 | Sin Content-Security-Policy | Media |
| WV-13 | `readArchive` one-shot en cada apertura de panel | Media |

---

### 4.5 Artworks y animaciones especiales — movidos a `vpet-animation`

Los artworks y sessions ya no viven en `cursor-vpet`. Quedan en `packages/vpet-animation/src/{sequences,sessions}/`.

#### 4.5.1 Pendiente en `vpet-animation`

| ID | Problema | Severidad | Estado |
|----|----------|-----------|--------|
| ART-01 | Mezcla planificación, render y orquestación temporal en battle artwork | Media | 🟡 Abierto |
| ART-02 | `planEvolutionBattle` + `rollShotHit` candidatos a `vpet-core` | Info | ❌ Pendiente |
| ART-03 | `evolution-battle-artwork.ts` = 480 líneas (objetivo &lt;400) | Media | 🟡 Abierto |

---

### 4.6 Animación idle

| ID | Problema | Severidad | Estado |
|----|----------|-----------|--------|
| ANI-01 | `MonsterAnimationController` duplicado cursor ↔ opencode | Alta | ✅ Resuelto — `vpet-animation` |
| ANI-02 | `renderPositionedArtwork` vs `artworkRows` | Alta | ✅ Resuelto — `positioned-artwork.ts` |
| ANI-03 | `normalizedRandom` duplicado en cursor-vpet | Baja | ✅ Resuelto — `shared/random.ts` + `vpet-animation` |
| ANI-04 | `assertNever` duplicado | Baja | ✅ Resuelto — `shared/assert-never.ts` + `vpet-animation` |
| ANI-05 | `nextWalkFrame` en dos módulos | Baja | ✅ Aceptable dentro de `vpet-animation` |
| ANI-06 | Cursor no dispara `activity` — monstruo duerme con Agent activo | Alta | ❌ Pendiente (PR-2) |
| ANI-07 | OpenCode deduplica con `sameAnimation`; Cursor compara string renderizado | Baja | 🟡 Parcial |

---

### 4.7 Calidad y gobernanza

| ID | Problema | Severidad | Estado |
|----|----------|-----------|--------|
| QA-01 | Sin tests de architecture boundaries | Alta | ✅ Resuelto — `architecture-boundary.test.ts`, `hexagonal-boundary.test.ts` |
| QA-02 | Sin tests de `VpetSidebarProvider` | Alta | ✅ Resuelto — `sidebar/sidebar-provider.test.ts` |
| QA-03 | Sin tests de wiring `extension.ts` | Media | ❌ Pendiente |
| QA-04 | Sin tests de `escapeHtml` / paneles | Alta | ✅ Resuelto — `escape-html.test.ts` |

---

## 5. Decisiones de diseño

### 5.1 Decisiones tomadas

| ID | Decisión | Justificación |
|----|----------|---------------|
| D-01 | Crear paquete `vpet-animation` (no `vpet-presentation`) | Solo lógica pura sin dependencias de UI host |
| D-02 | Artworks battle/evolution/defeat en `vpet-animation` | ✅ Implementado — entrega host-specific vía `onArtwork` / `postMessage` |
| D-03 | Mover queries SQLite de lectura a `vpet-core` | Una sola fuente de verdad para esquema |
| D-04 | Snapshot lee del executor del repository en memoria | Elimina I/O repetido y segunda conexión |
| D-05 | Refactor incremental por PRs mergeables | Reduce riesgo de regresión |
| D-06 | Mantener `hook-bridge.js` como script Node separado | Requerimiento de Cursor hooks (stdin/stdout) |
| D-07 | **Estilo arquitectónico:** Functional Core + Imperative Shell + Hexagonal + MVP/Presenter | Ver [CODEBASE-ANALYSIS.md §15](./CODEBASE-ANALYSIS.md#15-decisión-arquitectónica-adoptada); evolución incremental, no rewrite |
| D-08 | Paquete `vpet-animation` para presentación compartida (ampliar D-01) | Incluye artworks + sessions además de idle animation; elimina ~1.400 LOC duplicadas |
| D-09 | Inyección manual de dependencias (sin IoC container) | `SidebarHostDeps` equivalente a `TuiSchedulingOptions` de OpenCode |
| D-10 | `src/shared/` para utilidades host-only puras | `sleep`, `random`, `assertNever` en shared; duplicados también en `vpet-animation/utils/` |

### 5.2 Decisiones pendientes (requieren input)

| ID | Pregunta | Opciones | Recomendación |
|----|----------|----------|---------------|
| P-01 | ¿Barra de progreso adaptativa o fija (20 chars)? | A) Adaptativa como OpenCode B) Fija 20 chars | A — mejor UX en sidebar ancho |
| P-02 | ¿Hot-reload de `vpet.databasePath`? | A) Dispose + recreate B) Mantener "reload window" | A — mejor UX |
| P-03 | ¿Mover `planEvolutionBattle` a vpet-core? | A) Sí B) No | A — es dominio puro |
| P-04 | ¿Extraer artworks + sessions a paquete compartido? | A) `vpet-animation` ampliado B) `vpet-presentation` C) Mantener duplicado | ✅ **A** — completado en `324f654` |

---

## 6. Arquitectura objetivo

### 6.1 Diagrama de capas

```
┌─────────────────────────────────────────────────────────────────┐
│                        vpet-core (ampliado)                      │
│  use-cases │ view-models │ sidebar-snapshot-queries │ archive   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                     vpet-animation (HECHO)                       │
│  idle │ render/positioned-artwork │ sequences │ sessions       │
└───────────────┬─────────────────────────────────┬───────────────┘
                │                                 │
    ┌───────────▼──────────┐          ┌───────────▼──────────────┐
    │    opencode-vpet     │          │      cursor-vpet         │
    │  tui/sidebar-card    │          │  webview/sidebar/*       │
    │  bun-sqlite-driver   │          │  sqljs-driver            │
    │  server hooks        │          │  cursor adapters         │
    └──────────────────────┘          └──────────────────────────┘
```

### 6.2 Flujo de datos objetivo (Cursor)

```
Hooks → usage-event-source → recordUsage → repository (sql.js)
                                              │
                    ┌─────────────────────────┤
                    │ reloadFromDisk()        │ getSidebarSnapshot()
                    ▼                         ▼
              database-watcher          SidebarPresenter
                                              │
                    ┌─────────────────────────┤
                    │ onActivity              │ payload
                    ▼                         ▼
         MonsterAnimationController    webview.postMessage
                    │
                    ▼
         SidebarAnimationHost → postMessage (artwork)

Batalla pendiente → EvolutionBattleOrchestrator
                    → evolution-battle-artwork (visual)
                    → resolveEvolutionBattleForPartner
```

### 6.3 Interfaz `AnimationSink` (abstracción host-specific)

```typescript
/** Abstrae la entrega de frames al usuario. Implementaciones: Webview, Test mock. */
export interface AnimationSink {
  postArtwork(artwork: string): Promise<void>
  postModel(payload: SidebarWebviewPayload): Promise<void>
}

/** Implementación Cursor */
export class WebviewAnimationSink implements AnimationSink {
  constructor(private readonly webview: vscode.Webview) {}
  async postArtwork(artwork: string): Promise<void> {
    await this.webview.postMessage({ type: "animation-frame", artwork })
  }
  async postModel(payload: SidebarWebviewPayload): Promise<void> {
    await this.webview.postMessage(payload)
  }
}
```

---

## 7. Plan de implementación por PR

### PR-0: Fundamentos y utilidades — ✅ Completado

**Duración:** 1–2 días  
**Riesgo:** Bajo  
**Dependencias:** Ninguna

#### Alcance

| Acción | Archivo |
|--------|---------|
| Eliminar | `src/adapters/sqlite/sqljs-runtime.ts` |
| Crear | `src/shared/sleep.ts` |
| Crear | `src/shared/random.ts` |
| Crear | `src/shared/assert-never.ts` |
| Crear | `src/adapters/sqlite/options.ts` |
| Crear | `src/adapters/sqlite/errors.ts` |
| Modificar | `src/adapters/cursor/types.ts` — importar `CompletedUsage` de vpet-core |
| Modificar | 4 archivos artwork + `cursor-api-watermark.ts` — usar `shared/sleep` |
| Modificar | `monster-action-policy.ts`, `monster-walking-policy.ts` — usar `shared/random` |

#### Especificación `shared/random.ts`

```typescript
/** Returns value in [0, 1) safe for index selection. */
export const normalizedRandom = (random: () => number): number => {
  const sample = random()
  if (!Number.isFinite(sample) || sample <= 0) return 0
  return sample >= 1 ? 1 - Number.EPSILON : sample
}
```

#### Especificación `adapters/sqlite/options.ts`

```typescript
import type { HostPathOptions } from "@sbugallo/vpet-core/adapters/sqlite/app-data-path.ts"

export type SqliteDatabaseOptions = HostPathOptions & {
  readonly databasePath?: string
}

export const resolveDatabasePath = (options: SqliteDatabaseOptions): string =>
  options.databasePath ?? resolveHostDatabasePath(options)
```

#### Criterios de aceptación PR-0

- [x] `bun test` pasa sin cambios de comportamiento (32/32)
- [x] `bun run check` pasa
- [x] No queda `sqljs-runtime.ts`
- [x] `CompletedUsage` no está definido localmente en `types.ts` (re-export desde `vpet-core`)
- [x] `src/shared/sleep.ts`, `random.ts`, `assert-never.ts` creados y usados
- [x] `src/adapters/sqlite/options.ts`, `errors.ts` creados y usados

---

### PR-1: Capa SQLite

**Duración:** 3–4 días  
**Riesgo:** Medio  
**Dependencias:** PR-0

#### PR-1a: Executor base sql.js

**Crear:** `src/adapters/sqlite/sqljs-statement-executor.ts`

```typescript
import type { Database } from "sql.js"
import type { QueryValue, SqliteExecutor } from "@sbugallo/vpet-core/ports/sqlite-executor.ts"

export const createStatementExecutor = (
  database: Database,
): Pick<SqliteExecutor, "get" | "all"> => ({
  get<TRow extends Record<string, QueryValue>>(sql: string, params: readonly QueryValue[] = []) {
    const statement = database.prepare(sql)
    statement.bind(Array.from(params))
    if (!statement.step()) {
      statement.free()
      return null
    }
    const row = statement.getAsObject() as TRow
    statement.free()
    return row
  },
  all<TRow extends Record<string, QueryValue>>(sql: string, params: readonly QueryValue[] = []) {
    const statement = database.prepare(sql)
    statement.bind(Array.from(params))
    const rows: TRow[] = []
    while (statement.step()) {
      rows.push(statement.getAsObject() as TRow)
    }
    statement.free()
    return rows
  },
})
```

**Modificar:** `sqljs-driver.ts` — usar `createStatementExecutor` en writable y readonly.

#### PR-1b: Queries en vpet-core

**Crear en `vpet-core`:**

```
src/adapters/sqlite/
├── sidebar-snapshot-queries.ts
└── archive-queries.ts
```

**`sidebar-snapshot-queries.ts`:**

```typescript
export const TRAINER_STATE_SELECT = "SELECT total_tokens FROM trainer_state WHERE trainer_id = 1"
export const CONTROL_STATE_SELECT = "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1"

export const readSidebarSnapshotFromExecutor = (
  executor: Pick<SqliteExecutor, "get">,
): SidebarSnapshot | null => { /* mover lógica actual */ }
```

**`archive-queries.ts`:**

```typescript
export const readSqliteVpetArchive = (
  executor: Pick<SqliteExecutor, "all">,
): VpetArchiveResult => { /* mover lógica actual */ }

export const toArchiveEvent = ...
export const toArchivePartner = ...
export const groupEventsByPartnerId = ...
```

**Actualizar:** `opencode-vpet` para importar desde vpet-core (PR coordinado o mismo merge window).

#### PR-1c: Repository como SnapshotReader

**Modificar:** `sqlite-vpet-write-store.ts`

```typescript
export type CursorSqliteVpetRepository = SqliteVpetWriteStore &
  EvolutionBattleRepository &
  SidebarSnapshotReader & {
    reloadFromDisk(): void
  }
```

El repository expone `getSidebarSnapshot()` leyendo del executor en memoria (tras `reloadIfStale` interno del driver).

**Modificar:** `extension.ts` — eliminar `createSqliteSidebarSnapshotReader` separado.

**Deprecar:** `sqlite-sidebar-snapshot-reader.ts` — mantener `readSidebarSnapshot` como thin wrapper para tests de persistencia si necesario.

#### Criterios de aceptación PR-1

- [x] Tests persistencia sql.js pasan
- [x] `extension.ts` usa una sola conexión DB
- [x] `getSidebarSnapshot` del repository no hace `readFileSync` en cada llamada (runtime sidebar)
- [ ] `readSidebarSnapshot` / paneles dejan de abrir DB en disco (o usan repository inyectado)
- [ ] opencode-vpet usa queries de vpet-core
- [ ] `createStatementExecutor` elimina duplicación en driver

---

### PR-2: Capa Cursor — hooks y usage

**Duración:** 2–3 días  
**Riesgo:** Medio  
**Dependencias:** PR-0

#### Alcance

| Acción | Detalle |
|--------|---------|
| Crear | `bootstrap/hooks-bootstrap.ts` |
| Crear | `adapters/cursor/hook-events-reader.ts` |
| Modificar | `cursor-usage-event-source.ts` — inyectar deps, `onActivity` callback |
| Modificar | `cursor-auth.ts` — caché token TTL 60s |
| Fix | EXT-08: no marcar hooks instalados en "Not now" |
| Modificar | `extension.ts` — conectar `onActivity` → sidebar animation |

#### Especificación `hook-events-reader.ts`

```typescript
export type HookEventsReaderOptions = {
  readonly eventsPath: string
  readonly onLine: (line: string) => Promise<void>
  readonly onError?: (error: unknown) => void
}

export type HookEventsReader = { dispose(): void }

export const createHookEventsReader = (options: HookEventsReaderOptions): HookEventsReader
```

Extrae lógica de file watch + offset de `cursor-usage-event-source.ts` para testabilidad.

#### Especificación inyección deps en usage source

```typescript
export type CursorUsageEventSourceDeps = {
  readonly ledger: UsageLedger
  readonly catalog: DigimonCatalog
  readonly thresholds: StageThresholds
  readonly onApplied?: () => void
  readonly onActivity?: () => void  // NUEVO
}

export const createCursorUsageEventSource = (
  deps: CursorUsageEventSourceDeps,
  options?: CursorUsageSettleOptions & { eventsPath?: string },
): CursorUsageEventSource
```

#### Especificación caché auth

```typescript
let cachedToken: { value: string; expiresAt: number } | undefined
const TOKEN_CACHE_MS = 60_000

export const readCursorAccessToken = async (): Promise<string | null> => {
  if (cachedToken !== undefined && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value
  }
  // ... leer de state.vscdb
}
```

#### Criterios de aceptación PR-2

- [ ] Bug hooks "Not now" corregido
- [ ] Tests `cursor-stop-mapper`, `cursor-api-watermark` pasan
- [ ] Nuevo test: `hook-events-reader` con archivo temporal
- [ ] Tras `recordUsage` aplicado, animation controller recibe `activity`
- [ ] `createCursorUsageEventSource` no importa `DIGIMON_CATALOG` directamente

---

### PR-3: Paquete `vpet-animation` — ✅ Completado

**Duración:** 4–5 días  
**Riesgo:** Medio-alto (cross-package)  
**Dependencias:** PR-0

#### Crear paquete

```
packages/vpet-animation/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── monster-animation.ts
│   ├── monster-walking-policy.ts
│   ├── monster-action-policy.ts
│   ├── monster-artwork-mirror.ts
│   └── positioned-artwork.ts
└── tests/
    ├── monster-animation.test.ts      # migrar desde cursor-vpet
    ├── monster-walking.test.ts
    └── positioned-artwork.test.ts     # nuevo
```

#### `package.json`

```json
{
  "name": "@sbugallo/vpet-animation",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@sbugallo/vpet-core": "workspace:*"
  },
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*"
  }
}
```

#### `positioned-artwork.ts` — unificación crítica

```typescript
import { mirrorMonsterFrame } from "./monster-artwork-mirror.ts"
import type { MonsterAnimationOutput, MonsterAnimationResult } from "./monster-animation.ts"

export const FRAME_ROWS = 8
export const FRAME_COLUMNS = 16

const positionedOutput = (animation: MonsterAnimationOutput | MonsterAnimationResult): MonsterAnimationOutput => {
  /* lógica unificada de animated-artwork.ts y sidebar-card.tsx */
}

export const renderPositionedArtworkRows = (
  animation: MonsterAnimationOutput | MonsterAnimationResult,
  viewportWidth: number,
): readonly string[] => { /* ... */ }

export const renderPositionedArtwork = (
  animation: MonsterAnimationOutput | MonsterAnimationResult,
  viewportWidth: number,
): string => renderPositionedArtworkRows(animation, viewportWidth).join("\n")
```

#### Migración cursor-vpet

| Eliminar | Reemplazar por |
|----------|----------------|
| `webview/monster-animation.ts` | `@sbugallo/vpet-animation` |
| `webview/monster-walking-policy.ts` | `@sbugallo/vpet-animation` |
| `webview/monster-action-policy.ts` | `@sbugallo/vpet-animation` |
| `webview/monster-artwork-mirror.ts` | `@sbugallo/vpet-animation` |
| `webview/animated-artwork.ts` | Thin reexport de `positioned-artwork` |

#### Migración opencode-vpet

| Eliminar | Reemplazar por |
|----------|----------------|
| `tui/monster-*.ts` (4 archivos) | `@sbugallo/vpet-animation` |
| `artworkRows` en `sidebar-card.tsx` | `renderPositionedArtworkRows` |

#### Criterios de aceptación PR-3

- [x] `bun test` pasa en vpet-animation, cursor-vpet, opencode-vpet
- [x] No quedan copias de monster-animation en cursor ni opencode
- [x] Tests de animación viven en vpet-animation
- [x] `sidebar-card.tsx` usa `renderPositionedArtworkRows`
- [x] Build cursor-vpet (`bun run build`) exitoso con nueva dependencia

---

### PR-4: Artworks de batalla/evolución (refactor + deduplicación cross-host)

**Duración:** 3–4 días  
**Riesgo:** Medio (artworks duplicados en cursor-vpet y opencode-vpet; tests snapshot en ambos)  
**Dependencias:** PR-0, PR-3 (para constants compartidos con animation)

> **Nota 2026-09:** Este PR ya no es exclusivo de Cursor. Incluir extracción de `evolution-battle-artwork`, `evolution-artwork`, `defeat-artwork` y sessions a paquete compartido.

#### Crear módulos internos

```
src/webview/artwork/
├── constants.ts
├── frame-utils.ts
├── animation-runner.ts
├── evolution-artwork.ts      # refactorizado
├── defeat-artwork.ts         # refactorizado
└── evolution-battle-artwork.ts  # refactorizado
```

#### `constants.ts`

```typescript
export const FRAME_ROWS = 8
export const FRAME_COLUMNS = 16
export const DEFAULT_TICK_MS = 70
```

#### `frame-utils.ts`

```typescript
export const frameLines = (
  catalog: MonsterFrameCatalog,
  sprite: string,
  frameName: MonsterFrameName,
  options?: { facing?: "left" | "right"; injuredAlt?: boolean },
): string[]

export const padRow = (row: string, width: number): string

export const centerArtwork = (rows: readonly string[], viewportWidth: number): string

export const overlayAt = (base: string, overlay: string, startColumn: number): string
```

#### `animation-runner.ts`

```typescript
export type FrameSequenceOptions = {
  readonly durationMs: number
  readonly tickMs: number
  readonly render: (progress: number, tick: number) => string
  readonly onFrame: (artwork: string) => Promise<void>
  readonly preDelayMs?: number
}

export const runFrameSequence = async (options: FrameSequenceOptions): Promise<void>
```

#### Refactor `evolution-artwork.ts`

```typescript
export const runEvolutionAnimation = async (...) => {
  await sleep(EVOLUTION_PRE_ANIMATION_MS)
  await runFrameSequence({ durationMs: EVOLUTION_GLOW_MS, phase: "glow", ... })
  await runFrameSequence({ durationMs: EVOLUTION_MORPH_MS, phase: "morph", ... })
  await runFrameSequence({ durationMs: EVOLUTION_REVEAL_MS, phase: "reveal", ... })
}
```

#### Opcional: mover `planEvolutionBattle` a vpet-core

Si P-03 = Sí:

```typescript
// vpet-core/domain/evolution-battle-plan.ts
export const planEvolutionBattle = (
  outcome: EvolutionBattleOutcome,
  random: () => number,
): readonly EvolutionBattleShot[]
```

#### Criterios de aceptación PR-4

- [ ] Tests `evolution-artwork`, `defeat-artwork`, `evolution-battle-artwork` pasan sin cambio de output
- [ ] No hay `sleep()` definido fuera de `shared/sleep.ts`
- [ ] `FRAME_ROWS`/`FRAME_COLUMNS` solo en `artwork/constants.ts` (y vpet-animation para idle)
- [ ] `evolution-battle-artwork.ts` < 400 líneas

---

### PR-5: Webview y sidebar — descomposición

**Duración:** 4–6 días  
**Riesgo:** Medio-alto  
**Dependencias:** PR-3, PR-4

#### PR-5a: Extraer módulos del sidebar

**Crear:**

| Módulo | Responsabilidad | Líneas objetivo |
|--------|-----------------|-----------------|
| `sidebar-presenter.ts` | snapshot → `SidebarWebviewPayload` | ~40 |
| `sidebar-animation-host.ts` | tick loop, `postAnimationFrame`, dedup | ~80 |
| `evolution-battle-orchestrator.ts` | detectar batalla, animar, persistir, notificar | ~100 |
| `webview-messages.ts` | tipos + handlers `open-url`, `artwork-width` | ~50 |
| `escape-html.ts` | `escapeHtml(value: string): string` | ~10 |

**`sidebar-presenter.ts`:**

```typescript
export const buildSidebarPayload = (
  snapshotReader: SidebarSnapshotReader,
  catalog: DigimonCatalog,
  settings: ResolvedVpetSettings,
): SidebarWebviewPayload => {
  const snapshot = snapshotReader.getSidebarSnapshot()
  const reader = { getSidebarSnapshot: () => snapshot }
  const inputs = getSidebarCardInputs(reader, catalog)
  const model = buildSidebarCardModel(inputs, settings)
  return toSidebarWebviewPayload(model)
}

export const syncAnimationPartner = (
  controller: MonsterAnimationController,
  model: SidebarCardModel,
): void => {
  controller.dispatch({
    kind: "partner_changed",
    partner: model.kind === "partner"
      ? { sprite: model.sprite, isDigitama: model.stageNumber === 0 }
      : undefined,
  })
}
```

**`evolution-battle-orchestrator.ts`:**

```typescript
export type EvolutionBattleOrchestratorDeps = {
  readonly battleRepository: EvolutionBattleRepository
  readonly catalog: DigimonCatalog
  readonly sink: AnimationSink
  readonly random: () => number
  readonly notify: (message: string) => void
  readonly artworkWidth: () => number
}

export const tryResolveEvolutionBattle = async (
  deps: EvolutionBattleOrchestratorDeps,
  snapshot: SidebarSnapshot,
): Promise<boolean>
```

**`vpet-sidebar-provider.ts` refactorizado (~60 líneas):**

```typescript
export class VpetSidebarProvider implements vscode.WebviewViewProvider {
  private readonly presenter = ...
  private readonly animationHost = ...
  private readonly battleOrchestrator = ...

  resolveWebviewView(webviewView: WebviewView): void {
    // wiring + delegación
  }

  async refresh(): Promise<void> {
    while (await this.battleOrchestrator.tryResolve(this.getSnapshot())) {
      // loop en lugar de recursión
    }
    await this.presenter.publish(this.sink)
    await this.animationHost.tick()
  }
}
```

#### PR-5b: Webview templates y paneles

**Crear:**

| Módulo | Responsabilidad |
|--------|-----------------|
| `panel-factory.ts` | `createVpetPanel(context, { id, title, bodyHtml })` |
| `sidebar-webview.template.ts` | HTML template como función tipada |

**`escape-html.ts`:**

```typescript
export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
```

**Refactor `dex-panel.ts` / `history-panel.ts`:**

```typescript
export const openDexPanel = async (context, archiveReader: VpetArchiveReader) => {
  const archive = archiveReader.getArchive()
  const model = buildDexViewModel(archive, DIGIMON_CATALOG, DEFAULT_VPET_SETTINGS)
  const bodyHtml = model.kind === "available"
    ? buildDexTableHtml(model.rows)  // con escapeHtml
    : buildEmptyStateHtml(model)
  createVpetPanel(context, { id: "cursorVpetDex", title: "VPet Dex", bodyHtml })
}
```

#### Criterios de aceptación PR-5

- [ ] `VpetSidebarProvider` < 100 líneas — **actual: 238**
- [x] `evolution-battle-session` y `evolution-reveal-session` extraídos (parcial respecto al plan)
- [ ] Tests unitarios para `sidebar-presenter`, `evolution-battle-orchestrator`
- [x] Tests para `evolution-battle-session`, `evolution-reveal-session` (en `vpet-animation/tests/`)
- [x] `dex-panel` / `history-panel` escapan HTML (`shared/escape-html.ts`)
- [x] No hay recursión en `refresh()` (`async-refresh-queue.ts`)
- [x] Comportamiento visual del sidebar idéntico (tests artwork pasan en `vpet-animation`)
- [ ] `sidebar/provider.ts` < 100 líneas (actual: 143)

---

### PR-6: Extension bootstrap

**Duración:** 2–3 días  
**Riesgo:** Medio  
**Dependencias:** PR-1, PR-2, PR-5

#### Crear

```
src/bootstrap/
├── create-vpet-services.ts
├── register-commands.ts
├── register-sidebar.ts
└── hooks-bootstrap.ts
```

#### `create-vpet-services.ts`

```typescript
export type VpetServices = {
  readonly repository: CursorSqliteVpetRepository
  readonly sidebarProvider: VpetSidebarProvider
  readonly usageSource: CursorUsageEventSource
  readonly databaseWatcher: DatabaseChangeWatcher
  readonly refreshSidebar: () => void
  readonly dispose: () => void
}

export const createVpetServices = async (
  context: vscode.ExtensionContext,
): Promise<VpetServices>
```

#### `register-commands.ts`

```typescript
type VpetCommand = {
  readonly id: string
  readonly run: () => string | undefined | Promise<string | undefined>
}

export const registerVpetCommands = (
  context: vscode.ExtensionContext,
  commands: readonly VpetCommand[],
  refreshSidebar: () => void,
): void
```

#### `extension.ts` objetivo (~25 líneas)

```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  configureSqlJsWasmPath(join(context.extensionPath, "dist", "sql-wasm.wasm"))
  const services = await createVpetServices(context)
  context.subscriptions.push({ dispose: () => services.dispose() })
  registerVpetCommands(context, buildCommands(services), services.refreshSidebar)
  await ensureHooksInstalled(context)
  services.refreshSidebar()
}
```

#### Portar `createSidebarPollLoop` para refresh coordinado

Reemplazar `setInterval(refreshSidebar, 30_000)` por poll loop con `refreshPending` (como opencode-vpet).

#### Criterios de aceptación PR-6

- [x] `extension.ts` < 40 líneas (actual: 41)
- [x] Un solo punto de creación de servicios (`bootstrap/container.ts`)
- [x] Comandos registrados vía `register-commands.ts`
- [ ] Refresh coordinado (no triple fire redundante) — sigue `setInterval` 30s

---

### PR-7: Calidad y architecture boundaries

**Duración:** 2 días  
**Riesgo:** Bajo  
**Dependencias:** Todos los anteriores

#### Crear `tests/architecture-boundary.test.ts`

```typescript
const FORBIDDEN_WEBVIEW_IMPORTS = [
  "node:fs",
  "node:path",
  "sql.js",
  "../adapters/sqlite/sqljs-driver",
  "@sbugallo/vpet-core/adapters/sqlite",
]

const FORBIDDEN_WEBVIEW_ARTWORK_IMPORTS = [
  "../adapters/",
  "vscode",
]

// webview/ no debe importar adapters sqlite directamente
// artwork/ no debe importar vscode
```

#### Tests nuevos requeridos

| Test | Archivo |
|------|---------|
| `sidebar-presenter.test.ts` | payload building, partner sync |
| `evolution-battle-orchestrator.test.ts` | detección batalla, skip si in progress |
| `escape-html.test.ts` | caracteres especiales |
| `hook-events-reader.test.ts` | lectura JSONL, offset |
| `register-commands.test.ts` | mock vscode commands |

#### Criterios de aceptación PR-7

- [ ] Architecture boundary tests pasan
- [ ] Cobertura de módulos nuevos > 80%
- [ ] README actualizado con nueva estructura (opcional)

---

## 8. Especificaciones de módulos nuevos

### 8.1 `vpet-animation` — API pública

```typescript
// @sbugallo/vpet-animation

export { MonsterAnimationController } from "./monster-animation.ts"
export type {
  MonsterAnimationEvent,
  MonsterAnimationOutput,
  MonsterAnimationResult,
  MonsterAnimationIdentity,
  MonsterFacing,
} from "./monster-animation.ts"

export {
  initialWalkingPolicy,
  tickWalkingPolicy,
  resizeWalkingPolicy,
  resizeActionBoundary,
  resumeWalkingPolicy,
  restartWalkingPolicy,
} from "./monster-walking-policy.ts"
export type { WalkingPolicyState, ActionBoundaryState, WalkingPolicyTick } from "./monster-walking-policy.ts"

export {
  resolveCosmeticActions,
  selectCosmeticAction,
  resolveSleepClip,
} from "./monster-action-policy.ts"

export { mirrorMonsterFrame, MalformedMonsterFrameError } from "./monster-artwork-mirror.ts"

export {
  FRAME_ROWS,
  FRAME_COLUMNS,
  renderPositionedArtwork,
  renderPositionedArtworkRows,
} from "./positioned-artwork.ts"
```

**Restricciones del paquete:**

- ❌ No importar `vscode`, `node:fs`, `solid-js`, `@opentui/*`
- ✅ Solo depende de `@sbugallo/vpet-core`
- ✅ Sin side effects en import

### 8.2 `SidebarAnimationHost`

```typescript
export type SidebarAnimationHostOptions = {
  readonly controller: MonsterAnimationController
  readonly sink: AnimationSink
  readonly intervalMs: number  // default 500
  readonly isBlocked: () => boolean  // battle in progress
}

export type SidebarAnimationHost = {
  start(): void
  stop(): void
  async postFrame(animation?: MonsterAnimationOutput): Promise<void>
  dispose(): void
}

export const createSidebarAnimationHost = (options: SidebarAnimationHostOptions): SidebarAnimationHost
```

**Comportamiento:**

- `start()` — inicia `setInterval`; en cada tick: `controller.dispatch(tick)` → `postFrame`
- `postFrame` — deduplica comparando output del controller (como `sameAnimation` en opencode)
- `stop()` — para interval (durante batalla)
- `isBlocked()` — skip ticks si batalla en progreso

### 8.3 `createVpetPanel`

```typescript
export type VpetPanelOptions = {
  readonly id: string
  readonly title: string
  readonly bodyHtml: string
  readonly column?: vscode.ViewColumn
}

export const createVpetPanel = (
  context: vscode.ExtensionContext,
  options: VpetPanelOptions,
): vscode.WebviewPanel
```

**HTML base con CSP:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline';" />
  <style>/* variables VS Code */</style>
</head>
<body>${bodyHtml}</body>
</html>
```

---

## 9. Estructura de carpetas

### 9.0 `cursor-vpet` actual (2026-09-11)

```
packages/cursor-vpet/src/
├── extension.ts
├── config/extension-settings.ts
├── adapters/
│   ├── cursor/          # 7 archivos (sin hook-events-reader)
│   └── sqlite/          # 7 archivos (incl. sqljs-runtime.ts pendiente eliminar)
└── webview/             # 14 archivos
    ├── vpet-sidebar-provider.ts
    ├── evolution-battle-session.ts      # ✅ existe
    ├── evolution-reveal-session.ts        # ✅ existe
    ├── evolution-battle-artwork.ts
    ├── evolution-artwork.ts
    ├── defeat-artwork.ts
    ├── monster-*.ts                     # pendiente vpet-animation
    ├── animated-artwork.ts
    ├── sidebar-render.ts
    ├── dex-panel.ts
    └── history-panel.ts
```

**No existen aún:** `bootstrap/`, `shared/`, `webview/artwork/`, `webview/sidebar-presenter.ts`, etc.

### 9.1 `cursor-vpet` objetivo (post-refactor)

```
packages/cursor-vpet/
├── docs/
│   └── REFACTORING-IMPLEMENTATION-SPEC.md
├── src/
│   ├── extension.ts
│   ├── bootstrap/
│   │   ├── create-vpet-services.ts
│   │   ├── register-commands.ts
│   │   ├── register-sidebar.ts
│   │   └── hooks-bootstrap.ts
│   ├── config/
│   │   └── extension-settings.ts
│   ├── shared/
│   │   ├── sleep.ts
│   │   ├── random.ts
│   │   └── assert-never.ts
│   ├── adapters/
│   │   ├── cursor/
│   │   │   ├── cursor-usage-event-source.ts
│   │   │   ├── cursor-api-watermark.ts
│   │   │   ├── cursor-stop-mapper.ts
│   │   │   ├── cursor-auth.ts
│   │   │   ├── hook-events-reader.ts
│   │   │   ├── install-hooks.ts
│   │   │   ├── paths.ts
│   │   │   └── types.ts
│   │   └── sqlite/
│   │       ├── sqljs-config.ts
│   │       ├── sqljs-statement-executor.ts
│   │       ├── sqljs-driver.ts
│   │       ├── database-change-watcher.ts
│   │       ├── sqlite-vpet-write-store.ts
│   │       ├── sqlite-vpet-archive-reader.ts
│   │       ├── options.ts
│   │       └── errors.ts
│   └── webview/
│       ├── vpet-sidebar-provider.ts
│       ├── sidebar-presenter.ts
│       ├── sidebar-animation-host.ts
│       ├── evolution-battle-orchestrator.ts
│       ├── webview-messages.ts
│       ├── animation-sink.ts
│       ├── escape-html.ts
│       ├── panel-factory.ts
│       ├── sidebar-render.ts
│       ├── sidebar-webview.template.ts
│       ├── animated-artwork.ts          # reexport vpet-animation
│       ├── dex-panel.ts
│       ├── history-panel.ts
│       └── artwork/
│           ├── constants.ts
│           ├── frame-utils.ts
│           ├── animation-runner.ts
│           ├── evolution-artwork.ts
│           ├── defeat-artwork.ts
│           └── evolution-battle-artwork.ts
├── tests/
│   ├── architecture-boundary.test.ts
│   ├── sidebar-presenter.test.ts
│   ├── evolution-battle-orchestrator.test.ts
│   └── ... (existentes)
└── hook-bridge.js
```

### 9.2 `vpet-animation` (nuevo)

```
packages/vpet-animation/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── monster-animation.ts
│   ├── monster-walking-policy.ts
│   ├── monster-action-policy.ts
│   ├── monster-artwork-mirror.ts
│   └── positioned-artwork.ts
└── tests/
```

### 9.3 `vpet-core` (ampliaciones)

```
packages/vpet-core/src/adapters/sqlite/
├── sidebar-snapshot-queries.ts    # NUEVO
├── archive-queries.ts             # NUEVO
├── sqlite-vpet-schema.ts          # existente
└── ...
```

---

## 10. Plan de pruebas

### 10.1 Regresión obligatoria en cada PR

```bash
cd packages/cursor-vpet && bun test && bun run check
cd packages/vpet-core && bun test  # si se modifica
cd packages/opencode-vpet && bun test  # PR-3, PR-1b
```

### 10.2 Tests por PR

| PR | Tests nuevos | Tests existentes que deben pasar |
|----|--------------|----------------------------------|
| PR-0 | — | Todos |
| PR-1 | `repository.getSidebarSnapshot` | `sqljs-vpet-repository.persistence.test.ts` |
| PR-2 | `hook-events-reader.test.ts` | `cursor-stop-mapper`, `cursor-api-watermark` |
| PR-3 | `positioned-artwork.test.ts` | `monster-animation`, migrados a vpet-animation |
| PR-4 | — | `evolution-*`, `defeat-artwork` (snapshot strings) |
| PR-5 | `sidebar-presenter`, `orchestrator`, `escape-html` | `sidebar-render` |
| PR-6 | `register-commands` (mock) | — |
| PR-7 | `architecture-boundary` | Todos |

### 10.3 Tests de snapshot para artworks

Los tests existentes de artwork comparan strings ASCII completos. **No modificar outputs** durante refactor — si cambia un carácter, el test debe fallar.

```typescript
// Patrón existente a preservar
expect(renderEvolutionArtwork(...)).toBe(expectedMultilineString)
```

### 10.4 Test manual (checklist)

- [ ] Sidebar carga partner con animación idle
- [ ] Resize del sidebar ajusta ancho artwork
- [ ] Click en "Encyclopedia entry" abre URL
- [ ] Agent usage incrementa gauge
- [ ] Batalla de evolución se reproduce visualmente (Cursor webview y OpenCode TUI)
- [ ] Victoria → `runEvolutionRevealSession`; derrota → `runDefeatAnimation`
- [ ] Evolución directa (sin batalla) → `queueEvolutionReveal` + reveal en refresh
- [ ] Comandos spawn/freeze/unfreeze/set funcionan
- [ ] Dex y History panels muestran datos
- [ ] Hooks install/uninstall
- [ ] Monstruo no entra en sleep durante uso activo de Agent (post PR-2)

---

## 11. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Regresión visual en artworks | Media | Alto | Tests snapshot de strings; no cambiar outputs |
| Breaking change en vpet-core afecta opencode | Media | Alto | PR-1b coordinado; tests opencode en CI |
| Bundle size aumenta con vpet-animation | Baja | Bajo | Tree-shaking; paquete sin deps pesadas |
| sql.js reloadFromDisk race condition | Baja | Medio | Tests persistencia existentes; transaction depth guard |
| hook-bridge desincronizado | Media | Medio | Documentar; considerar codegen en build |
| Webview CSP rompe scripts | Baja | Alto | Test manual; nonce correcto en template |

---

## 12. Criterios de aceptación globales

La refactorización se considera **completa** cuando:

| # | Criterio | Estado (2026-09-11) |
|---|----------|----------------------|
| 1 | Todos los tests pasan en `cursor-vpet`, `vpet-animation`, `vpet-core`, `opencode-vpet` | ✅ 478 tests unitarios + 50 persistencia |
| 2 | No existe duplicación de `monster-animation` entre hosts | ✅ Centralizado en `vpet-animation` |
| 3 | `getSidebarSnapshot` no hace I/O de archivo por llamada en runtime normal | 🟡 Sidebar OK; paneles/tests aún usan lectura disco |
| 4 | `VpetSidebarProvider` < 100 líneas; responsabilidades en módulos dedicados | 🟡 Descompuesto; `provider.ts` = 143 líneas |
| 5 | `extension.ts` < 40 líneas; servicios creados en bootstrap | ✅ 41 líneas; `bootstrap/container.ts` |
| 6 | Paneles Dex/History escapan HTML | ✅ `escapeHtml` en `dex-panel` y `history-panel` |
| 7 | Bug hooks "Not now" corregido | 🟡 "Not now" no marca instalado; install sin verificar éxito |
| 8 | Evento `activity` conectado durante usage de Agent | ❌ No conectado |
| 9 | Architecture boundary tests en CI | ✅ `architecture-boundary.test.ts` + `hexagonal-boundary.test.ts` |
| 10 | Comportamiento visual y funcional idéntico (tests + checklist manual) | ✅ Verificado manualmente en Cursor tras VSIX |
| 11 | `pet.db` compartida entre Cursor y OpenCode | ✅ Con watcher + `reloadFromDisk` |
| 12 | Artworks/sessions de batalla no duplicados entre hosts | ✅ En `vpet-animation` |

---

## 13. Apéndices

### Apéndice A: Mapa de archivos actuales → destino

| Archivo actual | Acción | Destino | Estado |
|----------------|--------|---------|--------|
| `sqljs-runtime.ts` | Eliminar | — | ✅ Eliminado |
| `monster-animation.ts` (+ policies, mirror) | Mover | `vpet-animation/src/idle/` | ✅ Completado |
| `animated-artwork.ts` | Unificar | `vpet-animation/src/render/positioned-artwork.ts` | ✅ Completado |
| `evolution-*-session.ts`, artworks | Mover | `vpet-animation/src/{sessions,sequences}/` | ✅ Completado |
| `sqlite-sidebar-snapshot-reader.ts` | Deprecar lectura disco en runtime | Lógica en vpet-core + repository | 🟡 `readSidebarSnapshotFromExecutor` usado por repository |
| `readSidebarSnapshotFromExecutor` | Mover | `vpet-core/sidebar-snapshot-queries.ts` | ❌ Pendiente |
| `readSqliteVpetArchive` | Mover | `vpet-core/archive-queries.ts` | ❌ Pendiente |
| `vpet-sidebar-provider.ts` | Dividir | `sidebar/{provider,presenter,animation-host,orchestrator}` | ✅ Completado (provider 143 líneas) |
| `extension.ts` | Dividir | `bootstrap/*` | ✅ Completado (41 líneas) |
| `evolution-battle-artwork.ts` | Refactor interno | `vpet-animation/src/sequences/` | 🟡 Extraído; 480 líneas (objetivo &lt;400) |
| `types.ts` (`CompletedUsage`) | Eliminar tipo | Import vpet-core | ✅ Re-export desde vpet-core |

### Apéndice B: Comandos VS Code (sin cambios de contrato)

| Comando | ID | Comportamiento post-refactor |
|---------|-----|------------------------------|
| Spawn Partner | `cursorVpet.spawn` | Igual |
| Freeze | `cursorVpet.freeze` | Igual |
| Unfreeze | `cursorVpet.unfreeze` | Igual |
| Set Digimon | `cursorVpet.set` | Igual |
| Open Dex | `cursorVpet.dex` | Igual (HTML escapado) |
| Open History | `cursorVpet.history` | Igual (HTML escapado) |
| Install Hooks | `cursorVpet.installHooks` | Igual |
| Uninstall Hooks | `cursorVpet.uninstallHooks` | Igual |

### Apéndice C: Settings (sin cambios de contrato)

| Setting | Key | Notas |
|---------|-----|-------|
| Database path | `vpet.databasePath` | Hot-reload si P-02 = A |
| Settle delay | `vpet.usage.settleDelayMs` | Sin cambios |

### Apéndice D: Cronograma

**Plan original (marzo 2026):**

```
Semana 1: PR-0, PR-1
Semana 2: PR-2, PR-3 (inicio)
Semana 3: PR-3 (fin), PR-4, PR-5a
Semana 4: PR-5b, PR-6, PR-7
```

**Realidad a septiembre 2026:** PR-0, PR-3 y gran parte de PR-5/PR-6/PR-7 completados. `vpet-animation` extraído y validado en Cursor y OpenCode.

**Siguiente hito recomendado:** PR-2 (`onActivity`, `hook-events-reader`, caché auth) + PR-1b (queries en `vpet-core`) + reducir `sidebar/provider.ts` a &lt;100 líneas.

### Apéndice E: Referencias en el monorepo

| Recurso | Ruta |
|---------|------|
| Paquete animación compartida | `packages/vpet-animation/` |
| Tests animación/artwork | `packages/vpet-animation/tests/` |
| Staging npm (OpenCode) | `packages/opencode-vpet/scripts/stage-vpet-animation-sources.ts` |
| Tests arquitectura (ambos hosts) | `packages/*/tests/architecture-boundary*.ts`, `hexagonal-boundary.test.ts` |
| Poll loop reutilizable | `packages/opencode-vpet/src/tui/sidebar-poll-loop.ts` |
| Orquestación batalla OpenCode TUI | `packages/opencode-vpet/src/tui.tsx` |
| Orquestación batalla Cursor | `packages/cursor-vpet/src/webview/sidebar/sidebar-orchestrator.ts` |
| Sesiones batalla/reveal | `packages/vpet-animation/src/sessions/` |
| Dominio batalla | `packages/vpet-core/src/domain/evolution-battle.ts` |
| Repository Cursor (snapshot en memoria) | `packages/cursor-vpet/src/adapters/sqlite/sqlite-vpet-write-store.ts` |
| Bootstrap Cursor | `packages/cursor-vpet/src/bootstrap/container.ts` |
| Tests persistencia Cursor | `packages/cursor-vpet/tests/persistence/sqljs-vpet-repository.persistence.test.ts` |

### Apéndice F: Commits de la feature batalla/evolución (contexto)

| Commit | Resumen |
|--------|---------|
| `093550d` | Batallas de evolución antes de digi-evolución |
| `7d85b25` | Intro parpadeante y animaciones post-batalla (Cursor) |
| `e154b6e` | Flujo batalla TUI + hooks en opencode-vpet |
| `78cfc3c` | Sync cambios `pet.db` entre ventanas de extensión |
| `7669efc` | Estabilizar refresh batalla y lecturas DB |
| `3b91b30` | Evolución directa Digitama; separar batalla de reveal |
| `af5a1d4` | Crear paquete `vpet-animation` |
| `324f654` | Migrar OpenCode y Cursor a `vpet-animation` |

---

*Documento v1.2 — actualizado 2026-09-11 con snapshot en rama `feat/vpet-animation` (~commit `324f654`). Actualizar §1.4 al completar cada PR restante.*
