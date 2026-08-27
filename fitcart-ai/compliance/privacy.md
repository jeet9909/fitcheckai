# Compliance — Privacy Architecture

> Body photographs are the most sensitive data this product touches. Under India's **DPDP Act, 2023** (Rules notified **14 Nov 2025**, penalties up to **₹250 crore**, full enforcement ramping toward **13 May 2027**) and **GDPR**, careless handling is existential. Privacy-by-design is a **launch requirement**, not a later polish.

## 1. Regulatory landscape
| Regime | Applies when | Key duties for us |
|---|---|---|
| **India DPDP Act + Rules 2025** | Indian users' personal data | Verifiable consent, purpose limitation, data minimization, deletion after purpose, security safeguards, breach notification, grievance officer, rights (access/correction/erasure) |
| **GDPR** | EU users (future) | Lawful basis, explicit consent for special-category-like data, DPIA, DSRs, cross-border safeguards |

**Important DPDP nuance (from research):** the DPDP Act does **not** create a separate "sensitive data" tier the way GDPR does — but **biometric/body data processing carries the highest practical compliance obligations**: legitimate purpose, **verifiable consent**, and **deletion once purpose is fulfilled**. We treat body data as maximally sensitive regardless.

## 2. Is our data "biometric"? (risk assessment)
- Full-body photos + derived measurements are **biometric-like / body data** — even if not fingerprint/iris "biometric" in the narrowest legal sense, they are identity-linked and physically descriptive.
- **Conservative stance:** treat as biometric-tier. This avoids regulatory ambiguity and builds trust. See `compliance/platform-integration-risks.md` for the credential red-line.

## 3. Consent architecture (granular, verifiable, versioned)
Separate, un-bundled, opt-in toggles — **no pre-ticked boxes, no dark patterns**:
1. **Processing** — analyze my photo to build an avatar.
2. **Storage** — keep my avatar/photos (with retention choice).
3. **Model improvement** — use my (anonymized) data to improve models. **Off by default.**
4. **Cross-border transfer** — if a hosted AI vendor processes abroad.
Each consent is **versioned + timestamped + auditable**; revocable anytime.

## 4. Data minimization & flow
```mermaid
flowchart LR
    UP[Photo upload] --> PROC[Avatar generation]
    PROC --> AV[Avatar params stored (encrypted)]
    UP -.->|deleted after generation by default| X[(Purged)]
    AV --> USE[Try-on/fit]
```
- Prefer **on-device** steps where feasible (e.g., skin-tone sampling, capture validation) to avoid sending extra data.
- Store **avatar parameters** rather than raw photos where possible (smaller, less directly identifiable).
- Delete raw photos after avatar generation **by default** (user may opt to keep).

## 5. Retention policy
| Data | Retention |
|---|---|
| Raw photos | Deleted post-generation OR user-chosen short window |
| Avatars | While account active; deletable |
| Renders | Cache TTL; regenerable |
| Fit feedback | Retained (consented), anonymizable |
| Audit/consent logs | As legally required |

## 6. Security controls (see `compliance/security.md`)
Encryption in transit (TLS) + at rest (KMS-managed keys); access control + audit logging on all body-data access; isolated storage; least privilege; breach detection + notification workflow.

## 7. User rights (DPDP/GDPR)
- **Access & export** (`/users/me/export`).
- **Correction** (regenerate avatar).
- **Erasure** — `DELETE /users/me` triggers a hard-delete worker purging DB rows + R2 objects within a defined SLA; verifiable.
- **Withdraw consent** — stops corresponding processing.
- **Grievance officer** contact published.

## 8. Third-party AI processing
- Any hosted inference vendor touching images requires a **DPA**, purpose limitation, no-training-on-our-data clause, and region/transfer disclosure.
- Adapter design lets us **switch to self-hosted** to eliminate third-party image processing if required by policy or a large client.

## 9. Model-training governance
- **No training on user photos without explicit, separate opt-in.**
- Fit-feedback data used for improvement is **anonymized/aggregated**.
- Provenance/watermarking on synthetic outputs.

## 10. Privacy engineering checklist (launch gate)
- [ ] Granular consent implemented, versioned, revocable
- [ ] Raw-photo deletion-after-generation default
- [ ] Encryption at rest + in transit; KMS keys
- [ ] Delete-account purges body data + objects (tested)
- [ ] DPA + region disclosure for hosted AI
- [ ] Grievance officer + privacy policy published
- [ ] DPIA (GDPR) / risk assessment documented
- [ ] No credential storage for stores (see integration risks)

**Bottom line:** the privacy posture is not overhead — it is a **market-entry moat** in a newly-regulated India, and the reason users will trust FitCart with their body over a careless competitor.
