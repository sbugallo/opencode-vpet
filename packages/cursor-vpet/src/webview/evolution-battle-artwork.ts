import type { MonsterFrameCatalog } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"
import type { MonsterFrameName } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"
import { mirrorMonsterFrame } from "./monster-artwork-mirror.ts"

const FRAME_ROWS = 8
const FRAME_COLUMNS = 16
const BATTLE_GAP_COLUMNS = 12

export const EVOLUTION_BATTLE_HITS_TO_WIN = 3
export const EVOLUTION_BATTLE_MAX_SHOTS = 24
export const EVOLUTION_BATTLE_TRAVEL_MS = 900
export const EVOLUTION_BATTLE_PAUSE_MS = 550
export const EVOLUTION_BATTLE_IMPACT_MS = 650
export const EVOLUTION_BATTLE_OUTCOME_MS = 1400
export const EVOLUTION_BATTLE_TICK_MS = 70

/** Block-style flame sprite matching Digimon ASCII art. */
export const FIREBALL_LINES = Object.freeze([" ▄▀▄ ", "▄█▀▀█", " ▀▀▀ "])

const FIREBALL_ROWS = FIREBALL_LINES.length
const FIREBALL_COLUMNS = FIREBALL_LINES[0]?.length ?? 0
const FIREBALL_START_ROW = Math.floor((FRAME_ROWS - FIREBALL_ROWS) / 2)

const IMPACT_LINES = Object.freeze([" ▄█▄ ", " █▀█ ", " ▀▀▀ "])
const IMPACT_ROWS = IMPACT_LINES.length
const IMPACT_START_ROW = FIREBALL_START_ROW

export type EvolutionBattleShooter = "player" | "opponent"
export type EvolutionBattleOutcome = EvolutionBattleShooter
export type BattleSpritePose = "attack" | "injured" | "happy" | "idle"
export type EvolutionBattleResultLabel = "hit" | "miss" | null

export type EvolutionBattleShot = {
  readonly shooter: EvolutionBattleShooter
  readonly hit: boolean
}

export type EvolutionBattleScene = {
  readonly shooter: EvolutionBattleShooter | null
  readonly progress: number
  readonly playerPose: BattleSpritePose
  readonly opponentPose: BattleSpritePose
  readonly playerInjuredAlt: boolean
  readonly opponentInjuredAlt: boolean
  readonly playerHits: number
  readonly opponentHits: number
  readonly lastResult: EvolutionBattleResultLabel
  readonly outcomeLabel: string | null
}

const poseToFrame = (pose: BattleSpritePose, injuredAlt: boolean): MonsterFrameName => {
  switch (pose) {
    case "attack":
      return "attack"
    case "injured":
      return injuredAlt ? "injured_2" : "injured_1"
    case "happy":
      return "happy"
    default:
      return "walk_1"
  }
}

const frameLines = (
  catalog: MonsterFrameCatalog,
  sprite: string,
  facing: "left" | "right",
  pose: BattleSpritePose,
  injuredAlt: boolean,
): string[] => {
  const frameName = poseToFrame(pose, injuredAlt)
  const frame = catalog.get(sprite, frameName) ?? catalog.get(sprite, "walk_1")
  if (frame === undefined) return Array.from({ length: FRAME_ROWS }, () => " ".repeat(FRAME_COLUMNS))
  if (facing === "right") {
    const mirrored = mirrorMonsterFrame(frame)
    if (mirrored.kind === "mirrored") return mirrored.frame.content.split("\n")
  }
  return frame.content.split("\n")
}

const padRow = (row: string, width: number): string => row.padEnd(width, " ").slice(0, width)

const overlayAt = (base: string, overlay: string, startColumn: number): string => {
  const result = base.split("")
  for (let index = 0; index < overlay.length; index += 1) {
    const column = startColumn + index
    if (column < 0 || column >= result.length) continue
    const character = overlay[index]
    if (character !== undefined && character !== " ") result[column] = character
  }
  return result.join("")
}

const centerText = (width: number, text: string): string => {
  const start = Math.max(0, Math.floor((width - text.length) / 2))
  return `${" ".repeat(start)}${text}`.padEnd(width, " ").slice(0, width)
}

export const BATTLE_SCORE_HIT_PIP = "█"
export const BATTLE_SCORE_MISS_PIP = "░"

export const buildBattleScorePips = (
  hits: number,
  total: number = EVOLUTION_BATTLE_HITS_TO_WIN,
): string =>
  Array.from({ length: total }, (_, index) =>
    index < hits ? BATTLE_SCORE_HIT_PIP : BATTLE_SCORE_MISS_PIP,
  ).join("")

export const buildBattleScoreRow = (
  playerHits: number,
  opponentHits: number,
  width: number = BATTLE_GAP_COLUMNS,
): string => {
  const playerPips = buildBattleScorePips(playerHits)
  const opponentPips = buildBattleScorePips(opponentHits)
  const spacer = Math.max(1, width - playerPips.length - opponentPips.length)
  return `${playerPips}${" ".repeat(spacer)}${opponentPips}`.padEnd(width, " ").slice(0, width)
}

const mirrorFireballLine = (line: string): string => Array.from(line).reverse().join("")

const fireballLinesForShooter = (shooter: EvolutionBattleShooter): readonly string[] =>
  shooter === "opponent" ? FIREBALL_LINES.map(mirrorFireballLine) : FIREBALL_LINES

const fireballColumn = (shooter: EvolutionBattleShooter, progress: number): number => {
  const travel = BATTLE_GAP_COLUMNS - FIREBALL_COLUMNS
  const clamped = Math.max(0, Math.min(1, progress))
  if (shooter === "player") return Math.round(clamped * travel)
  return Math.round((1 - clamped) * travel)
}

const impactColumn = (shooter: EvolutionBattleShooter): number => {
  if (shooter === "player") return BATTLE_GAP_COLUMNS - IMPACT_LINES[0]!.length
  return 0
}

const renderFireballInGap = (gapRows: string[], shooter: EvolutionBattleShooter, progress: number): void => {
  const startColumn = fireballColumn(shooter, progress)
  const fireballLines = fireballLinesForShooter(shooter)
  for (let rowIndex = 0; rowIndex < FIREBALL_ROWS; rowIndex += 1) {
    const gapRow = FIREBALL_START_ROW + rowIndex
    const fireballLine = fireballLines[rowIndex] ?? ""
    gapRows[gapRow] = overlayAt(gapRows[gapRow] ?? "", fireballLine, startColumn)
  }
}

const renderImpactInGap = (gapRows: string[], shooter: EvolutionBattleShooter): void => {
  const startColumn = impactColumn(shooter)
  for (let rowIndex = 0; rowIndex < IMPACT_ROWS; rowIndex += 1) {
    const gapRow = IMPACT_START_ROW + rowIndex
    const impactLine = IMPACT_LINES[rowIndex] ?? ""
    gapRows[gapRow] = overlayAt(gapRows[gapRow] ?? "", impactLine, startColumn)
  }
}

const renderHudInGap = (gapRows: string[], scene: EvolutionBattleScene): void => {
  gapRows[0] = buildBattleScoreRow(scene.playerHits, scene.opponentHits)
  if (scene.outcomeLabel !== null) {
    gapRows[FRAME_ROWS - 1] = centerText(BATTLE_GAP_COLUMNS, scene.outcomeLabel)
  } else if (scene.lastResult !== null) {
    gapRows[FRAME_ROWS - 1] = centerText(BATTLE_GAP_COLUMNS, scene.lastResult === "hit" ? "HIT!" : "MISS")
  }
}

const hitsFor = (shooter: EvolutionBattleShooter, playerHits: number, opponentHits: number): number =>
  shooter === "player" ? playerHits : opponentHits

const rollShotHit = (
  outcome: EvolutionBattleOutcome,
  shooter: EvolutionBattleShooter,
  playerHits: number,
  opponentHits: number,
  random: () => number,
): boolean => {
  const winner = outcome
  const loser = outcome === "player" ? "opponent" : "player"
  const winnerHits = hitsFor(winner, playerHits, opponentHits)
  const loserHits = hitsFor(loser, playerHits, opponentHits)

  if (shooter === winner) {
    if (winnerHits === EVOLUTION_BATTLE_HITS_TO_WIN - 1) return true
    if (loserHits === EVOLUTION_BATTLE_HITS_TO_WIN - 1) return true
    return random() < 0.65
  }

  if (loserHits === EVOLUTION_BATTLE_HITS_TO_WIN - 1) return false
  return random() < 0.45
}

export const planEvolutionBattle = (
  outcome: EvolutionBattleOutcome,
  random: () => number = Math.random,
): readonly EvolutionBattleShot[] => {
  const shots: EvolutionBattleShot[] = []
  let playerHits = 0
  let opponentHits = 0
  let shooter: EvolutionBattleShooter = "player"

  while (
    playerHits < EVOLUTION_BATTLE_HITS_TO_WIN &&
    opponentHits < EVOLUTION_BATTLE_HITS_TO_WIN &&
    shots.length < EVOLUTION_BATTLE_MAX_SHOTS
  ) {
    const hit = rollShotHit(outcome, shooter, playerHits, opponentHits, random)
    shots.push({ shooter, hit })
    if (hit) {
      if (shooter === "player") playerHits += 1
      else opponentHits += 1
    }
    shooter = shooter === "player" ? "opponent" : "player"
  }

  return shots
}

export const defaultBattleScene = (
  overrides: Partial<EvolutionBattleScene> = {},
): EvolutionBattleScene => ({
  shooter: null,
  progress: 0,
  playerPose: "attack",
  opponentPose: "attack",
  playerInjuredAlt: false,
  opponentInjuredAlt: false,
  playerHits: 0,
  opponentHits: 0,
  lastResult: null,
  outcomeLabel: null,
  ...overrides,
})

export const renderEvolutionBattleArtwork = (
  catalog: MonsterFrameCatalog,
  playerSprite: string,
  opponentSprite: string,
  scene: EvolutionBattleScene,
  viewportWidth: number,
): string => {
  const playerLines = frameLines(catalog, playerSprite, "right", scene.playerPose, scene.playerInjuredAlt)
  const opponentLines = frameLines(catalog, opponentSprite, "left", scene.opponentPose, scene.opponentInjuredAlt)

  const gapRows = Array.from({ length: FRAME_ROWS }, () => " ".repeat(BATTLE_GAP_COLUMNS))
  renderHudInGap(gapRows, scene)

  if (scene.shooter !== null) {
    renderFireballInGap(gapRows, scene.shooter, scene.progress)
  }
  if (scene.lastResult === "hit" && scene.shooter !== null) {
    renderImpactInGap(gapRows, scene.shooter)
  }

  const battleWidth = FRAME_COLUMNS + BATTLE_GAP_COLUMNS + FRAME_COLUMNS
  const rows = Array.from({ length: FRAME_ROWS }, (_, rowIndex) => {
    const left = padRow(playerLines[rowIndex] ?? "", FRAME_COLUMNS)
    const gap = gapRows[rowIndex] ?? " ".repeat(BATTLE_GAP_COLUMNS)
    const right = padRow(opponentLines[rowIndex] ?? "", FRAME_COLUMNS)
    return `${left}${gap}${right}`
  })

  const padding = Math.max(Math.floor((viewportWidth - battleWidth) / 2), 0)
  return rows.map((row) => `${" ".repeat(padding)}${row}`).join("\n")
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const postScene = async (
  catalog: MonsterFrameCatalog,
  playerSprite: string,
  opponentSprite: string,
  viewportWidth: number,
  scene: EvolutionBattleScene,
  onFrame: (artwork: string) => Promise<void>,
): Promise<void> => {
  await onFrame(renderEvolutionBattleArtwork(catalog, playerSprite, opponentSprite, scene, viewportWidth))
}

const animateShot = async (
  catalog: MonsterFrameCatalog,
  playerSprite: string,
  opponentSprite: string,
  viewportWidth: number,
  shot: EvolutionBattleShot,
  playerHits: number,
  opponentHits: number,
  onFrame: (artwork: string) => Promise<void>,
): Promise<void> => {
  const steps = Math.max(1, Math.ceil(EVOLUTION_BATTLE_TRAVEL_MS / EVOLUTION_BATTLE_TICK_MS))
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps
    await postScene(
      catalog,
      playerSprite,
      opponentSprite,
      viewportWidth,
      defaultBattleScene({
        shooter: shot.shooter,
        progress,
        playerHits,
        opponentHits,
        playerPose: "attack",
        opponentPose: "attack",
      }),
      onFrame,
    )
    if (step < steps) await sleep(EVOLUTION_BATTLE_TICK_MS)
  }
}

const animateImpact = async (
  catalog: MonsterFrameCatalog,
  playerSprite: string,
  opponentSprite: string,
  viewportWidth: number,
  shot: EvolutionBattleShot,
  playerHits: number,
  opponentHits: number,
  onFrame: (artwork: string) => Promise<void>,
): Promise<void> => {
  const playerPose = shot.hit && shot.shooter === "opponent" ? "injured" : "attack"
  const opponentPose = shot.hit && shot.shooter === "player" ? "injured" : "attack"
  const ticks = Math.max(1, Math.ceil(EVOLUTION_BATTLE_IMPACT_MS / EVOLUTION_BATTLE_TICK_MS))

  for (let tick = 0; tick < ticks; tick += 1) {
    await postScene(
      catalog,
      playerSprite,
      opponentSprite,
      viewportWidth,
      defaultBattleScene({
        shooter: shot.shooter,
        progress: 1,
        playerHits,
        opponentHits,
        playerPose,
        opponentPose,
        playerInjuredAlt: tick % 2 === 1 && playerPose === "injured",
        opponentInjuredAlt: tick % 2 === 1 && opponentPose === "injured",
        lastResult: shot.hit ? "hit" : "miss",
      }),
      onFrame,
    )
    if (tick < ticks - 1) await sleep(EVOLUTION_BATTLE_TICK_MS)
  }
}

const animatePause = async (
  catalog: MonsterFrameCatalog,
  playerSprite: string,
  opponentSprite: string,
  viewportWidth: number,
  playerHits: number,
  opponentHits: number,
  onFrame: (artwork: string) => Promise<void>,
): Promise<void> => {
  await postScene(
    catalog,
    playerSprite,
    opponentSprite,
    viewportWidth,
    defaultBattleScene({
      playerHits,
      opponentHits,
      playerPose: "attack",
      opponentPose: "attack",
    }),
    onFrame,
  )
  await sleep(EVOLUTION_BATTLE_PAUSE_MS)
}

const animateOutcome = async (
  catalog: MonsterFrameCatalog,
  playerSprite: string,
  opponentSprite: string,
  viewportWidth: number,
  outcome: EvolutionBattleOutcome,
  playerHits: number,
  opponentHits: number,
  onFrame: (artwork: string) => Promise<void>,
): Promise<void> => {
  const ticks = Math.max(1, Math.ceil(EVOLUTION_BATTLE_OUTCOME_MS / EVOLUTION_BATTLE_TICK_MS))
  const playerWon = outcome === "player"
  const winnerPose: BattleSpritePose = "happy"
  const loserPose: BattleSpritePose = "injured"

  for (let tick = 0; tick < ticks; tick += 1) {
    const loserBlink = tick % 2 === 1 ? "injured" : loserPose
    await postScene(
      catalog,
      playerSprite,
      opponentSprite,
      viewportWidth,
      defaultBattleScene({
        playerHits,
        opponentHits,
        playerPose: playerWon ? winnerPose : loserBlink,
        opponentPose: playerWon ? loserBlink : winnerPose,
        playerInjuredAlt: !playerWon && tick % 2 === 1,
        opponentInjuredAlt: playerWon && tick % 2 === 1,
        outcomeLabel: playerWon ? "WIN!" : "LOSE!",
      }),
      onFrame,
    )
    if (tick < ticks - 1) await sleep(EVOLUTION_BATTLE_TICK_MS)
  }
}

export const runEvolutionBattleAnimation = async (
  catalog: MonsterFrameCatalog,
  playerSprite: string,
  opponentSprite: string,
  viewportWidth: number,
  outcome: EvolutionBattleOutcome,
  onFrame: (artwork: string) => Promise<void>,
  random: () => number = Math.random,
): Promise<EvolutionBattleOutcome> => {
  const shots = planEvolutionBattle(outcome, random)
  let playerHits = 0
  let opponentHits = 0

  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index]
    if (shot === undefined) continue

    await animateShot(catalog, playerSprite, opponentSprite, viewportWidth, shot, playerHits, opponentHits, onFrame)
    if (shot.hit) {
      if (shot.shooter === "player") playerHits += 1
      else opponentHits += 1
    }
    await animateImpact(
      catalog,
      playerSprite,
      opponentSprite,
      viewportWidth,
      shot,
      playerHits,
      opponentHits,
      onFrame,
    )

    const battleOver =
      playerHits >= EVOLUTION_BATTLE_HITS_TO_WIN || opponentHits >= EVOLUTION_BATTLE_HITS_TO_WIN
    const isLastShot = index === shots.length - 1
    if (!battleOver && !isLastShot) {
      await animatePause(catalog, playerSprite, opponentSprite, viewportWidth, playerHits, opponentHits, onFrame)
    }
    if (battleOver) break
  }

  await animateOutcome(
    catalog,
    playerSprite,
    opponentSprite,
    viewportWidth,
    outcome,
    playerHits,
    opponentHits,
    onFrame,
  )
  return outcome
}
