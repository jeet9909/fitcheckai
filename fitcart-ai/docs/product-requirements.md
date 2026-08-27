# Product Requirements Document (PRD)

**Product:** FitCart AI · **Doc owner:** Product/CTO · **Status:** Phase 1 blueprint · **Version:** 0.1

## 1. Objective
Ship a mobile-first app that increases pre-purchase confidence via personalized avatar try-on + fit + outfit intelligence across multiple fashion stores, monetized by affiliate + freemium.

## 2. Goals & non-goals
**Goals (MVP):** avatar from photo; multi-angle try-on; fit score; outfit score; cross-store discovery; compliant checkout handoff; privacy-first body-data handling.
**Non-goals (MVP):** live-camera AR; real-time free-camera 3D; writing to store carts; guaranteed metric sizing; a payment/checkout system of our own.

## 3. Success metrics (see `docs`/`diagrams` and metrics section)
- Activation: % of installs that complete first try-on.
- Aha: first-try-on within first session.
- Try-on → add-to-FitCart rate.
- Handoff click-through (affiliate).
- D7/D30 retention.
- Post-purchase "fit was accurate" rate (moat signal).

## 4. Functional requirements

### 4.1 Onboarding & consent
- FR-1 Intro carousel communicating value.
- FR-2 **Granular body-data consent** (separate toggles: processing, storage, model-improvement). No pre-ticked boxes. `MUST`.
- FR-3 Account: email/OTP or social login; guest browse allowed.

### 4.2 Store connection
- FR-4 Connect stores via **affiliate/deep-link sources** (MVP). Credential login **out of scope** for MVP. `MUST`.
- FR-5 Per-store **capability display** (what's supported) driven by adapter `CapabilitySet`. `MUST`.

### 4.3 Product discovery
- FR-6 Search + browse across connected sources (Amazon PA-API + affiliate feeds).
- FR-7 Normalized product model (title, images, price, sizes, colors, availability, store, deep-link). `MUST`.
- FR-8 Filters: category, price, size, color, store.

### 4.4 Body capture & avatar
- FR-9 Upload full-body front photo; optional side + back. `MUST`.
- FR-10 **Validation**: pose, lighting, distance, full-body visibility, background, crop → actionable feedback + retake. `MUST`.
- FR-11 Async avatar generation with progress + push on completion. `MUST`.
- FR-12 Avatar reflects body shape, proportions, skin tone, posture; **confidence score** shown. `MUST`.
- FR-13 Body profile versioning; user can regenerate/delete. `MUST`.

### 4.5 Outfit builder & try-on
- FR-14 Add multiple items across categories/stores into an outfit. `MUST`.
- FR-15 Render outfit on avatar; **multi-angle (≥8 yaw) viewer** + zoom. `MUST`.
- FR-16 Show/hide individual items; change variant/color where available. `SHOULD`.
- FR-17 Compare two outfits. `SHOULD` (V2 if time-constrained).

### 4.6 Fit intelligence
- FR-18 Fit Report: per-region fit (shoulder/chest/waist/hip/sleeve/length/rise/shoe), overall **Fit Score + confidence + recommendation**. `MUST`.
- FR-19 Never present as guaranteed measurement; always confidence-qualified. `MUST`.

### 4.7 Outfit intelligence
- FR-20 Outfit Score: color harmony, occasion suitability, body-shape compatibility, style compatibility, trend. `MUST` (rules-based acceptable for MVP).

### 4.8 Texture/detail mode
- FR-21 Zoom into high-res product/generated imagery with optional super-resolution. `SHOULD`.

### 4.9 Cart & handoff
- FR-22 FitCart internal cart (per outfit / per item). `MUST`.
- FR-23 Checkout handoff via deep-link + affiliate attribution. `MUST`.
- FR-24 "Sync to store cart" shown only for partner-enabled stores. `COULD` (V3).

### 4.10 Profile, privacy, settings
- FR-25 Delete body data / account (DPDP right). `MUST`.
- FR-26 Data export. `SHOULD`.
- FR-27 Accessibility: WCAG 2.2 AA, textual fit narration. `MUST` baseline.

## 5. Non-functional requirements
| Area | Requirement |
|---|---|
| Performance | App usable on mid-range Android; avatar job target < ~60s p50 `UNVERIFIED` until benchmarked |
| Availability | 99.5% API uptime target |
| Security | Encryption in transit + at rest; no third-party shopping passwords stored (MVP) |
| Privacy | DPDP + GDPR-ready; data minimization; region-appropriate storage |
| Scalability | Stateless API + async GPU workers; horizontal scale |
| Accessibility | WCAG 2.2 AA; screen-reader complete |
| Cost | Per-try-on inference cost tracked; free-tier limits enforced |

## 6. Priority labels (MoSCoW) summary
- **MUST:** onboarding+consent, discovery, avatar+validation, try-on+viewer, fit score, outfit score, internal cart, handoff, delete-data, AA baseline.
- **SHOULD:** variant swap, texture SR, compare outfits, export.
- **COULD:** partner cart-sync, social sharing, seated-posture avatars.
- **WON'T (MVP):** live AR, real-time 3D cloth sim, store credential login, our own checkout.

## 7. Assumptions & dependencies
- Affiliate network coverage sufficient for a browsable catalog. `UNVERIFIED` → validate Week 1–2.
- Hosted try-on API quality acceptable on India catalog imagery. `UNVERIFIED` → benchmark Week 4–6.
- SMPL(-X) commercial licensing budgeted, or avatar SDK chosen.
- Legal review of affiliate feed display terms per network.

## 8. Open decisions (tracked in `DECISION_LOG.md`)
- Buy vs build avatar. · Which affiliate network(s). · Hosted vs self-hosted try-on at what volume.
