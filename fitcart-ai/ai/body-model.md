# AI Deep-Dive: Body Model & Avatar

## 1. The honest premise
A single phone photo **cannot** yield a metrically perfect 3D body. We build a **believable, animatable, confidence-scored parametric avatar** and improve it with more inputs over versions. We never present estimates as guaranteed measurements.

## 2. Representation choice: SMPL / SMPL-X
- **SMPL(-X):** a parametric human body model — a low-dimensional shape (β) + pose (θ) space producing a full mesh. Industry standard, animatable, lightweight to store (just parameters).
- **Why:** compatible with pose/shape regressors, riggable for multi-angle rendering, well-supported tooling.
- **⚠️ Licensing:** SMPL/SMPL-X commercial use **requires a paid license** (Max Planck / Meshcapade). **Budget it or choose a commercial avatar SDK.** This is the #1 hidden cost trap — flagged in `research/technology-research.md` and `DECISION_LOG.md`.

## 3. Pipeline (image → avatar)
```mermaid
flowchart TD
    P[Photo(s) + height (+weight)] --> V[Validation gate]
    V --> SEG[Human parsing/segmentation]
    SEG --> POSE[2D/3D pose]
    POSE --> REG[Image→SMPL regressor (HMR/CLIFF-class)]
    REG --> OPT[Optimization refine (fit silhouette + height scale)]
    OPT --> SHAPE[Shape β + pose θ]
    SHAPE --> SKIN[Skin-tone sampling (on-device pref.)]
    SHAPE --> POST[Posture capture]
    SKIN --> AV[Avatar asset]
    POST --> AV
    AV --> CONF[Confidence score]
```

## 4. Capture validation (quality gate — protects downstream quality)
Checks with actionable feedback + retake:
| Check | Pass criteria |
|---|---|
| Person present | single full body detected |
| Full-body visible | head→feet in frame |
| Pose | roughly A/T-pose, facing camera |
| Distance/crop | body fills frame, not cut off |
| Lighting | not too dark/blown-out |
| Background | not fully occluding; contrast OK |
| Blur | sharpness threshold |

## 5. Accuracy ladder
| Version | Inputs | Method | Fit accuracy (target) |
|---|---|---|---|
| **MVP** | 1 front photo + height (+weight) | Single-view SMPL fit + height scaling | Silhouette-believable; measurements ±5–10% `UNVERIFIED` |
| **V2** | + side + back | Multi-view refinement | ±3–6% |
| **V3** | multi-photo / short video | Dense reconstruction / textured avatar / splat | Near-production; still an estimate |

**Height is the anchor** for metric scaling from a single view — always requested; weight optional to refine shape.

## 6. Skin tone & posture (inclusion + realism)
- Skin tone sampled respectfully (prefer **on-device** to avoid sending extra sensitive data), mapped to avatar material.
- Posture captured so the avatar resembles the user's stance.
- **Inclusion mandate:** full body-size range; no idealization/slimming; plus-size fidelity is a first-class requirement (see `docs/user-personas.md`). V2/V3: seated posture + prosthesis-aware options.

## 7. Buy-vs-build decision (open, resolve Week 1)
| Option | Pros | Cons |
|---|---|---|
| **Build on SMPL(-X)** | Full control, standard, IP | License cost, ML effort, tuning |
| **Buy avatar SDK** (Meshcapade/in3D-class) | Fast, managed, licensed | Vendor cost/lock-in, less control |

**Recommendation:** run a **1-week bake-off** on real target photos; if build-quality lags or licensing drags, **buy for MVP** and revisit self-host later. Logged in `DECISION_LOG.md`.

## 8. Interface (mockable)
```
BodyModelService.generate(images[], height_cm, weight_kg?) ->
  { smpl_params, measurements{shoulder,chest,waist,hip,inseam,...},
    skin_tone, posture, confidence, warnings[] }
```
Dev uses `MockAdapter` returning a **labelled synthetic** avatar so the whole app runs before the real model is wired.

## 9. Privacy notes
Photos are sensitive (`compliance/privacy.md`): encrypted, deleted after avatar generation by default, never used for training without separate opt-in. Avatar stored as parameters (smaller, less raw-identifiable) where possible.
