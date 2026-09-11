import type { DigimonNode } from "../../domain/digimon-node.ts"
import type { EvolutionSelector, StageThresholds } from "../../domain/evolution.ts"
import type { UsageProcessingResult } from "../models/usage.ts"
import type { UsageLedger } from "../ports/usage-ledger.ts"
import { recordUsage, type CompletedUsage } from "./record-usage.ts"

export type ReconcileUsageInput = {
  readonly usages: readonly CompletedUsage[]
  readonly ledger: UsageLedger
  readonly digimonById: ReadonlyMap<string, DigimonNode>
  readonly selector: EvolutionSelector
  readonly thresholds: StageThresholds
}

export const reconcileUsage = ({
  usages,
  ledger,
  digimonById,
  selector,
  thresholds,
}: ReconcileUsageInput): readonly UsageProcessingResult[] => {
  const outcomes: UsageProcessingResult[] = []
  for (const usage of usages) {
    outcomes.push(recordUsage({ usage, ledger, digimonById, selector, thresholds }))
  }
  return outcomes
}
