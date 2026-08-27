# Compliance — Security Architecture

## 1. Threat model (what we protect)


| Asset                  | Threat                      | Impact                                  |
| ---------------------- | --------------------------- | --------------------------------------- |
| Body photos/avatars    | Breach, unauthorized access | Critical (privacy, trust, DPDP penalty) |
| Auth tokens            | Theft, replay               | Account takeover                        |
| Store affiliate params | Tampering                   | Revenue loss                            |
| AI job pipeline        | Abuse, cost bombing         | Financial                               |
| PII (email/phone)      | Breach                      | Regulatory                              |


## 2. Authentication & authorization

- **JWT** access (short-lived) + **refresh** (rotating, revocable); store refresh securely (`flutter_secure_storage`).
- OTP + optional social login; no passwords for stores (see §7).
- **RBAC/scopes**; per-route guards; admin actions audited.
- Session invalidation on logout/erasure.

## 3. Encryption

- **In transit:** TLS 1.2+ everywhere; HSTS.
- **At rest:** DB + object storage encrypted with **KMS-managed keys**; body-data objects encrypted; key rotation.
- Field-level encryption considered for the most sensitive columns.

## 4. Secrets management

- Cloud **secrets manager**; **no secrets in repo**; `.env.example` documents required vars.
- CI secret scanning; least-privilege service credentials; short-lived tokens where possible.

## 5. Input & upload security

- Strict **image validation** (type, size, dimensions, malware scan); reject executables/oversized payloads.
- Pydantic validation on all inputs; output encoding; parameterized queries (no SQLi).
- Signed, expiring URLs for R2 uploads/downloads.

## 6. API security

- **Rate limiting** per user + IP (protects cost + abuse).
- WAF at edge; bot protection on auth + job endpoints (cost-bombing defense).
- Idempotency keys on job creation.
- CORS locked to app origins; no wildcard.

## 7. Store credential protection (the red line)

- **We do NOT store third-party shopping passwords (MVP).** Integration is via **affiliate/deep-link** and, later, **partner OAuth**.
- If a future partner ever requires OAuth tokens, store them **encrypted, scoped, revocable**, never as raw passwords. See `compliance/platform-integration-risks.md`.

## 8. Access control & audit

- Least-privilege IAM; body-data access is **logged** (who/what/when) in `audit_log`.
- Separation of duties; production data access gated + monitored.

## 9. Monitoring & incident response

- Anomaly alerts (auth spikes, cost spikes, mass-download attempts).
- **Breach notification workflow** per DPDP/GDPR timelines.
- Runbooks; on-call; post-incident reviews.

## 10. Supply chain & code security

- Dependency scanning (SCA), SAST in CI, image scanning.
- Pin dependencies; review new AI model weights for provenance + license (also a legal gate).
- Signed builds.

## 11. Pre-launch security gate (checklist)

- TLS + HSTS enforced
- Encryption at rest w/ KMS + rotation
- Secrets in manager; CI secret scan green
- Rate limiting + WAF + bot protection live
- Image upload validation + malware scan
- RBAC + audit logging on body-data access
- No store passwords stored (verified)
- Delete-account purges assets (tested)
- External pen-test completed & findings closed
- Incident response runbook + breach workflow ready

