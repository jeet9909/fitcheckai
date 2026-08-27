# Diagram — Integration Flow

**Adapter registry + capabilities**
```mermaid
flowchart LR
    APP[Catalog Service] --> REG[Adapter Registry]
    REG --> A1[AmazonAdapter\ncatalog=API, cart=NONE]
    REG --> A2[AffiliateFeedAdapter\nMyntra/Ajio/Flipkart/Nykaa\ncatalog=FEED, cart=NONE]
    REG --> A3[MeeshoAdapter\ncatalog=FEED-limited]
    REG --> A4[PartnerAdapter future\ncart=PARTNER_ONLY]
```

**UI adapts to capability**
```mermaid
flowchart TD
    C[Read CapabilitySet] --> D{cartWrite supported/partner?}
    D -- Yes --> S[Show 'Sync to store cart']
    D -- No --> O[Show 'Open in store']
    O --> AF[Attach affiliate tag]
    S --> AF
```

**Handoff sequence (compliant)**
```mermaid
sequenceDiagram
    participant App
    participant Cart
    participant Adp as Adapter
    participant Store
    App->>Cart: checkout(outfit)
    Cart->>Adp: checkoutRedirect(items)
    Adp-->>Cart: deep-link + affiliate params
    Cart-->>App: grouped 'Open in {store}' links
    App->>Store: user opens (attributed)
    Note over App,Store: No server-side cart write (MVP)
```
Detail + capability truth-table: `architecture/integration-architecture.md`, `research/platform-api-research.md`.
