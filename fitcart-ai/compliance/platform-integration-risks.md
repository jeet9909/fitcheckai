# Compliance — Platform Integration Risks

> Legal/ToS companion to `research/platform-api-research.md`. This is where we are **brutally honest** about what is and isn't allowed. Read alongside `docs/risks.md` (P1–P5, L1–L5).

## 1. The central finding (restated for the record)
**No target Indian fashion platform exposes an official public API for catalog read or cart write to third parties.** Therefore:
- "Sync outfit to the store's real cart" is **`NOT FEASIBLE` officially**, **`PARTNERSHIP REQUIRED`** to do properly, or **`AUTOMATION-ONLY` (HIGH RISK)** if forced.
- The MVP uses **affiliate feeds + deep-link handoff** — compliant and monetizable.

## 2. Integration approaches ranked by legal safety
| Approach | Legal safety | Verdict |
|---|---|---|
| Affiliate networks + deep links | ✅ Sanctioned (that's their purpose) | **MVP — use this** |
| Amazon PA-API (with Associates) | ✅ Sanctioned, T&C-bound | **MVP — use, respect terms** |
| Partner/OAuth private API | ✅ If contracted | **V3 — pursue deals** |
| User-consented browser extension (user's own session) | ⚠️ Likely ToS-breaching, desktop-only | Avoid; reconsider only with legal sign-off |
| Server-side browser automation w/ user creds | ❌ ToS breach + security liability | **Do NOT build** |

## 3. Terms-of-Service risk detail
- Automated access, scraping, and cart manipulation are **typically prohibited** by marketplace ToS.
- Affiliate program terms govern **how** we may display product data (caching limits, image use, price-accuracy disclaimers) — **legal review per network** before launch. `UNVERIFIED` specifics per network.
- Amazon PA-API terms restrict caching duration and display context — must comply.

## 4. Credential handling — the absolute red line
- **We will not collect or store users' store passwords (MVP).** Doing so would:
  - Breach platform ToS,
  - Create severe DPDP/security liability (L2 in risk register),
  - Be a reputational time-bomb ("app that logs into your Myntra").
- Any future credentialed access uses **official OAuth**, tokens **encrypted, scoped, revocable** — never raw passwords.

## 5. Data-display compliance
- Show product data within affiliate-feed terms; display **price-accuracy disclaimers** ("prices may vary — confirm on store").
- Respect image/trademark usage terms; attribute source store.
- Don't imply endorsement/partnership we don't have.

## 6. What we can safely promise stakeholders
| Claim | Safe to promise? |
|---|---|
| Cross-store discovery via affiliate feeds + PA-API | ✅ Yes (coverage caveats) |
| Try-on + fit + outfit intelligence | ✅ Yes (accuracy laddered) |
| Deep-link checkout handoff + affiliate revenue | ✅ Yes |
| **"Sync to the store's real cart"** | ❌ **No — partnership-gated V3 only** |
| Store account login inside our app | ❌ No (MVP) |

## 7. Partnership path (how cart-sync becomes real)
1. Ship compliant MVP; generate **qualified traffic + conversions** for stores.
2. Use that leverage to negotiate a **pilot partner integration** (likely a challenger platform first).
3. Implement `PartnerAdapter` (OAuth + cart-write) — the architecture already supports it (`architecture/integration-architecture.md`).
4. Roll out cart-sync **only** for partner-enabled stores; UI reflects capability truthfully.

## 8. Regulatory intersection
- Even with a partner, **credential/token handling** must meet DPDP/GDPR (encryption, consent, revocation).
- Cross-border data (hosted AI) needs DPAs + disclosure (`compliance/privacy.md`).

## 9. Standing instruction to the team
> If anyone proposes shipping cart-sync via automation or credential capture to "demo well," escalate. That path trades a slide-worthy demo for legal, security, and reputational catastrophe. The compliant MVP is the credible path.
