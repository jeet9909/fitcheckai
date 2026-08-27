# Engineering — Deployment & Infrastructure

## 1. Environments
| Env | Purpose | AI | Data |
|---|---|---|---|
| **Dev** | Local | **Mock adapters** | Docker Compose, seed data |
| **Staging** | Pre-prod | Hosted inference | Managed, sample catalog |
| **Prod** | Live | Hosted → self-host | Autoscaled, backups, residency-aware |

## 2. Local dev (Docker Compose)
Services: `api` (FastAPI), `worker` (Celery, mock AI), `postgres`, `redis`, `minio` (S3/R2-compatible local), `mailhog`/OTP stub. One `docker compose up` boots the whole stack with mock AI so the app runs end-to-end offline.

## 3. Containerization
- Multi-stage Dockerfiles (slim runtime).
- Separate images: `api`, `worker`, `worker-gpu` (CUDA base for self-host).
- Health/readiness endpoints; graceful shutdown for in-flight jobs.

## 4. CI/CD (GitHub Actions)
```mermaid
flowchart LR
    PR[PR] --> LINT[Lint+Typecheck]
    LINT --> TEST[Unit+Integration+Contract]
    TEST --> BUILD[Build images]
    BUILD --> SCAN[Security scan]
    SCAN --> STG[Deploy staging]
    STG --> E2E[Smoke/E2E]
    E2E --> PROD[Deploy prod (manual gate)]
```
- Flutter pipeline: analyze → test → build APK/IPA → distribute (Firebase/TestFlight) → store release.

## 5. Infrastructure as Code
- **Terraform** for cloud resources (managed containers, Postgres, Redis, R2 buckets, CDN, secrets).
- Environments as workspaces; no click-ops in prod.

## 6. Compute topology (prod)
```mermaid
flowchart TD
    CDN[Cloudflare CDN] --> LB[Load Balancer]
    LB --> API[FastAPI (managed containers, autoscale)]
    API --> PG[(Managed PostgreSQL + replica)]
    API --> RD[(Managed Redis)]
    API --> R2[(Cloudflare R2)]
    API --> Q[Queue]
    Q --> CPU[CPU workers (validation/parse)]
    Q --> GPU[GPU: hosted inference / self-host fleet]
```

## 7. GPU strategy
- MVP: **hosted inference** (no GPU ops).
- At volume: **self-host** on-demand + **spot/preemptible** for batch renders; autoscale by queue depth. Introduce **Kubernetes** only when managing a GPU fleet.

## 8. Observability
- Logs: structured JSON → central log store.
- Traces: OpenTelemetry.
- Errors: Sentry.
- Metrics: latency, queue depth, **cost-per-inference**, job success rate, per-store adapter health.
- Alerts: SLO breaches, cost spikes, adapter failures.

## 9. Reliability
- Queue retries + dead-letter; idempotent jobs; circuit-breakers on store adapters + hosted AI; graceful degradation (serve cache, reduce angles).
- Backups: Postgres PITR; R2 versioning/lifecycle.

## 10. Security & secrets (see `compliance/security.md`)
Secrets manager (no secrets in repo); least-privilege IAM; network isolation for data stores; WAF/rate-limit at edge; image scanning in CI.

## 11. Data residency (DPDP)
Choose India-region (or India-available) managed services for personal/body data where required; document cross-border processing + DPAs for any hosted AI vendor handling images.
