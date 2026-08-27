# Deep Competitor Research

**Research date:** August 2026. Ratings are the analyst's structured judgment on a 1–10 scale (10 = best-in-class) based on public information. Where a capability is not publicly confirmed, it is marked `UNVERIFIED`. FitCart AI is scored on *planned MVP+V2* capability and clearly labelled as **target**, not shipped.

---

## 1. Two competitor groups (they are not the same threat)

1. **Destination marketplaces** (Myntra, Ajio, Amazon Fashion, Meesho, Flipkart, Nykaa) — where people actually buy. They are **channels/partners AND the source of our data problem**, not head-to-head try-on competitors (yet).
2. **Try-on / avatar technology players** (Google Doppl + Shopping Try-On, Walmart "Be Your Own Model"/Zeekit, Snap, Reactive Reality, Vyking, Fashable, and other AI-fashion startups) — the **real technical competition**.

FitCart's differentiated wedge is being a **cross-store intelligence + visualization layer** — something the marketplaces won't build (they only cover their own catalog) and the pure-tech players mostly don't do (they're single-brand or single-image tools).

---

## 2. Marketplace incumbents (channels, not try-on rivals)

| Platform | Try-on today | Multi-store | Fit analysis | Cart openness | Rating (as *try-on/aggregation* rival) |
|---|---|---|---|---|---|
| **Myntra** | Limited/experimental beauty & some AR; primarily size recommendations | ❌ own catalog only | Size-recommendation (algorithmic) | ❌ closed | **3/10** |
| **Ajio** | Minimal | ❌ | Basic | ❌ closed | **2/10** |
| **Amazon Fashion** | "Virtual Try-On for shoes/apparel" in some markets; strong size guidance | ❌ own | Good size data | ⚠️ PA-API read only | **4/10** |
| **Meesho** | ❌ | ❌ | ❌ | ❌ | **2/10** |
| **Flipkart** | Some AR/beauty experiments | ❌ | Basic | ❌ | **3/10** |
| **Nykaa Fashion** | Beauty AR (skin/makeup) strong; fashion try-on limited | ❌ | Basic | ❌ | **3/10** |

**Takeaway:** none offer *cross-store* outfit building or personalized-avatar full-body try-on. Their strength is **owning checkout, inventory, and trust**; their weakness (our opening) is **single-catalog silos and weak full-outfit visualization.**

---

## 3. Try-on / avatar technology players (the real competition)

### 3.1 Google — Doppl + Shopping "Try On"  ⭐ biggest threat
- **What:** Doppl (Labs app, launched June 2025) generates AI video of *you* in any outfit from a photo; Google Shopping Try-On (expanded Oct 2025 to more countries + shoes) applies apparel to a chosen or uploaded body via generative AI.
- **Strengths:** world-class generative models, distribution (Search/Shopping/Android), free, SynthID watermarking, trust.
- **Weaknesses:** **single-image generative, not a personalized measured 3D avatar; no fit analysis / no fit score; no cross-store cart; tied to Google's shopping graph; not outfit-fit-intelligence.**
- Try-on realism **9** · Fit analysis **2** · Multi-store **6** (shopping graph, but not *your* connected accounts/cart) · Cart integration **3** · Personalization **6** · Privacy **6** · Scalability **10**
- **Composite: 8.5/10** (as a try-on visual tool). **Our counter:** Google shows *how it looks*; FitCart tells you *whether it fits and whether the outfit works*, across the stores you actually shop, with a fit + outfit score. Depth of fit intelligence + India-first catalog + outfit composition is our defensible gap.

### 3.2 Walmart — "Be Your Own Model" / Zeekit
- **What:** Walmart acquired Zeekit (2021); powers on-site try-on across 270k+ items, "choose a model" + "be your own model."
- **Strengths:** real retail integration, scale, good image try-on.
- **Weaknesses:** **US + Walmart catalog only; not a standalone product; no cross-store; no independent fit-score product.**
- Realism **7** · Fit **4** · Multi-store **1** · Cart **8 (own)** · Personalization **6** · Privacy **6** · Scalability **8** → **Composite 6/10**. **Not a competitor in India.** Proof that retailers value this tech (validates our thesis).

### 3.3 Snap (AR try-on / dressing)
- **What:** AR try-on lenses, ARES/Shopping AR SDKs for brands.
- **Strengths:** best-in-class real-time AR, huge reach, brand tools.
- **Weaknesses:** **AR camera-based (not our model), accessory/shoe/eyewear strength > full-garment fit; no fit analysis; brand-by-brand; no cross-store cart.**
- Realism **7 (AR)** · Fit **3** · Multi-store **3** · Cart **3** · Personalization **5** · Privacy **5** · Scalability **9** → **Composite 6/10.** Different modality; overlaps on eyewear/watch/accessory try-on.

### 3.4 Reactive Reality (PICTOFiT)
- **What:** avatar + garment 3D/2D try-on platform for retailers (B2B). `UNVERIFIED` current corporate status/ownership — re-check.
- **Strengths:** genuine avatar + outfit combination, mix-and-match, B2B maturity.
- **Weaknesses:** B2B/white-label, not a consumer cross-store app; integration-heavy.
- Realism **7** · Fit **6** · Multi-store **4** · Cart **3** · Personalization **6** · Privacy **6** · Scalability **6** → **Composite 6/10.** Closest *conceptually* (avatar + outfit) but B2B and not cross-store consumer.

### 3.5 Vyking
- **What:** AR try-on specialists — footwear & accessories (sneakers) for brands.
- **Strengths:** excellent foot/shoe AR tracking.
- **Weaknesses:** narrow (footwear/accessory), AR-based, B2B, no full outfit/fit.
- Realism **7** · Fit **4** · Multi-store **2** · Cart **2** · Personalization **4** · Scalability **7** → **Composite 5/10.**

### 3.6 Fashable / AI-generative fashion startups
- **What:** generative AI for fashion imagery / on-model generation (marketing & try-on).
- **Strengths:** cheap on-model content, generative quality.
- **Weaknesses:** mostly content-gen/B2B, not consumer fit + cross-store.
- **Composite ~5/10.**

### 3.7 Other notable
- **Style.me, Perfect Corp (YouCam), Sizekit/3DLOOK/Zyler, Bods, Veesual, Doji-style avatar apps** — mix of B2B sizing, beauty AR, and consumer avatar apps. **Class weakness is consistent: single-brand OR sizing-only OR AR-beauty — none combine cross-store outfit building + personalized fit-scored full-body avatar.** `UNVERIFIED` individual current status.

---

## 4. Master comparison table (FitCart AI as benchmark)

Scores 1–10. **FitCart = target MVP+V2.**

| Capability | **FitCart AI (target)** | Google Doppl | Walmart/Zeekit | Snap | Reactive Reality | Vyking | Myntra |
|---|---|---|---|---|---|---|---|
| Personalized full-body avatar | **8** | 6 | 6 | 4 | 7 | 3 | 2 |
| Try-on realism | **7** | 9 | 7 | 7 | 7 | 7 | 3 |
| **Fit analysis + score** | **9** | 2 | 4 | 3 | 6 | 4 | 5 |
| **Outfit intelligence (multi-item)** | **9** | 4 | 3 | 3 | 6 | 2 | 3 |
| **Multi-store / cross-catalog** | **8** | 6 | 1 | 3 | 4 | 2 | 1 |
| Cart integration | **4** ⚠️ | 3 | 8(own) | 3 | 3 | 2 | 8(own) |
| AI personalization | **8** | 6 | 6 | 5 | 6 | 4 | 5 |
| Privacy posture | **8** (design goal) | 6 | 6 | 5 | 6 | 5 | 5 |
| Scalability | **6** (startup) | 10 | 8 | 9 | 6 | 7 | 9 |
| **Composite (weighted to our thesis)** | **8.0 target** | 8.5 | 6.0 | 6.0 | 6.0 | 5.0 | 3.5 |

> **Honest note:** Google scores *higher on raw try-on realism and scale today.* FitCart does **not** win on generative image quality — it wins on **fit intelligence + outfit composition + cross-store coverage + India-first depth.** Our cart score is deliberately low (4) — that reflects the platform-API reality, not an aspiration inflated on a slide.

---

## 5. "Why would a user choose FitCart AI?"
1. **It answers the real question** — not just "how does it look" but **"will it fit me, and does this outfit work?"** with a score.
2. **It spans the stores they already use** — one outfit can mix a Myntra shirt + Ajio jeans + Amazon shoes.
3. **It composes whole outfits**, not single garments.
4. **India-first** catalog, sizing norms, body diversity, price sensitivity — where Google/Walmart are US-centric.

## 6. "What stops a competitor from copying us?"
Honestly: **big players could**, technically. Our defensibility is **not the try-on model** (commoditizing fast). It is:
- **Proprietary fit + outfit datasets** (avatar↔purchase↔return↔satisfaction loops) that improve with usage — a data network effect.
- **Cross-store neutrality** — marketplaces *won't* build a tool that sends users to rivals; that's structurally ours.
- **Trust + privacy brand** around body data in India.
- **Speed & focus** in an India-first niche the giants treat as secondary.

See `investor/competitive-moat.md` and `docs/competitive-analysis.md` for the moat and the attack matrix.
