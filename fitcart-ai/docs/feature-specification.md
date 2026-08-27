# Feature Specification

Every feature carries: **Priority** (Must/Should/Could), **Complexity** (L/M/H/XH), **Cost** (₹ inference/infra sensitivity), **Dependency**, **Business value**, **Technical risk**, and a **feasibility label**.

Legend: MVP FEASIBLE · PARTNERSHIP REQUIRED · AUTOMATION-ONLY (HIGH RISK) · V2/V3 · UNVERIFIED

---

## A. Onboarding & Account
| Feature | Prio | Cx | Value | Risk | Label |
|---|---|---|---|---|---|
| Intro/value carousel | Must | L | Med | Low | MVP FEASIBLE |
| Email/OTP + social login | Must | L | Med | Low | MVP FEASIBLE |
| Granular body-data consent | Must | M | High (trust) | Med (legal) | MVP FEASIBLE |
| Guest browse | Should | L | Med | Low | MVP FEASIBLE |

## B. Store Connection & Discovery
| Feature | Prio | Cx | Value | Risk | Label |
|---|---|---|---|---|---|
| Connect via affiliate/deep-link | Must | M | High | Med | MVP FEASIBLE |
| Amazon PA-API catalog | Must | M | High | Med (rate limits) | MVP FEASIBLE (constrained) |
| Affiliate product feeds (Myntra/Ajio/Flipkart/Nykaa) | Must | M | High | Med (coverage) | MVP FEASIBLE / UNVERIFIED coverage |
| Store credential login | — | H | High | **Very High** | NOT FEASIBLE (MVP) / HIGH RISK |
| Normalized product model | Must | M | High | Low | MVP FEASIBLE |
| Cross-store search/filter | Must | M | High | Low | MVP FEASIBLE |

## C. Body Capture & Avatar
| Feature | Prio | Cx | Value | Risk | Label |
|---|---|---|---|---|---|
| Full-body photo upload | Must | L | High | Low | MVP FEASIBLE |
| Capture validation (pose/light/distance/visibility) | Must | M | High (quality gate) | Med | MVP FEASIBLE |
| Side/back photo (accuracy boost) | Should | M | Med | Med | MVP FEASIBLE |
| SMPL(-X) parametric avatar | Must | H | High | Med (license) | MVP FEASIBLE (license budget) |
| Skin-tone / posture matching | Must | M | High (inclusion) | Med | MVP FEASIBLE |
| Textured 3D / Gaussian-splat avatar | Could | XH | High | High | V3 |
| Seated / prosthesis-aware avatar | Could | H | High (inclusion) | High | V2/V3 |

## D. Try-On & Viewer
| Feature | Prio | Cx | Value | Risk | Label |
|---|---|---|---|---|---|
| Generative garment try-on (2D/2.5D) | Must | H | Very High | Med-High (quality/cost) | MVP FEASIBLE (hosted) |
| Multi-angle render set (≥8 yaw) | Must | M | High | Med | MVP FEASIBLE |
| 360° drag viewer + zoom | Must | M | High | Low | MVP FEASIBLE |
| Show/hide items, variant swap | Should | M | Med | Med | MVP FEASIBLE |
| Compare two outfits | Should | M | Med | Low | MVP FEASIBLE / V2 |
| True real-time 3D cloth sim | — | XH | High | High | V3 (needs 3D garment assets) |

## E. Fit Intelligence
| Feature | Prio | Cx | Value | Risk | Label |
|---|---|---|---|---|---|
| Region fit (shoulder/chest/waist/hip/sleeve/length/rise/shoe) | Must | M | Very High | Med | MVP FEASIBLE |
| Overall Fit Score + confidence | Must | M | Very High | Med | MVP FEASIBLE |
| Layering compatibility | Should | M | Med | Med | V2 |
| Post-purchase fit feedback loop | Must | M | Very High (moat) | Low | MVP FEASIBLE |

## F. Outfit Intelligence
| Feature | Prio | Cx | Value | Risk | Label |
|---|---|---|---|---|---|
| Color harmony score | Must | M | High | Low | MVP FEASIBLE |
| Occasion / formality suitability | Must | M | High | Low | MVP FEASIBLE |
| Body-shape compatibility | Must | M | High | Med | MVP FEASIBLE |
| Style compatibility (item↔item) | Must | M | High | Med | MVP FEASIBLE |
| Trend score | Should | M | Med | Med (data) | V2 |
| Learned outfit embeddings | Could | H | High | Med | V2/V3 |

## G. Texture / Detail Mode
| Feature | Prio | Cx | Value | Risk | Label |
|---|---|---|---|---|---|
| High-res image zoom | Should | L | Med | Low | MVP FEASIBLE |
| Super-resolution enhancement | Could | M | Med | Med | V2 |
| True material capture | — | XH | Med | High | NOT FEASIBLE (no source data) |

## H. Cart & Handoff
| Feature | Prio | Cx | Value | Risk | Label |
|---|---|---|---|---|---|
| FitCart internal cart | Must | L | High | Low | MVP FEASIBLE |
| Deep-link checkout handoff + affiliate | Must | M | High (revenue) | Med | MVP FEASIBLE |
| Sync to store cart | Could | H | Very High | **Very High** | PARTNERSHIP REQUIRED (V3) / AUTOMATION-ONLY HIGH RISK |
| Save outfits / basket | Must | L | Med | Low | MVP FEASIBLE |

## I. Platform, Privacy, Accessibility
| Feature | Prio | Cx | Value | Risk | Label |
|---|---|---|---|---|---|
| Delete body data / account | Must | L | High (DPDP) | Low | MVP FEASIBLE |
| Data export | Should | M | Med | Low | MVP FEASIBLE |
| WCAG 2.2 AA + textual fit narration | Must | M | High (inclusion) | Med | MVP FEASIBLE |
| Low-data / low-end mode | Should | M | High (India) | Med | MVP FEASIBLE |

---

## MVP feature cut-line (what ships first)
**In:** A (all), B (affiliate + PA-API + normalized model + search), C (upload + validation + SMPL avatar + skin/posture), D (generative try-on + multi-angle + viewer), E (region fit + score + feedback loop), F (color+occasion+body-shape+style), H (internal cart + handoff + save), I (delete + AA baseline + low-data).
**Deferred:** side/back accuracy boost (Should), variant swap (Should), compare outfits (V2), texture SR (V2), trend/learned outfit (V2), 3D/seated avatars (V3), cart-sync (V3/partnership).
