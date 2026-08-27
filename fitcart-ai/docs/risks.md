# Risk Register

Severity × Likelihood → Priority. Labels: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low. Visual heatmap in `diagrams/risk-matrix.md`.

## 1. Platform / integration risks
| ID | Risk | Sev | Like | Pri | Mitigation |
|---|---|---|---|---|---|
| P1 | **No official cart/catalog API** on target platforms | High | Certain | 🔴 | Reframe MVP to affiliate+deep-link; cart-sync = partnership V3. Never promise cart-sync at MVP |
| P2 | Browser automation for cart = ToS breach + fragility | High | High if attempted | 🔴 | **Do not build server-side automation.** Documented as HIGH RISK |
| P3 | Affiliate feed coverage/quality insufficient | High | Med | 🟠 | Pilot Admitad+Cuelinks+PA-API; normalize; fill gaps; set expectations |
| P4 | Affiliate program access revoked / rates cut | Med | Med | 🟠 | Diversify networks + Pro + B2B revenue |
| P5 | Platform blocks/deprioritizes us | Med | Med | 🟡 | Stay compliant; be a traffic *source* they value |

## 2. Legal / compliance risks
| ID | Risk | Sev | Like | Pri | Mitigation |
|---|---|---|---|---|---|
| L1 | **Body-photo = sensitive personal data (DPDP/GDPR)** mishandling | Critical | Med | 🔴 | Privacy-by-design, verifiable consent, deletion-after-purpose, encryption (see `compliance/privacy.md`) |
| L2 | Storing third-party shopping credentials | Critical | Low (if we refuse) | 🔴 | **Policy: never store store passwords (MVP).** OAuth/affiliate only |
| L3 | Displaying store product data breaches feed terms | Med | Med | 🟠 | Legal review per network; respect caching/display limits |
| L4 | Cross-border AI processing of body data | High | Med | 🟠 | Region-appropriate processing; DPA with vendors; consent for transfer |
| L5 | Training models on user photos without consent | Critical | Low (if gated) | 🔴 | Separate opt-in for model improvement; never bundle into ToS |

## 3. AI / technical risks
| ID | Risk | Sev | Like | Pri | Mitigation |
|---|---|---|---|---|---|
| T1 | Try-on quality below "wow" on India catalog | High | Med | 🟠 | Benchmark early (Wk4–6); hosted+open bake-off; set honest expectations |
| T2 | Avatar accuracy over-claimed → trust loss | High | Med | 🟠 | Always show confidence; never claim measured sizing |
| T3 | SMPL/model licensing overlooked → legal/cost | High | Med | 🟠 | License review gate; budget; or buy avatar SDK |
| T4 | GPU inference cost > revenue | High | Med | 🟠 | Caching, batching, free caps, self-host at volume |
| T5 | Multi-angle 360° mistaken as "fake 3D" | Med | Low | 🟡 | Honest UI copy; architecture upgrade path documented |
| T6 | Bad input photos → poor results at scale | Med | High | 🟠 | Strong capture validation + retake guidance |

## 4. Business / market risks
| ID | Risk | Sev | Like | Pri | Mitigation |
|---|---|---|---|---|---|
| B1 | Google/Amazon bundle cross-store try-on | Critical | Med | 🔴 | Own fit+outfit depth + India + partnerships + B2B pivot option |
| B2 | Low willingness to upload body photos | High | Med | 🟠 | Privacy-first design; on-device where possible; validate in survey |
| B3 | Weak retention after novelty | High | Med | 🟠 | Fit accuracy + saved outfits + recommendations drive habit |
| B4 | Unit economics don't close | Critical | Med | 🔴 | Validate affiliate-per-user vs inference-cost early; cost controls |
| B5 | CAC too high | Med | Med | 🟡 | Organic/affiliate-led growth; niche communities (plus-size, fashion) |

## 5. Operational risks
| ID | Risk | Sev | Like | Pri | Mitigation |
|---|---|---|---|---|---|
| O1 | Small team can't cover mobile+backend+AI+ML+compliance | High | High | 🟠 | Buy (hosted AI, avatar SDK) over build; focus scope; senior hires |
| O2 | Vendor lock-in (hosted AI) | Med | Med | 🟡 | Adapter interfaces; portable to self-host |
| O3 | Security breach of body-image store | Critical | Low | 🔴 | Encryption, access control, audit logs, minimal retention |

## 6. Top 5 risks to watch (board-level)
1. 🔴 **P1/P2 — cart-sync is not officially possible** (reframe MVP; don't promise it).
2. 🔴 **L1/L2 — body-data + credential handling under DPDP** (privacy-by-design or existential).
3. 🔴 **B4/T4 — unit economics** (inference cost vs affiliate revenue).
4. 🔴 **B1 — big-tech bundling** (defend with fit-data moat + partnerships).
5. 🟠 **T1/T2 — AI quality & honesty** (benchmark early; never over-claim).

**Risk philosophy:** we win by being the team that was *honest about #1–#5 from day one* and engineered around them, rather than the team that discovered them after raising on a fantasy cart-sync demo.
