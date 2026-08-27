# Technology Research — 3D Body, Try-On, and Rendering

> Goal: choose **buildable, commercially-licensable, cost-aware** technology for a resource-constrained startup — not the most impressive research paper. Every choice is scored on Accuracy · Cost · GPU · Licensing · Speed · Mobile-fit · Scalability · Complexity.

**Research date:** August 2026. Model capabilities move fast; treat specific model names as *representative of a class*, and re-validate at build time. Items not confirmed are `UNVERIFIED`.

---

## 1. The core architectural truth

You **cannot** reconstruct a perfect, metrically-accurate 3D human body from one phone photo. What you *can* do, in tiers:

| Tier | Input | What's achievable | Honest accuracy |
|---|---|---|---|
| **MVP** | 1 full-body photo + user-entered height/weight | Parametric body avatar (SMPL-family) fitted to a 2D pose + a **generative 2D/2.5D try-on image** | Silhouette believable; measurements ±5–10% `UNVERIFIED`; "looks like me-ish" |
| **V2** | Front + side + back photos + height | Better shape params, multi-angle renders, improved fit estimation | Measurements ±3–6%; convincing multi-angle |
| **V3** | Multi-photo or short video (optional) | Textured 3D avatar / Gaussian-splat-style asset, true real-time 3D garment draping | Near-production 3D; still an *estimate*, never a guarantee |

**Product rule (non-negotiable):** never present an AI estimate as a guaranteed physical measurement. The UI always shows a **confidence score**.

---

## 2. Body representation — options compared

| Approach | Class / examples | License | Cost/GPU | Mobile | Verdict |
|---|---|---|---|---|---|
| **SMPL / SMPL-X** parametric body | SMPL, SMPL-X, STAR | ⚠️ **Research/eval license — commercial use needs a paid license from Max Planck / Meshcapade** | Low (params only) | Good (lightweight mesh) | **Recommended base representation** — but **budget for commercial licensing** or use a permissively-licensed alternative |
| **Regression to SMPL from image** | HMR2.0/4DHumans, PIXIE, CLIFF, PyMAF-X class | Model code often permissive; **underlying SMPL body model license still applies** | Medium GPU inference | N/A (server) | **MVP shape/pose fitting** |
| **Implicit/clothed reconstruction** | PIFuHD, ICON, ECON class | Research licenses; heavy | High GPU, slow | ❌ | V3 experiment only |
| **Gaussian splatting avatars** | 3DGS human-avatar class | Mixed | High GPU | Emerging | **V3** — great fidelity, immature tooling/licensing |
| **Commercial avatar SDK** | Meshcapade, in3D, Ready-abstracted vendors | Paid/partner | Managed | Varies | **Strongly consider buy-vs-build** for MVP to de-risk |

> **Decision (see `ai/body-model.md`):** MVP = image→SMPL(-X) parametric fit **or** a commercial avatar SDK if licensing/time favors buy. The SMPL family gives an industry-standard, animatable body; **the licensing cost is a real line item, not free.** This is a common trap — flagged loudly.

---

## 3. Supporting perception models (all `MVP FEASIBLE`, permissive-ish)

| Task | Representative model class | License note | Use |
|---|---|---|---|
| **Person detection** | YOLO-class / RT-DETR | ⚠️ some YOLO variants are AGPL/commercial — pick a permissive one (RT-DETR, YOLOX Apache) | Validate a person is in frame |
| **2D/3D pose** | MediaPipe Pose, ViTPose, MMPose | MediaPipe Apache-2.0; ViTPose Apache | Pose validation + SMPL fitting init |
| **Human parsing / segmentation** | Self-Correction Human Parsing, Sapiens-class, SAM/SAM2 | SAM Apache; Sapiens check license | Body-part & garment masks |
| **Depth (monocular)** | Depth-Anything-class | Apache/MIT variants exist | Shape cue, background separation |
| **Face/skin-tone** | On-device landmarking | Keep **on-device** for privacy | Skin-tone matching (privacy-sensitive) |

**Design them all behind AI-service interfaces** so any single model can be swapped without touching the app (see `architecture/ai-architecture.md`).

---

## 4. Virtual try-on — the two families

| Family | What it is | Pros | Cons | FitCart use |
|---|---|---|---|---|
| **A. 2D/2.5D generative try-on** (image-based diffusion) | Warp/generate the garment onto a photo/avatar render | Photoreal, fast-ish, cheapest path to "wow", strong open + hosted options | Not true geometry; layering & back-views harder; per-image GPU cost | **MVP + V2 primary** |
| **B. 3D garment simulation** (cloth physics on a mesh) | Real garment geometry draped on the 3D body | True 360°, real fit, real physics | Needs 3D garment assets (which stores don't provide), heavy GPU, slow, expensive | **V3 / partner-brand-asset only** |

**Representative 2D try-on model classes:** IDM-VTON / OOTDiffusion / CatVTON-style open models, and hosted APIs (fal.ai, Replicate, and Google's own Shopping/Doppl-style capability). `UNVERIFIED` which yields best India-garment quality — **must be benchmarked on real target-catalog images during Week 4–6.**

**Key honest constraint:** 2D generative try-on typically consumes a **product image + a person image** and outputs a **person-wearing-garment image**. Getting *consistent multi-angle* output ("rotate 360°") from a fundamentally 2D method requires either (a) generating several fixed angles, or (b) moving to 3D. **MVP 360° = a small set of pre-generated angle renders, not free-camera 3D.** This is called out in the viewer spec so we never "fake 3D."

---

## 5. The 360° viewer — realistic MVP

| Option | Reality | Verdict |
|---|---|---|
| True real-time 3D (garment physics, free camera) | Needs 3D garment assets + on-device/edge 3D renderer | **V3** |
| **Pre-generated multi-angle render set** (e.g., 8–16 fixed yaw angles + zoom into high-res crops) shown in a swipe/drag viewer | Feels like rotation; honest; cheap; buildable now | **MVP — recommended** |
| Client-side 3D of a **parametric avatar** (no cloth sim) with a *texture-projected* garment | Middle ground | **V2 experiment** |

Renderer options: **Flutter + `flutter_gl`/`filament`** or an embedded 3D engine for the avatar; for MVP, a high-quality image sequence viewer is enough.

---

## 6. Texture & detail mode — what's honest
We can let users **zoom into the highest-resolution source product imagery** and into high-res generated crops. We can enhance sharpness with a super-resolution pass (Real-ESRGAN-class). We **cannot** invent fabric physics or true micro-geometry that isn't inferable from source images. UI copy must frame this as "detail view," not "true material capture." `MVP FEASIBLE (as image zoom + SR)`.

---

## 7. Fit & outfit intelligence — mostly classical + light ML
- **Fit analysis:** derive from avatar body measurements vs garment size-chart + product metadata → rules/regression producing a Fit Score + confidence. Mostly deterministic; `MVP FEASIBLE`.
- **Outfit intelligence:** color harmony (color-theory in LAB space), occasion/formality classifiers, trend signals, body-shape rules → composite score. Start rules-based; add learned embeddings in V2. `MVP FEASIBLE`.

---

## 8. Buy-vs-build summary

| Component | MVP recommendation |
|---|---|
| Body avatar | **Build on SMPL(-X)** *(license budget)* **or buy** avatar SDK — decide in Week 1 pilot |
| Try-on image | **Buy** (hosted API) first for speed → **build/self-host** open model when volume justifies GPU |
| Perception models | **Build** (permissive open models, self-host) |
| Fit / outfit engines | **Build** (our IP + moat) |
| 3D garment sim | **Defer to V3** / partner assets |

---

## 9. Licensing landmines (READ THIS)
- **SMPL/SMPL-X:** commercial use requires a license. **Do not assume free.** `HIGH RISK if ignored`.
- **YOLO (Ultralytics):** AGPL-3.0 / paid commercial — prefer Apache alternatives.
- **Diffusion try-on weights:** check each model's weight license *and* the base model license (e.g., Stable Diffusion variants) for commercial use.
- **Training on user photos:** requires explicit, separate consent (see `compliance/privacy.md`) — never bundle into general ToS.

**Every model entering the stack must pass a license review gate before integration.**
