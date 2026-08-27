# AI Deep-Dive: Virtual Try-On

## 1. Two families (recap from tech research)
| Family | Description | FitCart use |
|---|---|---|
| **2D/2.5D generative** | Warp/generate garment onto a person/avatar render (diffusion-based) | **MVP + V2** |
| **3D cloth simulation** | Physical garment mesh draped on 3D body | **V3 / partner assets only** |

**Why 2D first:** stores give us *product photos*, not 3D garment assets. 2D generative try-on works from images — the only inputs we actually have at MVP.

## 2. MVP try-on pipeline
```mermaid
flowchart TD
    AV[Avatar render (base pose, N yaw angles)] --> COND[Condition images]
    PIMG[Product image(s)] --> GS[Garment segmentation/extraction]
    GS --> COND
    COND --> GEN[Generative try-on model\n(hosted API; open self-host later)]
    GEN --> MA[Per-angle outputs]
    MA --> SR[Optional super-resolution]
    SR --> RS[(Render Set: 8–16 angles + zoom crops)]
```

## 3. The 360° reality (no faking)
- A 2D method doesn't give free-camera 3D. We generate a **fixed set of yaw angles** (e.g., 0/45/90/.../315°) plus high-res crops, and the viewer swaps between them → *feels* like rotation.
- UI copy is explicit ("multi-angle preview"), and the viewer interface (`OutfitViewer`) is ready to swap to true 3D in V3. See `architecture/mobile-architecture.md`.

## 4. Layering (multiple garments)
- Compose items in **draw order** (base → mid → outer → accessories), running try-on per layer or as a composed prompt.
- Layering compatibility is scored by the fit engine (V2). Complex layering is a known hard problem — MVP handles common cases (top+bottom+shoes+one accessory) and degrades gracefully.

## 5. Model selection (bake-off required, Week 4–6)
| Candidate class | Type | Notes |
|---|---|---|
| Hosted try-on APIs (fal/Replicate/Google-class) | hosted | Fastest to "wow"; per-call cost; check terms |
| Open models (IDM-VTON/OOTDiffusion/CatVTON-class) | self-host | GPU cost; license check (weights + base) |

**Decision rule:** pick by **quality on real India-catalog images** × cost × latency × license. Start hosted; self-host when volume makes GPU cheaper. Logged in `DECISION_LOG.md`. All `UNVERIFIED` until benchmarked.

## 6. Quality controls
- Reject/flag low-quality product images before try-on.
- Consistency across angles (same garment identity) — a known challenge; mitigate with seed/control conditioning; if inconsistent, reduce angle count rather than ship artifacts.
- **Watermark synthetic outputs** in non-prod; consider provenance signaling in prod.

## 7. Cost model (per try-on)
Dominant cost = generative inference × number of angles. Levers:
- **Cache/reuse** identical (avatar, item-set) renders (`item_set_hash`).
- **Fewer angles** on free tier; full set on Pro.
- **Downscale** previews; SR only on zoom.
- **Batch** + **self-host** at volume; spot GPUs for non-interactive.
See `business/cost-model.md`.

## 8. Interface (mockable)
```
TryOnService.render(avatar_id, items[], angles[], quality) ->
  { render_set: [{angle, url, res}], warnings[], cost, latency_ms }
```
`MockAdapter` returns labelled-synthetic renders so the flow runs pre-integration.

## 9. What we will NOT claim
- Not real fabric physics (that's 3D sim, V3).
- Not perfect drape/fit realism — it's a **generative approximation**, paired with the fit engine's honest scoring.
- Not free-camera 3D at MVP.
