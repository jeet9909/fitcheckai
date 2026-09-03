# Decision Log

Every major product/technical decision: what, alternatives, why, trade-offs, migration path. Uncertainty is stated, not hidden. Status: 🟢 decided · 🟡 provisional (validate) · 🔵 open.

---

### D-001 — Product is photo→avatar, NOT live AR 🟢
- **Decision:** Core = uploaded photos → personalized 3D avatar → try-on. No live-camera AR.
- **Alternatives:** real-time AR (Snap-style).
- **Why:** matches the brief; AR is a different, harder, less-differentiated modality; avatar enables fit intelligence.
- **Trade-off:** less "instant" than AR; needs upload flow.
- **Migration:** AR could be a later capture option; architecture doesn't preclude it.

### D-002 — MVP 360° = multi-angle render set, NOT real-time 3D 🟢
- **Alternatives:** true real-time 3D cloth sim at MVP.
- **Why:** stores don't provide 3D garment assets; 2D generative is the only viable input path; honest + buildable.
- **Trade-off:** not free-camera; fixed angles.
- **Migration:** `OutfitViewer` interface swaps to `Realtime3DViewer` in V3.

### D-003 — Cart-sync is partnership-gated, NOT an MVP feature 🟢
- **Alternatives:** browser automation / credential capture.
- **Why:** no official cart API exists; automation breaches ToS + creates security/DPDP liability (`compliance/platform-integration-risks.md`).
- **Trade-off:** MVP can't literally sync carts; uses deep-link handoff.
- **Migration:** `PartnerAdapter` (OAuth + cart-write) drops in when a deal is signed — zero UI rewrite.

### D-004 — Mobile: Flutter 🟢
- **Alternatives:** React Native, native.
- **Why:** single codebase, superior custom-UI/animation for viewer, strong mid-range Android perf (India), brief preference.
- **Trade-off:** smaller talent pool than JS.
- **Migration:** RN fallback if hiring dictates (would be a rewrite — low likelihood).

### D-005 — Backend: Python + FastAPI, modular monolith 🟢
- **Alternatives:** Go, Node; microservices from day one.
- **Why:** one language with AI stack; async; velocity; microservices are premature for a small team.
- **Trade-off:** Python raw throughput < Go for some paths.
- **Migration:** extract AI workers (already separate) + a Go edge service for high-QPS handoff if profiling demands.

### D-006 — Database: PostgreSQL (+pgvector) 🟢
- **Alternatives:** MongoDB.
- **Why:** relational integrity (consent/fit/orders) + JSONB flexibility + pgvector for recs; one store to run.
- **Migration:** dedicated vector DB/search engine only if scale demands.

### D-007 — Object storage: Cloudflare R2 🟢
- **Alternatives:** AWS S3.
- **Why:** **zero egress** on an image/render-heavy product; S3-compatible (portable).
- **Trade-off:** newer ecosystem than S3.
- **Migration:** S3-compatible API keeps us portable.

### D-008 — AI: hosted inference first, self-host at volume 🟡
- **Alternatives:** self-host from day one.
- **Why:** no GPU ops early; pay-per-use; faster.
- **Trade-off:** higher per-inference cost; vendor dependency.
- **Migration:** adapter interface → switch high-volume models to self-host at ~10k–100k active users (`business/cost-model.md`). **Validate crossover.**

### D-009 — Body model: SMPL(-X) build vs avatar SDK buy 🟡
- **Why open:** SMPL commercial use requires a **paid license**; a bake-off decides build-quality vs buy-speed.
- **Trade-off:** build = control + IP but license cost + ML effort; buy = speed but vendor cost/lock-in.
- **Action:** Week-1 bake-off on real photos → decide. Logged as provisional.

### D-010 — Try-on model: bake-off (hosted vs open) 🟡
- **Why open:** quality on **real India-catalog images** unknown until benchmarked (Week 4–6).
- **Criteria:** quality × cost × latency × license.
- **Action:** benchmark then decide; start hosted.

### D-011 — Monetization: affiliate-led freemium 🟢
- **Alternatives:** paid try-on, ads-first.
- **Why:** day-one revenue without killing the funnel; Pro + B2B layer later.
- **Migration:** push Pro/B2B if affiliate rates compress.

### D-012 — No third-party shopping passwords stored (MVP) 🟢
- **Why:** ToS + DPDP + security red-line.
- **Trade-off:** limits integration depth.
- **Migration:** official OAuth (encrypted, scoped tokens) with partners only.

### D-013 — Privacy: treat body data as biometric-tier 🟢
- **Why:** conservative under DPDP ambiguity; builds trust; avoids regulatory risk.
- **Trade-off:** stricter engineering (encryption, deletion, consent granularity).
- **Migration:** none — this is a floor, not a ceiling.

### D-014 — Confidence scores are mandatory on every estimate 🟢
- **Why:** honesty = retention; over-claiming loses users after one bad prediction.
- **Trade-off:** less "magical" marketing.
- **Migration:** none.

### D-015 — Queue: Redis + Celery/RQ → RabbitMQ/Kafka later 🟢
- **Why:** simplest sufficient for MVP; don't over-build.
- **Migration:** RabbitMQ when fan-out grows; Kafka if event volume warrants.

### D-016 — Orchestration: managed containers/serverless → k8s at scale 🟢
- **Why:** low ops for a small team; k8s premature.
- **Migration:** k8s when self-hosting GPU fleets.

### D-017 — Phase-2 backend runs on SQLite + in-process jobs in dev 🟢
- **Decision:** Dev/test run on SQLite (aiosqlite) + an in-process asyncio job runner, behind the same interfaces that target Postgres + Celery/Redis in prod (selected by `FITCART_DATABASE_URL` / `FITCART_JOB_BACKEND`).
- **Why:** the build machine has no Docker; this keeps the backend fully runnable + testable now without provisioning infra, while the production drivers slot in via config.
- **Trade-off:** SQLite ≠ Postgres in edge cases (types, concurrency); covered by using portable SQLAlchemy + string-UUID PKs + JSON columns.
- **Migration:** prod image installs asyncpg/redis/celery; Alembic replaces `create_all`.

### D-018 — Fit & Outfit engines are our own code, built in Phase 2 🟢
- **Decision:** Implement Fit and Outfit intelligence as deterministic Python engines now (not mocked), while Body/Try-On stay behind mock adapters until hosted/self-host models are wired.
- **Why:** these are the IP/moat and are fully buildable + testable today; try-on/body need real models (benchmark first, D-009/D-010).

### D-019 — search-products: local-cache-first, threshold = 5 🟢
- **Decision:** Before calling a real affiliate API or attempting a live scrape for a requested store, `search-products` first checks the `products` table itself (`localCatalog.ts`) for real (non-mock) rows matching the query. `MIN_CACHE_RESULTS = 5` is the bar for treating the cache alone as sufficient and skipping the live/scrape attempt entirely for that store; below it, cache hits are kept and merged (deduped by `productUrl`) with a fresh attempt rather than discarded.
- **Why:** the scraping fallback's own live-tested findings (see `supabase/README.md`) show real-time scraping is blocked more often than not — serving from a previously-fetched, already-allowlist-checked row is both faster and more reliable than re-attempting a live fetch on every identical search. 5 is a judgment call (high enough to mean "a real, useful result set exists," low enough that a store with a handful of prior fetches isn't stuck permanently bypassing fresh data) — not derived from measurement, and reasonable to tune once real usage data exists.
- **Trade-off:** a cache hit can go stale (price changes, delisted items) between the original fetch and being served again — no TTL/expiry is implemented yet. Mitigated by `populate-catalog` and normal search traffic continuously refreshing rows via `.upsert()`'s `onConflict: 'product_url'`.
- **Migration:** add a `scraped_at`-based staleness cutoff to `findCachedListings` if stale cached prices become a real problem (the column already exists).

### D-020 — Meesho/Myntra/AJIO/Nykaa Fashion: `configured()` permanently `false`, live scrape is their only search path 🟢
- **Decision:** Unlike Amazon/Flipkart (real affiliate APIs, `configured()` reflects whether credentials are set), the four other target stores have `configured: () => false` hardcoded in `orchestrator.ts`'s `PROVIDERS` table — there is no real public catalog/search API for any of them, so this is a permanent fact, not a "not yet set up" state. `runProvider`'s existing not-configured branch (best-effort live scrape, honest `scrape_blocked`/`scrape_failed` on failure) is the *entire* search path for these four, not a fallback for an edge case.
- **Why:** reuses the exact isolation/honesty machinery already built for Amazon/Flipkart's scraping fallback instead of a parallel code path, and keeps the "never fabricate data" rule (D-014) uniform across all 6 stores.
- **Trade-off:** live-tested 2026-09-02/03, all four currently resolve to `scrape_blocked` in production (403s, a 502, or a real page with no price in its JSON-LD) — see `supabase/README.md`'s dated findings. This is stated plainly rather than presented as "supported."
- **Migration:** if any of these four ever launches a real affiliate/catalog API, add real `isXConfigured`/`searchX` functions and flip `configured()` to check for real credentials, exactly mirroring `amazonPaapi.ts`/`flipkartAffiliate.ts` — the scrape fallback stays as-is as the no-credentials path.

### D-021 — `populate-catalog`: a manually-invoked Edge Function, no cron 🟢
- **Decision:** Catalog pre-population (`supabase/functions/populate-catalog/`) is a plain secret-gated HTTP endpoint the operator calls by hand (or from their own external scheduler) with a `terms`/`stores` subset — not a Supabase Cron job wired up automatically, and each invocation is hard-capped at 24 `(term, store)` pairs.
- **Why:** (1) the scraping fallback's own live-tested findings show repeated/automated-looking traffic gets blocked fastest — an unattended recurring cron would make that materially worse with no one noticing; (2) Amazon/Flipkart's real affiliate APIs have their own rate limits this shouldn't blindly hammer on a fixed schedule; (3) an Edge Function has a wall-clock limit, so bounding pairs per call and requiring multiple deliberate invocations for full coverage is safer than one long-running job silently timing out partway through.
- **Trade-off:** full coverage of `searchTerms.ts` across all 6 stores requires several manual/scripted invocations rather than "set it and forget it."
- **Migration:** if this needs to run unattended later, wire an external scheduler (GitHub Actions cron, etc.) to call it with rotating `terms` slices — still respecting the same per-invocation pair cap and secret — rather than adding an in-Supabase cron that could race against real user traffic without anyone watching.

---
**Open decisions to close:** D-008 crossover point · D-009 build/buy avatar · D-010 try-on model · affiliate network selection.

## Phase 2 progress
- ✅ **Backend foundation** (`backend/`): FastAPI modular monolith — auth (OTP→JWT), users/consent (DPDP gate), catalog + capability-honest store adapters, outfits, async avatar+try-on jobs, real fit & outfit engines, cart + compliant checkout handoff, fit-feedback. **15 tests pass; server boots with 23 routes.** Runs on SQLite/in-process (no Docker needed).
- ⏭️ **Next:** persist normalized catalog + Amazon PA-API adapter · Alembic migrations · rate-limiting/observability middleware · then the **Flutter mobile app** (needs Flutter SDK) or a thin web client against this API.
