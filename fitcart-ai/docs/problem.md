# Problem Statement

## 1. The headline problem
**Online fashion has a confidence problem, and it shows up as returns.** Shoppers cannot reliably judge, before buying, whether an item will **fit their body** or **work as part of an outfit**. So they over-order, hesitate, or abandon — and retailers eat the cost.

## 2. Four compounding frictions

### 2.1 Fit / sizing uncertainty
- Sizing is inconsistent across brands and platforms (a "M" varies wildly).
- Model photos show one idealized body — rarely the shopper's.
- Size charts are numbers without embodiment ("will 40" waist actually sit right on *me*?").
- **Result:** the #1 driver of fashion returns is size/fit. Industry return rates for online apparel commonly cited at **~25–40%** (`UNVERIFIED` precise India figure — treat as directional; validate in pilot).

### 2.2 Outfit uncertainty
- A garment may look fine alone but clash in a full outfit (color, formality, proportion).
- Shoppers lack a tool to compose and evaluate a **complete look** (top + bottom + shoes + accessories) before buying.
- Styling advice is generic, not personalized to body shape, skin tone, or occasion.

### 2.3 Cross-platform friction
- The average fashion shopper uses **multiple apps** (Myntra, Ajio, Amazon, Flipkart, Nykaa, Meesho…).
- No single place to **compare and combine** items across those stores into one outfit.
- Prices, discounts, and availability are fragmented; comparison is manual.
- Each store is a walled garden optimizing for *its* catalog, not the shopper's best outfit.

### 2.4 Visualization gap
- "Try-on" tools that exist are usually **single-brand**, **single-garment**, or **AR-camera** based.
- None let a shopper see a **full outfit assembled from multiple stores** on a body that resembles their own, from multiple angles.

## 3. Who feels this pain most
- **Value-conscious shoppers** who can't afford wrong-size purchases or return hassle.
- **Body-diverse shoppers** (plus-size, petite, tall, non-standard proportions) failed by standard sizing and idealized model imagery.
- **Fashion-forward shoppers** who care intensely about the *complete look* and cross-brand mixing.
- **Accessibility-affected shoppers** (mobility, prosthetic users) for whom in-store trying-on is hard and standard model imagery is alienating.

## 4. Why existing solutions fall short (evidence)
| Existing solution | Why it doesn't solve this |
|---|---|
| Marketplace size charts / "size recommendation" | Numbers, not embodiment; single-store; ignore outfit-level fit |
| Marketplace AR/try-on (Myntra, Nykaa beauty) | Narrow (beauty/accessory), single-catalog, no fit *score* |
| Google Doppl / Shopping Try-On | Great visuals, but **no fit analysis, no outfit scoring, not tied to your connected stores' checkout** |
| Walmart / Zeekit | US + Walmart-catalog only |
| Snap / Vyking AR | Camera-AR, accessory/footwear focus, brand-by-brand |
| Free returns | Treats the symptom (returns) — expensive for retailers, high-friction for users, environmentally costly |

## 5. The cost of the problem
- **For shoppers:** wasted money, return logistics, decision fatigue, low confidence, poor outfits.
- **For retailers:** returns erode already-thin fashion margins; reverse logistics, restocking, and write-offs; lower conversion from low-confidence browsers.
- **For the planet:** returns drive transport emissions and product waste.

## 6. The opportunity framing
> If we can raise a shopper's **pre-purchase confidence** — "this fits me and this outfit works" — we simultaneously **increase conversion**, **reduce returns**, and **earn trust**. That triple win is the wedge FitCart AI drives into.

## 7. Problem hypotheses to validate (Week 1)
- **H1:** Fit/size uncertainty is the primary purchase blocker for ≥50% of target users. *(survey + interviews)*
- **H2:** Users regularly shop ≥3 fashion apps and want cross-store outfit building. *(survey)*
- **H3:** A personalized avatar preview + fit score meaningfully increases purchase confidence vs. a model photo. *(prototype test)*
- **H4:** Users will accept uploading body photos if privacy is clearly guaranteed. *(consent-flow test)*

These hypotheses gate the build. See `roadmap/90-day-plan.md`.
