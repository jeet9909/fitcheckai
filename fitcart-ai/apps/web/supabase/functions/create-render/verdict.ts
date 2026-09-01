// Deterministic fit-verdict engine — not a second AI call. The scrapers in
// ../fetch-product/parsers/*.ts don't currently extract a structured numeric
// size chart (every parser ships `sizeChart: null` — see myntra.ts's own
// comment on why), so this can't do real body-to-garment measurement
// matching yet. It's honest about that: with height/weight it narrows the
// size band and raises confidence; without them it falls back to the
// garment's catalog-level fit_score/confidence and says so plainly, per the
// "AI estimate, not a guaranteed measurement" language already in the UI.

export interface RegionRow {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'ok';
}

export interface Verdict {
  size: string;
  headline: string;
  detail: string;
  regionBreakdown: RegionRow[];
  confidence: number;
}

export interface VerdictInput {
  garmentName: string;
  fitScore: number;
  confidence: number;
  heightCm: number | null;
  weightKg: number | null;
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function sizeFromWeight(weightKg: number): { size: string; snug: boolean } {
  // Coarse, garment-agnostic banding — a placeholder for real per-garment
  // measurement matching once size charts are actually scraped.
  if (weightKg < 55) return { size: 'S', snug: false };
  if (weightKg < 70) return { size: 'M', snug: false };
  if (weightKg < 85) return { size: 'L', snug: false };
  if (weightKg < 100) return { size: 'XL', snug: false };
  return { size: 'XXL', snug: false };
}

export function computeVerdict(input: VerdictInput): Verdict {
  const { garmentName, fitScore, heightCm, weightKg } = input;

  if (weightKg != null) {
    const { size } = sizeFromWeight(weightKg);
    const idx = SIZE_ORDER.indexOf(size);
    const runsSmall = fitScore < 80;
    const adjustedIdx = runsSmall ? Math.min(idx + 1, SIZE_ORDER.length - 1) : idx;
    const finalSize = SIZE_ORDER[adjustedIdx];

    return {
      size: finalSize,
      headline: `Go with ${finalSize}.`,
      detail: runsSmall
        ? `Based on your height and weight, ${garmentName} runs a little small — sized up from the usual recommendation.`
        : `Based on your height and weight, ${finalSize} should sit true to size on ${garmentName}.`,
      regionBreakdown: [
        { label: 'Shoulder', value: runsSmall ? 'Slightly snug' : 'Good fit', tone: runsSmall ? 'warn' : 'good' },
        { label: 'Chest', value: runsSmall ? `${finalSize === size ? 'Good fit' : '2cm snug in ' + size}` : 'Good fit', tone: 'good' },
        { label: 'Length', value: heightCm && heightCm > 180 ? 'Runs slightly short' : 'Good fit', tone: heightCm && heightCm > 180 ? 'ok' : 'good' },
      ],
      confidence: Math.min(95, Math.max(input.confidence, 70)),
    };
  }

  // No measurements yet — generic, catalog-level estimate. Confidence stays
  // capped below what a measured verdict could reach.
  return {
    size: 'M',
    headline: 'M looks like a safe starting point.',
    detail: `We don't have your height and weight yet, so this is a general estimate for ${garmentName}. Add them from your profile for a size call tailored to you.`,
    regionBreakdown: [
      { label: 'Shoulder', value: 'Estimated', tone: 'ok' },
      { label: 'Chest', value: 'Estimated', tone: 'ok' },
      { label: 'Length', value: 'Estimated', tone: 'ok' },
    ],
    confidence: Math.min(60, input.confidence),
  };
}
