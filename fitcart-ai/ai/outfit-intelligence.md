# AI Deep-Dive: Outfit Intelligence

> Answers "**does this outfit work?**" — the second half of the confidence product (fit = "does it fit me", outfit = "does the look work"). MVP is rules-based (explainable, cheap); V2 adds learned embeddings.

## 1. Dimensions scored
| Dimension | MVP method | Signal |
|---|---|---|
| **Color harmony** | Color theory in LAB/HSV (complementary/analogous/neutral rules) + contrast | Do the colors work together? |
| **Occasion suitability** | Category/formality classifier + user-chosen occasion | Office / casual / party / wedding fit |
| **Body-shape compatibility** | Silhouette rules vs avatar body-shape | Proportion-flattering guidance |
| **Style compatibility (item↔item)** | Style-tag graph (e.g., streetwear↔formal clash) | Do items belong together? |
| **Trend score** (V2) | Trend signals / popularity data | Is the look current? |
| **Composite Outfit Score** | Weighted blend | Single 0–10 headline |

## 2. Pipeline
```mermaid
flowchart TD
    ITEMS[Outfit items + metadata] --> COLOR[Color harmony]
    ITEMS --> STYLE[Style compatibility]
    ITEMS --> OCC[Occasion/formality]
    PROFILE[User profile + avatar body-shape + prefs] --> BODY[Body-shape compat]
    OCCSEL[User-selected occasion] --> OCC
    COLOR --> AGG[Weighted composite]
    STYLE --> AGG
    OCC --> AGG
    BODY --> AGG
    TREND[Trend data (V2)] --> AGG
    AGG --> OUT[Outfit Score + rationale + suggestions]
```

## 3. Output schema
```
OutfitScore {
  color_harmony: 8.2,
  occasion: {target:'smart-casual', suitability: 8.5},
  body_shape_compat: 7.9,
  style_compat: 8.0,
  trend: 7.0,            # V2
  composite: 8.1,        # 0–10
  rationale: ["navy + white = high-contrast neutral pairing", "smart-casual appropriate"],
  suggestions: ["a brown belt would tie the shoes and watch together"]
}
```

## 4. Why rules-first
- **Explainable:** users trust "navy pairs well with white" over a black-box number.
- **Cheap & fast:** no heavy inference.
- **Cold-start proof:** works before we have usage data.
V2 layers **learned outfit embeddings** (compatibility trained on curated/expert/co-purchase data) and personalization (learns the user's taste), stored in **pgvector**.

## 5. Personalization (V2+)
- Learn user preferences from saved outfits, likes, purchases.
- Blend personal taste with universal rules (don't override "clashing" just because a user likes it — surface both).
- Recommend completions ("add a jacket for this occasion").

## 6. Data sources
- Product metadata (color, category, style tags) from adapters.
- Curated style rules (fashion-expert-authored) for MVP.
- (V2) co-purchase / co-save signals; trend feeds.

## 7. Honesty & taste
Style is subjective. The engine gives **guidance + rationale**, never a verdict that shames the user. Low-confidence or unusual-but-intentional combos are noted, not penalized silently.

## 8. Interface (mockable)
```
OutfitService.score(items[], user_profile) -> OutfitScore
```
Rules core → unit-testable; embeddings adapter added in V2.

## 9. Relationship to fit
Fit and outfit scores are **complementary and both shown**: an outfit can score high on style but flag a fit issue on one item. Together they form the "buy with confidence" summary that is FitCart's core value.
