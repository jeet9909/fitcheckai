# Engineering — Final Tech Stack & Decisions

Each choice is a **decision matrix**, then a **recommendation**. Full rationale mirrored in `DECISION_LOG.md`.

## 1. Mobile: Flutter vs React Native
| Criterion | Flutter | React Native |
|---|---|---|
| Single codebase iOS+Android | ✅ | ✅ |
| Custom UI / animation (viewer) | ✅ Excellent (Skia/Impeller) | ⚠️ Good, more native bridging |
| Mid-range Android perf (India) | ✅ Strong | ⚠️ Good |
| 3D/GL path (V3 viewer) | ✅ flutter_gl/filament | ⚠️ Possible |
| Talent pool | Good | Larger JS pool |
| Team context | Prompt-preferred | — |
**Decision: ✅ Flutter.** Best custom-UI + mid-range performance for the viewer-heavy, India-first app. Migration path: none needed; RN is the fallback if hiring dictates.

## 2. Backend language: Python vs Go vs Node
| Criterion | Python (FastAPI) | Go | Node |
|---|---|---|---|
| AI/ML ecosystem fit | ✅ Native | ❌ | ⚠️ |
| Async perf | ✅ Good | ✅ Best | ✅ Good |
| Dev velocity (small team) | ✅ | ⚠️ | ✅ |
| One language w/ AI workers | ✅ | ❌ | ❌ |
**Decision: ✅ Python + FastAPI** for core/AI orchestration. **Go** reserved for a possible high-QPS deep-link/attribution edge service later. Migration path: extract hotspots to Go if profiling demands.

## 3. Database: PostgreSQL vs MongoDB
| Criterion | PostgreSQL | MongoDB |
|---|---|---|
| Relational integrity (orders/fit/consent) | ✅ | ⚠️ |
| JSON flexibility (product blobs) | ✅ JSONB | ✅ |
| Vector search (recs) | ✅ pgvector | ⚠️ |
| Ops maturity | ✅ | ✅ |
**Decision: ✅ PostgreSQL** (JSONB for flexible product data + pgvector for V2 recs). One store to operate. MongoDB not needed.

## 4. Cache/queue: Redis + Celery/RQ → RabbitMQ/Kafka
| Need | MVP | Scale |
|---|---|---|
| Cache/session/rate-limit | **Redis** | Redis |
| Job broker | **Redis + Celery/RQ** | **RabbitMQ** (routing) |
| Event streaming | — | **Kafka** (if event volume warrants) |
**Decision:** start Redis+Celery; add RabbitMQ when fan-out grows; Kafka only if analytics/event throughput justifies. Don't over-build.

## 5. Object storage: S3 vs Cloudflare R2
| Criterion | S3 | Cloudflare R2 |
|---|---|---|
| Ecosystem | ✅ | ✅ (S3-compatible) |
| **Egress cost** | ❌ pricey | ✅ **zero egress** |
| CDN pairing | CloudFront | ✅ native |
**Decision: ✅ Cloudflare R2** (image/render heavy → egress savings are large) with S3-compatible API (portable). CDN via Cloudflare.

## 6. GPU serving
| Option | Use |
|---|---|
| **Hosted inference** (fal/Replicate/managed) | **MVP** — no GPU ops, pay-per-use |
| **Self-hosted GPU workers** (spot/on-demand) | **At volume** — cheaper per-inference |
| Serverless GPU | Bursty workloads |
**Decision:** hosted first → self-host high-volume models when unit cost crosses over. Adapter interface makes this a config change.

## 7. Orchestration: Kubernetes vs Serverless
| Criterion | Serverless/Managed | Kubernetes |
|---|---|---|
| Small-team ops burden | ✅ Low | ❌ High |
| GPU workloads | ⚠️ (specialized) | ✅ Flexible |
| Cost at low scale | ✅ | ⚠️ |
**Decision:** **managed containers/serverless for API** (low ops) + **hosted GPU** early. Introduce **Kubernetes only** when self-hosting GPU fleets at scale. Avoid premature k8s.

## 8. Final recommended architecture (one picture)
```mermaid
flowchart LR
    FL[Flutter App] --> API[FastAPI on managed containers]
    API --> PG[(PostgreSQL + pgvector)]
    API --> RD[(Redis)]
    API --> R2[(Cloudflare R2 + CDN)]
    API --> Q[Celery/RQ]
    Q --> W[AI Workers]
    W --> HOST[Hosted GPU Inference]
    W --> SELF[Self-host GPU (later)]
    API --> OBS[Logs/Traces/Sentry]
```

## 9. Supporting tools
CI/CD: GitHub Actions. IaC: Terraform. Containers: Docker. Errors: Sentry. Metrics/traces: OpenTelemetry + Grafana/Prometheus (or managed). Secrets: cloud secrets manager. Feature flags: lightweight flag service.

## 10. Summary table
| Layer | Choice |
|---|---|
| Mobile | Flutter |
| Backend | Python + FastAPI (modular monolith) |
| DB | PostgreSQL (+pgvector) |
| Cache/Queue | Redis + Celery/RQ (→RabbitMQ/Kafka) |
| Object storage | Cloudflare R2 + CDN |
| GPU | Hosted → self-host at volume |
| Infra | Managed containers/serverless → k8s at scale |
| CI/CD | GitHub Actions + Terraform |
