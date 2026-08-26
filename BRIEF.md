# FitCheck AI — MVP Brief (validate-first)

## Origin
Proof-of-concept already exists by hand (see `J:\Raw Input\`): a real reference photo
of a person (`IMG-20251023-WA0014.jpg`) was turned into a convincing, identity-preserving
image of that same person wearing a *different* garment (`1000230908.png`–`911.png`),
using a general-purpose AI image-editing model. No app, no backend — just proof the
core "wow" moment works.

This project is a deliberate reset ("new era") of the older `fitcart-ai` planning
effort (60+ docs at `J:\New Born Idea\Claude Set up\fitcart-ai\`, live app at
`jeet9909.github.io/fitcartai`). That effort built a full backend (auth, catalog, cart,
consent, tier access) before ever validating the AI moment with a real stranger. We are
not discarding that work — it's a valid ladder for later — but we are **not** rebuilding
it now. `fitcart-ai/MASTER_BUILD_GUIDE.md` and `DECISION_LOG.md` remain the reference
for the full-product roadmap once this bet is validated.

## The idea (full vision, for context — NOT all in scope now)
A layer between shoppers and stores that gives buyers offline-store-level confidence
before purchasing online:
1. **Free tier:** user uploads a reference photo + picks a garment/accessory; the app
   generates an image of the user wearing that exact item, so they can judge fit/look
   before buying.
2. **Paid tier (future, out of scope for this build):** a 3D model of the user built
   from multiple uploaded photos, so they can view the outfit on their own 3D body from
   any angle.

## Scope for THIS build (MVP — validate the bet, nothing else)
A single static page, no login, no database, no cart:
- Upload a reference photo of yourself.
- Upload or pick a garment image (a product photo).
- Call an AI image-editing model to composite the garment onto the person, preserving
  identity/pose/background as closely as possible (this is what the sample outputs in
  `Raw Input/` already demonstrate is achievable).
- Show the result. Let the user save/download it.
- One lightweight feedback capture: "Does this look like you? Would this change your
  decision to buy?" (yes/no/free text) — this is the actual signal we're after.

### Explicitly OUT of scope for this build
Accounts/auth, cross-store catalog, cart/checkout/affiliate handoff, Fit Score/Outfit
Score engines, 3D avatar/model generation, mobile app, Postgres/Redis/Celery, DPDP
consent flows beyond a simple "your photo is used only to generate this preview and is
not stored" notice. All of these are real, already-designed (see the old guide) — just
sequenced after this validates.

## Constraints
- **Secrets:** the AI provider API key must never reach the browser. GitHub Pages alone
  can't hide a server-side secret — use a small serverless proxy (Cloudflare Pages
  Functions is preferred: free, keeps frontend+proxy in one deploy, consistent with the
  Cloudflare R2 choice already made in the old stack decisions) that holds the key and
  forwards the image-edit request.
- **Provider:** Gemini image editing (`gemini-2.5-flash-image`, "nano-banana") —
  recommended because it's almost certainly what produced the sample outputs already.
  Key comes from the user via env var `GEMINI_API_KEY` (not yet supplied — build must
  work end-to-end with a mock/stub response until the key is provided, then swap live).
- **Deploy target:** GitHub repo `git@github.com:jeet9909/fitcheckai.git` (already
  initialized locally, remote added, nothing pushed yet).
- **Token/cost discipline:** keep this build small and shippable in one pass — this is
  intentionally a thin slice, not the platform.

## Success signal for this MVP
Real users (not the founder) upload their own photo, get a result that reads as
"plausibly them" wearing the item, and say it would affect a real buying decision.
That's the only thing this build needs to prove.
