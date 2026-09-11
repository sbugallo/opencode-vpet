/** Returns value in [0, 1) safe for index selection. */
export const normalizedRandom = (random: () => number): number => {
  const sample = random()
  if (!Number.isFinite(sample) || sample <= 0) return 0
  return sample >= 1 ? 1 - Number.EPSILON : sample
}
