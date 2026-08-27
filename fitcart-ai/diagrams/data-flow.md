# Diagram — Data Flow

**Body-data lifecycle (privacy-first)**
```mermaid
flowchart LR
    UP[Photo upload] --> VAL[Validation]
    VAL --> GEN[Avatar generation]
    GEN --> AVP[Avatar params encrypted @ R2]
    UP -.->|deleted after gen by default| PURGE[(Purged)]
    AVP --> USE[Try-on / Fit]
    USE --> REN[Renders cached @ R2]
    FB[Fit feedback consented] --> DS[(Anonymized dataset)]
```

**Request → async job → result**
```mermaid
sequenceDiagram
    participant App
    participant API
    participant Q as Queue
    participant W as Worker
    participant S as R2
    App->>API: POST /tryon
    API->>Q: enqueue (item_set_hash)
    API-->>App: 202 job_id
    Q->>W: dispatch (check cache first)
    W->>S: read avatar+product imgs
    W->>W: try-on + fit
    W->>S: write renders + report
    W->>API: status done
    App->>API: GET /tryon/{id}
    API-->>App: renders + fit_report
```

**Analytics (privacy-safe)**
```mermaid
flowchart LR
    APP --> EV[Event API] -->|pseudonymize| DW[(Analytics)] --> DASH[Dashboards]
```
Detail: `architecture/data-architecture.md`, `compliance/privacy.md`.
