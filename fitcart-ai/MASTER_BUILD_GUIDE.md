# FitCart AI — Master Build & Stack Guide (End-to-End)

> **One file, everything:** what to build, the exact stack to use at each layer, what's live today, and — most importantly — **the ladder that takes the AI output from "good demo" to "production-grade" (better and better)**. Honest labels throughout: `LIVE` · `BUILT` · `TO BUILD` · `PARTNERSHIP REQUIRED` · `HIGH RISK` · `UNVERIFIED`.
>
> Last updated: this session. Companion detail lives in `docs/`, `architecture/`, `ai/`, `engineering/`, `research/`, `DECISION_LOG.md`.

---

## 0. What FitCart AI is (in one paragraph)
An **AI try-on + fit-intelligence layer between shoppers and the fashion stores they already use** (Myntra, AJIO, Amazon, Flipkart, Nykaa, Meesho). The user builds an outfit across stores, previews it on a **personalized avatar** made from their photos, gets a **Fit Score** and **Outfit Score** (both with a confidence), then hands off to the store to buy (affiliate-attributed). **Not a marketplace** — an intelligence/visualization layer. The moat is **fit-data**, not the try-on model.

---

## 1. Current status (what exists right now)

| Piece | Status | Where |
|---|---|---|
| **Full blueprint** (60+ docs: market, competitors, architecture, AI, compliance, cost) | `LIVE` | `fitcart-ai/` |
| **Web app** — accounts, tier access control, studio, cart, pricing, admin, saved/orders/wishlist/compare | `LIVE` at **https://jeet9909.github.io/fitcartai/** | repo `jeet9909/fitcartai` (GitHub Pages, auto-deploy on push to `main`) |
| **Backend** — FastAPI modular monolith, auth, catalog+adapters, avatar/try-on jobs, photo try-on (Pro tier), real fit & outfit engines, cart handoff; 21 tests passing | `BUILT` (not yet hosted) | `interactive-demo/backend/` (moved into the web app's repo so frontend + backend share one GitHub repo) |
| **Real AI models** (body reconstruction, generative try-on) | `TO BUILD` (mock adapters in place, swappable) | `backend/app/services/ai/` |
| **Mobile app (Flutter)** | `TO BUILD` (needs Flutter SDK) | `fitcart-ai/mobile/` (reserved) |
| **Backend hosting + wiring web→API** | `TO BUILD` (needs a host) | — |

---

## 2. End-to-end requirements (condensed)

### 2.1 Core user journey
`Discover (cross-store) → Select items → Upload photo → Avatar → Try-on (multi-angle) → Fit Score + Outfit Score → Add to cart → Checkout handoff to store (affiliate)`

### 2.2 Functional requirements (MUST)
- Accounts (OTP/social), **granular body-data consent** (DPDP gate).
- Cross-store discovery (search/filter), normalized product model.
- Body photo upload + **capture validation** (pose/light/distance/visibility).
- Async **avatar generation** with a **confidence score** (never a guaranteed measurement).
- **Try-on** rendered as a **multi-angle set** (MVP) — honest "not free-camera 3D".
- **Fit engine** (per-region fit + score + confidence + recommendation).
- **Outfit engine** (colour/occasion/body-shape/style → composite score).
- Internal cart + **compliant checkout handoff** (deep-link + affiliate; partner cart-sync where a deal exists).
- **Post-purchase fit feedback** ("did it fit?") — the moat dataset.
- Delete body data/account (DPDP erasure).
- Tier-based access control (Guest → Style → Pro → Studio 3D).

### 2.3 Non-functional (MUST)
Mid-range Android + data-saver · WCAG 2.2 AA + textual fit narration · encryption in transit+at rest · no third-party shopping passwords stored · confidence on every AI estimate · cost-per-inference tracked.

### 2.4 Explicitly OUT (MVP)
Live camera AR · real-time 3D cloth sim · store credential login · true cart-sync (partnership-only) · guaranteed measurements · our own checkout.

### 2.5 The hard truth (do not build on this fault line)
**No target Indian store exposes an official cart/catalog API.** Cart-sync is `PARTNERSHIP REQUIRED`; browser automation is `HIGH RISK` (ToS + DPDP) — **not built**. MVP monetizes via **affiliate networks (Admitad/Cuelinks) + Amazon PA-API + deep-links**. (`research/platform-api-research.md`.)

---

## 3. THE STACK — end to end (what to use at each layer, and why)

> Rule: **buy/managed first, self-host when volume justifies it.** Every choice is already decided in `DECISION_LOG.md`; don't re-litigate.

### 3.1 Frontend — Web (LIVE) and Mobile (planned)
| Layer | Use | Why | Status |
|---|---|---|---|
| **Web app** | **React 18 + TypeScript + Vite**, HashRouter, custom CSS design system, inline SVG | fast, no-config static build, deploys anywhere; no broken external assets | `LIVE` |
| **Mobile app** | **Flutter (Dart)** — Clean Architecture + Riverpod, go_router, dio, isar/secure_storage | one codebase iOS+Android, best custom-UI/animation for the viewer, strong mid-range-Android perf | `TO BUILD` (needs Flutter SDK) |
| **3D/360 viewer** | MVP: image-sequence multi-angle viewer → V3: `flutter_gl`/filament or three.js (web) real 3D | honest "multi-angle" now; true 3D later without rewrite (interface-based) | MVP done in web |
| **Web hosting** | **GitHub Pages** (auto-deploy via Actions) → optionally Cloudflare Pages/Vercel later | free, public, CI-driven | `LIVE` |

### 3.2 Backend (BUILT — needs hosting)
| Layer | Use | Why | Status |
|---|---|---|---|
| **API framework** | **Python + FastAPI** (modular monolith) | one language with the AI/ML stack; async; fast dev | `BUILT` |
| **ORM/DB access** | **SQLAlchemy 2.0 async** + Alembic (migrations) | portable, typed | `BUILT` (Alembic `TO BUILD`) |
| **Database** | dev: **SQLite** · prod: **PostgreSQL** (+ `pgvector` for recs) | integrity + JSONB + vector search; one store to run | dev live; Postgres `TO BUILD` |
| **Cache / queue** | dev: in-process · prod: **Redis + Celery** (→ RabbitMQ/Kafka at scale) | async GPU jobs off the request path | interface `BUILT`; prod `TO BUILD` |
| **Object storage** | **Cloudflare R2** (S3-compatible, zero egress) + CDN | image/render heavy → egress savings | `TO BUILD` |
| **Auth** | **JWT** access+refresh, OTP/social; **never store store passwords** | security red line | `BUILT` |
| **Hosting** | **Render / Railway / Fly.io** (container) or a small VPS; GPU workers separate | runs the stateful async app + workers | `TO BUILD` (needs your account) |

### 3.3 Infra / DevOps
Docker + docker-compose · GitHub Actions CI/CD · Terraform (IaC) · Sentry (errors) · OpenTelemetry + Grafana/Prometheus · secrets manager · **cost-per-inference as a first-class metric**. `TO BUILD` (Dockerfile for backend already written).

---

## 4. ⭐ THE AI STACK + "BETTER AND BETTER OUTPUT" LADDER

> This is the heart of your question. The product experience improves along **four independent levers**. You climb each ladder as usage/revenue grow. **Every model passes a license-review gate** (SMPL commercial license is a real cost — don't assume free).

### 4.1 The four AI capabilities (all behind swappable interfaces — `backend/app/services/ai/`)
| Capability | What it does | MVP (now) | Better | Best |
|---|---|---|---|---|
| **Body / Avatar** | photo → body model | mock params from height | image→**SMPL(-X)** regression (HMR/CLIFF class) | multi-photo/video → textured 3D / Gaussian-splat avatar |
| **Virtual Try-On** | garment on body | mock multi-angle | **2D/2.5D generative** (hosted API) | 3D cloth simulation on partner garment assets |
| **Fit engine** | will it fit me? | **real rules engine** (built) | + per-brand calibration from feedback | learned fit model on the flywheel data |
| **Outfit engine** | does the look work? | **real rules engine** (built) | + learned embeddings (pgvector) | personalized taste model |

### 4.2 Lever 1 — Better **models** (the try-on/avatar quality ladder)
Climb this as GPU budget grows:
1. **Mock** (now) → prove the app end-to-end, zero cost.
2. **Hosted generative try-on API** (fal.ai / Replicate / Google-class) — fastest path to "wow". Pay per image. `UNVERIFIED` which yields best India-catalog quality → **benchmark on real target images first**.
3. **Open self-host** (IDM-VTON / OOTDiffusion / CatVTON class for try-on; HMR2.0/4DHumans for body) on your own GPUs when volume makes per-inference cost cross over (~10k–100k active users). Big cost step-down.
4. **3D + cloth sim** (V3) — needs 3D garment assets stores don't provide → `PARTNERSHIP REQUIRED` (brands) or asset-generation R&D.

**Supporting perception models (self-host, permissive licenses):** person detection (RT-DETR/YOLOX-Apache — avoid AGPL YOLO), pose (MediaPipe/ViTPose), human parsing/segmentation (SAM2/Sapiens), monocular depth (Depth-Anything), super-resolution for texture (Real-ESRGAN).

### 4.3 Lever 2 — Better **inputs** (more signal → more accuracy)
- 1 photo + height (MVP, ±5–10% `UNVERIFIED`) → **+ side + back photos** (±3–6%) → **multi-photo/short video** (near-production 3D).
- Always request **height** (metric anchor); weight optional to refine shape.
- **Capture validation** up front (pose/light/distance/visibility) — bad input is the #1 quality killer; reject + guide a retake before spending inference.

### 4.4 Lever 3 — The **data flywheel** (the compounding moat — this is what makes it "better and better" for free)
```
User buys → post-purchase "did it fit?" feedback → per-brand/per-body true-to-size dataset
   → recalibrate the fit engine → better predictions → more trust → more usage → more feedback ↺
```
- Built already: `POST /v1/fit/feedback` captures the signal.
- **This is the durable advantage** — a new entrant starts at zero; you compound. Later: train a learned fit model on this data; sell it as the **B2B Fit-SDK**.

### 4.5 Lever 4 — Better **evaluation + prompting/tuning** (quality engineering)
To keep improving output quality systematically:
- **Golden test set** of real target-catalog images per store/category; score try-on/fit outputs against it every model change (already the pattern in `engineering/testing.md`).
- **A/B model bake-offs** (hosted vs open) on quality × cost × latency × license — pick per result, not hype.
- **Confidence calibration**: track predicted-confidence vs actual fit-feedback; recalibrate so the confidence number is honest.
- **Fine-tune / LoRA** the generative model on your best on-model imagery once you have volume (better India-garment realism).
- **Prompt/condition engineering** for the generative try-on (seed/control conditioning for angle consistency).
- **Guardrails**: every avatar/fit output carries confidence; mock output is flagged `synthetic`; never claim a measurement.

### 4.6 If/when you add an LLM (styling assistant, outfit descriptions, chat)
Use the **latest Claude models** (e.g., Claude Opus/Sonnet 5) behind the same adapter pattern; keep provider-agnostic; cache prompts; measure tokens/cost. (See the `claude-api` reference before wiring any LLM.)

---

## 5. Data & schema (what to store)
Postgres tables (built in `backend/app/models/`): users, **consents** (versioned, DPDP), body_profiles + avatar_versions (sensitive, encrypted, deletable), products (normalized cache), outfits/outfit_items, tryon_jobs/renders/fit_reports, carts/cart_items, **fit_feedback** (the moat). Raw photos deleted after avatar generation by default.

---

## 6. Architecture (one picture)
```
Web (React) / Mobile (Flutter)
        │  HTTPS/JSON
   API Gateway / FastAPI (modular monolith)
   ├─ auth ├─ users/consent ├─ catalog ├─ outfits ├─ cart/handoff ├─ jobs
        │                                   │
   Store Adapters (capability-honest)   Job Queue (Celery/Redis)
   ├─ Amazon PA-API ├─ Affiliate feeds        │
   └─ Partner API (future, cart-sync)     AI Workers (GPU)
                                          ├─ Body/Avatar ├─ Try-On
                                          ├─ Fit engine  ├─ Outfit engine
   Postgres(+pgvector) · Redis · Cloudflare R2 · Sentry/OTel
```

---

## 7. Build order (to go from "live web app" → "full product")
1. **Host the backend** (Render/Railway/Fly) + Postgres + Redis + R2. `TO BUILD` (needs your account auth).
2. **Wire the web app to the API** (replace localStorage logic with real auth + persistence).
3. **Amazon PA-API adapter** + one affiliate feed (real catalog).
4. **Real body model**: bake-off SMPL(-X) build vs an avatar SDK (buy) → pick. `UNVERIFIED` until benchmarked.
5. **Real try-on**: hosted generative API → benchmark on real images → self-host at volume.
6. **Alembic migrations**, rate-limiting/observability middleware, security gate.
7. **Flutter mobile app** (needs Flutter SDK).
8. Start the **fit-feedback flywheel** in production → per-brand calibration → **B2B Fit-SDK**.

---

## 8. Cost & scaling (keep unit economics positive)
- Per active user/mo (`ASSUMPTION`): revenue ≈ affiliate ₹108 + Pro-blended ₹10 ; hosted AI cost ≈ ~$1.6.
- **The one metric that matters:** affiliate+Pro revenue/user **>** inference cost/user.
- Levers: **render caching** by (avatar, item-set) hash, free-tier caps, fewer angles on free, downscale previews, **self-host at ~10k–100k active users**, spot GPUs for batch, R2 zero-egress. (Full model: `business/cost-model.md`.)

---

## 9. Compliance (non-negotiable, India-first)
DPDP Act (Rules 2025; penalties to ₹250 cr; enforcement → May 2027) + GDPR-ready. Treat body data as **biometric-tier**: granular verifiable consent, delete-photo-after-generation, encryption, deletion rights, **no store passwords**, DPAs for any hosted AI touching images. This is a **market-entry moat**, not overhead. (`compliance/privacy.md`, `compliance/security.md`.)

---

## 10. Honest constraints (say these out loud)
- **Cart-sync isn't officially possible** → affiliate/deep-link now, partner-gated later. Never demo it as real.
- **We don't beat Google Doppl on raw pixels** → we win on **fit intelligence + outfit + cross-store + India depth + the fit-data flywheel**.
- **1 photo ≠ perfect 3D body** → confidence-scored estimate, laddered accuracy.
- The **live web app is a self-contained front end** today; wiring it to the hosted backend is step #1 above.

---

## 11. How to run everything (commands)
```bash
# Web app (live site source)
cd interactive-demo && npm install && npm run dev        # http://localhost:5173
npm run build                                            # static build → dist/ (auto-deploys on git push to main)

# Backend (FastAPI) — Windows venv shown
cd interactive-demo/backend
python -m venv .venv && ./.venv/Scripts/pip install -r requirements-dev.txt
./.venv/Scripts/uvicorn app.main:app --reload            # http://127.0.0.1:8000/docs
./.venv/Scripts/python -m pytest -q                      # 21 tests
```

**Live web app:** https://jeet9909.github.io/fitcartai/ · **Repo:** github.com/jeet9909/fitcartai

---

## 12. One-line strategy
> *Anyone can render a shirt on a photo; only FitCart knows — from a compounding, India-first fit dataset no one else has — whether it will fit **you**, across every store you shop, and can sell that knowledge back to the brands. Climb the four AI ladders (models · inputs · data-flywheel · evaluation) and the output gets better and better on its own.*
