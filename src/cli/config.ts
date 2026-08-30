import { access, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser"

const CANONICAL_PLUGIN = "@sbugallo/opencode-vpet"
const LEGACY_PLUGIN = "opencode-vpet"

type Environment = NodeJS.ProcessEnv &
  Readonly<{
    readonly OPENCODE_CONFIG?: string | undefined
    readonly OPENCODE_CONFIG_DIR?: string | undefined
    readonly OPENCODE_TUI_CONFIG?: string | undefined
    readonly XDG_CONFIG_HOME?: string | undefined
  }>

export type NormalizeOpenCodeConfigsOptions = Readonly<{
  readonly dryRun?: boolean
  readonly env?: Environment
  readonly home?: string
}>

export type NormalizeOpenCodeConfigsResult = Readonly<{
  readonly changedPaths: readonly string[]
}>

type PlannedConfig = Readonly<{
  readonly path: string
  readonly content: string
  readonly changed: boolean
}>

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false
    throw error
  }
}

const preferredConfigPath = async (directory: string, name: "opencode" | "tui"): Promise<string> => {
  const jsonc = join(directory, `${name}.jsonc`)
  return (await exists(jsonc)) ? jsonc : join(directory, `${name}.json`)
}

const nonEmptyPath = (value: string | undefined): string | undefined =>
  value === undefined || value.trim().length === 0 ? undefined : value

const resolveConfigDirectory = (env: Environment, home: string): string => {
  const configDirectory = nonEmptyPath(env.OPENCODE_CONFIG_DIR)
  if (configDirectory !== undefined) return configDirectory
  const xdgConfigHome = nonEmptyPath(env.XDG_CONFIG_HOME)
  return xdgConfigHome === undefined ? join(home, ".config", "opencode") : join(xdgConfigHome, "opencode")
}

const resolveConfigPaths = async (env: Environment, home: string): Promise<readonly [string, string]> => {
  const directory = resolveConfigDirectory(env, home)
  return [
    nonEmptyPath(env.OPENCODE_CONFIG) ?? (await preferredConfigPath(directory, "opencode")),
    nonEmptyPath(env.OPENCODE_TUI_CONFIG) ?? (await preferredConfigPath(directory, "tui")),
  ]
}

const parseConfig = (source: string, path: string): Readonly<{ readonly plugin?: unknown }> => {
  const errors: ParseError[] = []
  const parsed: unknown = parse(source, errors, { allowEmptyContent: false, allowTrailingComma: true })
  if (errors.length > 0) throw new Error(`Cannot parse OpenCode configuration: ${path}`)
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`OpenCode configuration must be an object: ${path}`)
  }
  return parsed
}

const normalizedPlugins = (value: unknown): readonly unknown[] => {
  if (value === undefined) return [CANONICAL_PLUGIN]
  if (!Array.isArray(value)) throw new Error("OpenCode plugin configuration must be an array.")
  const retained = value.filter(
    (entry) => typeof entry !== "string" || (entry !== LEGACY_PLUGIN && entry !== CANONICAL_PLUGIN),
  )
  return [...retained, CANONICAL_PLUGIN]
}

const planConfig = async (path: string): Promise<PlannedConfig> => {
  const source = (await exists(path)) ? await readFile(path, "utf8") : "{}\n"
  const parsed = parseConfig(source, path)
  const plugins = normalizedPlugins(parsed.plugin)
  const content = applyEdits(
    source,
    modify(source, ["plugin"], plugins, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" } }),
  )
  return { path, content, changed: content !== source }
}

const writeAtomically = async (plan: PlannedConfig): Promise<void> => {
  const existing = await exists(plan.path)
  const targetPath = existing ? await realpath(plan.path) : plan.path
  const mode = existing ? (await stat(targetPath)).mode & 0o777 : 0o600
  await mkdir(dirname(targetPath), { recursive: true })
  const temporaryPath = join(
    dirname(targetPath),
    `.${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )
  try {
    await writeFile(temporaryPath, plan.content, { encoding: "utf8", flag: "wx", mode })
    await rename(temporaryPath, targetPath)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

export const normalizeOpenCodeConfigs = async (
  options: NormalizeOpenCodeConfigsOptions = {},
): Promise<NormalizeOpenCodeConfigsResult> => {
  const env = options.env ?? process.env
  const [serverPath, tuiPath] = await resolveConfigPaths(env, options.home ?? homedir())
  const plans = await Promise.all([planConfig(serverPath), planConfig(tuiPath)])
  const changedPlans = plans.filter((plan) => plan.changed)
  if (!options.dryRun) await Promise.all(changedPlans.map(writeAtomically))
  return { changedPaths: changedPlans.map((plan) => plan.path) }
}
