# AI Deep-Dive: Fit Engine

> The **most defensible IP** in the product. Try-on visuals commoditize; *accurate fit prediction with a trustworthy confidence score* is the moat. Mostly deterministic + light ML, improving via a feedback flywheel.

## 1. What it answers
"**Will this fit me, and how?**" — per body region, with an overall score, confidence, and a plain recommendation.

## 2. Inputs
- **Avatar measurements** (from `BodyModelService`): shoulder, chest, waist, hip, inseam, arm length, etc. (with confidence).
- **Garment data:** size chart (if available), category, cut/fit type metadata, fabric stretch hints (if present).
- **Selected size/variant.**
- **Historical fit feedback** (user + aggregate) — the flywheel.

## 3. Method (MVP: rules/regression; V2: learned)
```mermaid
flowchart TD
    M[Avatar measurements + confidence] --> C[Compare vs size-chart & garment metadata]
    G[Garment size chart / fit type] --> C
    S[Selected size] --> C
    C --> R[Per-region fit: tight/regular/loose + delta]
    R --> AGG[Aggregate → Fit Score]
    FB[(Fit feedback data)] --> CAL[Calibration model]
    CAL --> AGG
    AGG --> CONF[Confidence (from input confidences + data density)]
    AGG --> REC[Recommendation (size up/down, note)]
```

## 4. Output schema
```
FitReport {
  regions: {
    shoulder:{fit:'regular', delta_cm:+0.5, confidence:0.8},
    chest:{...}, waist:{...}, hip:{...},
    sleeve_length:{...}, garment_length:{...}, rise:{...}, shoe:{...}
  },
  overall_fit: 'regular',
  fit_score: 8.6,          # 0–10
  confidence: 0.82,        # 0–1
  issues: ["trouser length may run slightly long"],
  recommendation: "True to size; consider hemming if you prefer a break-free length."
}
```

## 5. Example (as specified)
> **FIT SCORE: 8.6/10 · CONFIDENCE: 82%**
> "Shoulder fit appears appropriate, but trouser length may be slightly long."

## 6. Confidence is mandatory
Confidence blends: avatar measurement confidence × size-chart availability/quality × feedback-data density for that brand/category. **Low confidence is surfaced honestly** ("limited size data for this brand — estimate only"). This calibration *is* the trust product.

## 7. Regions covered
Shoulder · chest · waist · hip · sleeve length · shirt/garment length · trouser length · rise · shoe proportion · overall silhouette · (V2) layering compatibility.

## 8. The feedback flywheel (moat)
```mermaid
flowchart LR
    BUY[User buys] --> ASK[Post-purchase: "did it fit?"]
    ASK --> DATA[(Fit feedback dataset)]
    DATA --> CAL[Recalibrate per brand/category/body-type]
    CAL --> BETTER[Better fit predictions]
    BETTER --> TRUST[More trust → more usage]
    TRUST --> BUY
```
Each brand/category accumulates a **true-to-size profile** — proprietary data a new entrant can't clone. This is why fit, not visuals, is the durable advantage (`investor/competitive-moat.md`).

## 9. Honesty guardrails
- Never a "guaranteed measurement" — always an estimate + confidence.
- When size charts are missing, say so and lower confidence.
- Recommendations are suggestions, not promises.

## 10. Interface (mockable)
```
FitService.analyze(avatar_measurements, garment, size) -> FitReport
```
Deterministic core → unit-testable with fixtures (see `engineering/testing.md`).
