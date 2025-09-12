import { SlopeColor } from "../types"

export function colorForGrade(g: number, buckets: SlopeColor[]) {
  return (buckets.find((s) => g <= s.upTo) || buckets.at(-1)!)!.color
}
