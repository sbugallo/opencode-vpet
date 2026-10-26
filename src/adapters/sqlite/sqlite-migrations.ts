import { DIGIMON_ID_MIGRATION } from "../../data/digimon-data.ts"

type QueryValue = string | number | null

type SqliteMigrationExecutor = {
  run: (sql: string, params?: readonly QueryValue[]) => void
  all: <TRow extends Record<string, QueryValue>>(sql: string, params?: readonly QueryValue[]) => readonly TRow[]
  transaction: <TReturn>(operation: () => TReturn) => TReturn
}

type MigrationStatement = {
  readonly sql: string
  readonly params?: readonly QueryValue[]
}

type Migration = {
  readonly version: number
  readonly sql: readonly (string | MigrationStatement)[]
}

/**
 * Version 4 remaps stored digimon ids from the legacy plugin id space to the
 * canonical dataset ids. Unmapped values (already-canonical or unknown ids)
 * are left untouched.
 */
const idRemapStatements: readonly MigrationStatement[] = [
  {
    sql: "CREATE TEMP TABLE digimon_id_migration (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL)",
  },
  ...Object.entries(DIGIMON_ID_MIGRATION).map(
    ([oldId, newId]): MigrationStatement => ({
      sql: "INSERT INTO digimon_id_migration (old_id, new_id) VALUES (?, ?)",
      params: [oldId, newId],
    }),
  ),
  {
    sql: `
      UPDATE partners
      SET current_node_id = (SELECT new_id FROM digimon_id_migration WHERE old_id = partners.current_node_id)
      WHERE current_node_id IN (SELECT old_id FROM digimon_id_migration)
    `,
  },
  {
    sql: `
      UPDATE partner_events
      SET current_node_id = (SELECT new_id FROM digimon_id_migration WHERE old_id = partner_events.current_node_id)
      WHERE current_node_id IN (SELECT old_id FROM digimon_id_migration)
    `,
  },
  {
    sql: `
      UPDATE vpet_control_state
      SET cheat_node_id = (SELECT new_id FROM digimon_id_migration WHERE old_id = vpet_control_state.cheat_node_id)
      WHERE cheat_node_id IN (SELECT old_id FROM digimon_id_migration)
    `,
  },
  { sql: "DROP TABLE digimon_id_migration" },
]

const MIGRATIONS = [
  {
    version: 1,
    sql: [
      `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS trainer_state (
          trainer_id INTEGER PRIMARY KEY CHECK (trainer_id = 1),
          total_tokens INTEGER NOT NULL
        )
      `,
      `
        INSERT INTO trainer_state (trainer_id, total_tokens)
        VALUES (1, 0)
        ON CONFLICT (trainer_id) DO NOTHING
      `,
      `
        CREATE TABLE IF NOT EXISTS partners (
          partner_id TEXT PRIMARY KEY,
          generation INTEGER NOT NULL,
          current_node_id TEXT NOT NULL,
          gauge INTEGER NOT NULL,
          is_terminal INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          retired_at TEXT
        )
      `,
      `
        CREATE UNIQUE INDEX IF NOT EXISTS partners_one_active_partner
        ON partners ((1))
        WHERE retired_at IS NULL
      `,
      `
        CREATE TABLE IF NOT EXISTS partner_events (
          event_id TEXT PRIMARY KEY,
          partner_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          current_node_id TEXT NOT NULL,
          gauge INTEGER NOT NULL,
          is_terminal INTEGER NOT NULL,
          token_delta INTEGER,
          receipt_key TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (partner_id) REFERENCES partners (partner_id)
        )
      `,
      `
        CREATE INDEX IF NOT EXISTS partner_events_partner_created_at
        ON partner_events (partner_id, created_at, event_id)
      `,
      `
        CREATE TABLE IF NOT EXISTS usage_receipts (
          receipt_key TEXT PRIMARY KEY,
          partner_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          token_delta INTEGER NOT NULL,
          cost REAL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (partner_id) REFERENCES partners (partner_id),
          FOREIGN KEY (event_id) REFERENCES partner_events (event_id)
        )
      `,
    ],
  },
  {
    version: 2,
    sql: ["CREATE UNIQUE INDEX IF NOT EXISTS partners_generation_unique ON partners (generation)"],
  },
  {
    version: 3,
    sql: [
      `
        CREATE TABLE IF NOT EXISTS vpet_control_state (
          control_id INTEGER PRIMARY KEY CHECK (control_id = 1),
          frozen INTEGER NOT NULL CHECK (frozen IN (0, 1)),
          cheat_node_id TEXT
        )
      `,
      `
        INSERT INTO vpet_control_state (control_id, frozen, cheat_node_id)
        VALUES (1, 0, NULL)
        ON CONFLICT (control_id) DO NOTHING
      `,
      `
        CREATE TABLE IF NOT EXISTS vpet_control_receipts (
          receipt_key TEXT PRIMARY KEY,
          mode TEXT NOT NULL CHECK (mode IN ('frozen', 'cheat')),
          token_delta INTEGER NOT NULL,
          cost REAL,
          created_at TEXT NOT NULL
        )
      `,
    ],
  },
  {
    version: 4,
    sql: idRemapStatements,
  },
] as const satisfies readonly Migration[]

type MigrationRow = {
  readonly version: number
}

export const runMigrations = (database: SqliteMigrationExecutor): readonly number[] => {
  return database.transaction(() => {
    database.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `)

    const appliedVersions = new Set(
      database
        .all<MigrationRow>("SELECT version FROM schema_migrations ORDER BY version ASC")
        .map((row) => row.version),
    )

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) {
        continue
      }

      for (const statement of migration.sql) {
        if (typeof statement === "string") database.run(statement)
        else database.run(statement.sql, statement.params)
      }
      database.run("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [
        migration.version,
        new Date().toISOString(),
      ])
      appliedVersions.add(migration.version)
    }

    return [...appliedVersions].sort((left, right) => left - right)
  })
}
