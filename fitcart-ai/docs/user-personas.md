# User Personas

Six primary personas. Each drives concrete product requirements — accessibility personas are **first-class**, not afterthoughts.

---

## 1. Aarav — The College Shopper (18–22)
- **Context:** Tight budget, trend-driven, shops sales across Myntra/Ajio/Meesho on a mid-range Android on patchy 4G.
- **Goals:** Look good cheaply; avoid wasting money on wrong-size buys; copy trends to his body.
- **Frustrations:** Returns are a hassle; unsure how trend items look on *his* frame; juggling apps.
- **What FitCart gives him:** Cross-store bargain outfits, fit score before buying, low-data mode.
- **Requirements driven:** Low-end device performance, data-saver mode, price-first sorting, fast free-tier try-on.

## 2. Priya — The Working Professional (25–35)
- **Context:** Time-poor, values convenience, shops for work + occasion wear, mid/premium, iOS or premium Android.
- **Goals:** Reliable fit, polished outfits for specific occasions, minimal decision time.
- **Frustrations:** Returns waste time she doesn't have; wants "is this office-appropriate and does it fit?"
- **What FitCart gives her:** Occasion suitability scoring, confident fit, saved outfits, Pro quality.
- **Requirements driven:** Occasion/formality intelligence, fast reliable results, Pro tier, calendar-style occasion presets.

## 3. Zoya — The Fashion Enthusiast (20–30)
- **Context:** Highly engaged, mixes brands, follows trends, shares looks, high AOV.
- **Goals:** Craft distinctive multi-store outfits; evaluate bold combinations; express identity.
- **Frustrations:** No tool composes a full cross-brand look with real critique.
- **What FitCart gives her:** Outfit intelligence (color/trend/style), compare-two-outfits, HD studio renders, sharing.
- **Requirements driven:** Advanced outfit engine, outfit comparison, shareable renders, trend scoring, social hooks.

## 4. Meera — The Plus-Size User (any age)
- **Context:** Repeatedly failed by standard sizing and idealized model imagery; high fit anxiety; high return rate.
- **Goals:** See clothes on a body **like hers**; trustworthy fit guidance; dignity, not tokenism.
- **Frustrations:** Models never match her body; sizes inconsistent; brands "run small" unpredictably.
- **What FitCart gives her:** Avatar that reflects her real shape, honest fit score with confidence, brands' true-to-size signal.
- **Requirements driven:** Robust body-shape coverage across the full size range, inclusive avatar generation, fit-model calibrated on diverse bodies, respectful copy. **This persona is a core differentiator vs. US-centric rivals.**

## 5. Raghav — The Accessibility-Focused User
- **Context:** Uses a screen reader / larger text / high-contrast; may have low vision or motor constraints.
- **Goals:** Fully usable app; understandable fit information without relying solely on visuals.
- **Frustrations:** Most try-on apps are visual-only and inaccessible.
- **What FitCart gives him:** Screen-reader-complete flows, **text + audio fit descriptions** (not just imagery), large-touch targets, WCAG-compliant contrast.
- **Requirements driven:** WCAG 2.2 AA, semantic labels on the 360° viewer, textual fit narration, keyboard/switch navigation, no colour-only signaling.

## 6. Kabir — The Prosthetic / Mobility-Impaired User
- **Context:** Uses a prosthetic limb or a wheelchair; in-store trying is physically hard; standard avatars erase him.
- **Goals:** An avatar that reflects his body reality; fit guidance relevant to seated posture or a prosthesis; to feel *seen*.
- **Frustrations:** Every try-on tool assumes a standing, non-disabled, standard body.
- **What FitCart gives him (roadmap-honest):** MVP: respectful handling + best-effort avatar + clear limits. V2/V3: **seated-posture avatars, prosthesis-aware options, adaptive-clothing tagging.**
- **Requirements driven:** Posture options (standing/seated), avatar customization for limb differences, adaptive-fashion metadata, and **honesty about current limits** (never render a body that misrepresents him). Flagged as `V2/V3` for full support; MVP must at least **not fail or offend**.

---

## Persona → priority matrix
| Persona | MVP priority | Key feature dependency |
|---|---|---|
| College Shopper | ⭐⭐⭐ | Low-end perf, price sort, free try-on |
| Working Professional | ⭐⭐⭐ | Occasion intelligence, Pro tier |
| Fashion Enthusiast | ⭐⭐ | Outfit engine, sharing, HD renders |
| Plus-Size User | ⭐⭐⭐ | Inclusive avatar + fit calibration |
| Accessibility-Focused | ⭐⭐ (baseline AA from day one) | WCAG, textual fit narration |
| Prosthetic/Mobility | ⭐ (respectful MVP, full support V2/V3) | Posture + limb customization |

**Design principle:** the plus-size and accessibility personas are where incumbents are weakest and where FitCart earns loyalty. We build *with* them, not *for* an average.
