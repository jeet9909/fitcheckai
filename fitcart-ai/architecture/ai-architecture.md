# AI Architecture

> Modular, adapter-driven, mockable. Every AI capability is an **interface** with hosted / self-hosted / mock implementations, so the product runs end-to-end even before production models are wired — **without faking results** (mocks are clearly labelled synthetic).

## 1. AI pipeline (end-to-end)
```mermaid
flowchart TD
    IMG[User Photo(s)] --> VAL[Capture Validation\n(person/pose/light/distance/crop)]
    VAL -->|pass| PARSE[Human Parsing + Segmentation]
    VAL -->|fail| RETAKE[Retake guidance]
    PARSE --> POSE[Pose Estimation]
    POSE --> BODY[3D Body Estimation → SMPL(-X) params]
    BODY --> AVATAR[Avatar Asset + skin tone + posture\n+ CONFIDENCE score]

    subgraph PerItem[Per selected garment]
      PROD[Product Images] --> GSEG[Garment Segmentation/Extraction]
    end

    AVATAR --> VTO[Virtual Try-On\n(2D/2.5D generative → multi-angle set)]
    GSEG --> VTO
    VTO --> SR[Texture / Super-Resolution (optional)]
    VTO --> RENDERS[(Multi-angle Render Set)]

    AVATAR --> FIT[Fit Engine\n(body vs size-chart/metadata)]
    GSEG --> FIT
    FIT --> FITREP[Fit Report + confidence]

    ITEMS[Outfit items + metadata] --> STYLE[Outfit Intelligence\n(color/occasion/body-shape/style/trend)]
    STYLE --> OUTSCORE[Outfit Score]
```

## 2. Service interfaces
| Service | Input (schema) | Output (schema) | MVP impl |
|---|---|---|---|
| `CaptureValidationService` | image | {ok, issues[], guidance} | self-host (lightweight) |
| `HumanParsingService` | image | {masks, parts} | self-host (SAM/Sapiens-class) |
| `PoseService` | image | {keypoints2d/3d} | self-host (MediaPipe/ViTPose) |
| `BodyModelService` | image(s)+height | {smpl_params, measurements, confidence} | self-host (HMR-class) **or** vendor SDK |
| `GarmentSegService` | product image | {garment_mask, type} | self-host |
| `TryOnService` | avatar_render + garment | {render_set[], angles} | **hosted API (MVP)** |
| `TextureService` | render crop | {enhanced} | self-host (Real-ESRGAN-class) |
| `FitService` | measurements + size-chart + metadata | {region_fits, score, confidence, recs} | **our code** |
| `OutfitService` | items + user profile | {color, occasion, bodyshape, style, trend, composite} | **our code** |

## 3. Adapter pattern (every service)
```mermaid
flowchart LR
    ORCH[AI Orchestrator] --> IFACE{{Service Interface}}
    IFACE --> HOSTED[HostedAdapter\n(fal/Replicate/Google-class)]
    IFACE --> SELF[SelfHostedAdapter\n(GPU worker)]
    IFACE --> MOCK[MockAdapter\n(labelled synthetic)]
```
Selection via config per environment: **dev=mock**, **staging=hosted**, **prod=hosted→self-host as volume grows**.

## 4. Orchestrator responsibilities
- Sequence the pipeline; parallelize independent steps (garment seg per item ∥ body model).
- Enforce timeouts, retries, fallbacks (hosted→self-host).
- **Idempotency/caching:** identical (avatar, item-set) → reuse render set. Major cost lever.
- Emit **cost + latency metrics** per stage.
- Attach **confidence** to every user-facing estimate.

## 5. Model selection posture (from `research/technology-research.md`)
| Capability | MVP choice | License gate |
|---|---|---|
| Body/avatar | SMPL(-X) fit *(commercial license budgeted)* OR avatar SDK | ⚠️ SMPL commercial license |
| Try-on | Hosted generative API (bake-off: fal/Replicate/open self-host) | check weight+base license |
| Parsing/pose/seg | Permissive open (Apache/MIT), self-host | prefer non-AGPL |
| Fit/outfit | Our own code (IP/moat) | n/a |

**Every model passes a license-review gate before integration.** (See `DECISION_LOG.md`.)

## 6. Honesty guardrails (product-critical)
- Avatar & fit outputs **always** carry a confidence score; never "guaranteed measurement."
- 360° = a generated **multi-angle set** at MVP, not free-camera 3D. UI says so.
- Texture mode = image zoom + SR, **not** true material capture.
- Mock outputs in non-prod are **visually watermarked "synthetic"** so no one mistakes them for real results.

## 7. Cost & performance controls
- Cache/reuse renders; batch inference; cap free-tier renders; downscale for previews; self-host high-volume models; spot/preemptible GPUs for batch. Detail in `business/cost-model.md`.

## 8. Data & training
- **No training on user photos without separate opt-in consent** (`compliance/privacy.md`).
- Fit-feedback data (post-purchase "fit was accurate") is the **moat dataset** — collected with consent, powering the fit engine over time.
